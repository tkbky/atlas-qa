import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import type { Observation, Affordance, FormFieldInfo } from "./types.js";
import { logDebug, logInfo, logWarn } from "./logger.js";

/**
 * Thin Stagehand v3 wrapper
 * - stagehand.observe(instruction) -> Action[] {selector, description, method?, arguments?}
 * - stagehand.act(instruction | Action) executes either a natural-language instruction or a deterministic Action
 * - stagehand.extract() -> { pageText: string } when called without args
 * Docs: act/observe/extract signatures; Stagehand class + env options.
 */
// act(): string | Action, observe(): string -> Action[], extract(): returns pageText; env: "LOCAL" | "BROWSERBASE".
// Citations: act/observe/extract and Stagehand class & env.
// :contentReference[oaicite:5]{index=5}

export class WebEnv {
  private sh!: Stagehand;

  async init(env: "LOCAL" | "BROWSERBASE" = "LOCAL") {
    this.sh = new Stagehand({ env });
    await this.sh.init();
    logInfo("Stagehand environment initialized", { env });
  }

  get page() {
    return this.sh.context.pages()[0];
  }

  async goto(url: string) {
    await this.page.goto(url);
    logInfo("Navigated to URL", { url });
  }

  async currentObservation(): Promise<Observation> {
    const url = this.page.url();
    const title = await this.page.title();
    const observed = await this.sh.observe(
      "Find interactive controls relevant to the task, including buttons, links, form fields (inputs, textareas, selects), checkboxes, toggles, sliders, and other actionable elements."
    );
    // Raw page text can help with planning/critique:
    const { pageText } = await this.sh.extract();
    const affordances = await this.enrichAffordances(observed as Affordance[]);
    const observation: Observation = { url, title, affordances, pageText };
    logDebug("Current observation generated", {
      url,
      title,
      affordanceCount: observation.affordances.length,
      pageTextLength: observation.pageText?.length ?? 0,
    });
    return observation;
  }

  async act(a: Affordance) {
    const action: Affordance = {
      ...a,
      arguments: a.arguments ? [...a.arguments] : undefined,
      currentValue: a.currentValue,
    };

    logDebug("Dispatching action to Stagehand", {
      selector: action.selector,
      method: action.method,
      description: action.description,
      hasInstruction: Boolean(action.instruction),
      arguments: action.arguments,
    });

    if (action.selector && action.method) {
      await this.sh.act({
        selector: action.selector,
        description: action.description,
        method: action.method,
        arguments: action.arguments ?? [],
      }); // deterministic (no LLM)
    } else if (action.instruction) {
      await this.sh.act(action.instruction); // natural-language
    } else {
      throw new Error("Invalid action: need either selector+method or instruction");
    }
    logInfo("Action completed", { description: action.description });
  }

  async goBack() {
    await this.page.goBack();
    logInfo("Browser navigated back");
  }

  async close() {
    if (this.sh) {
      await this.sh.close();
      logInfo("Stagehand environment closed");
    }
  }

  private async enrichAffordances(affordances: Affordance[]): Promise<Affordance[]> {
    return await Promise.all(
      affordances.map(async affordance => {
        const enriched: Affordance = { ...affordance };
        const method = enriched.method?.toLowerCase();

        if (enriched.selector) {
          try {
            const fieldInfo = await this.collectFieldInfo(enriched.selector);
            if (fieldInfo) {
              enriched.fieldInfo = fieldInfo;
              if (fieldInfo.value !== undefined && fieldInfo.value !== null) {
                enriched.currentValue = fieldInfo.value;
              }
            }
          } catch (error) {
            logWarn("Failed to collect field metadata", {
              selector: enriched.selector,
              description: enriched.description,
              error,
            });
          }
        }

        return enriched;
      })
    );
  }

  private async collectFieldInfo(selector: string): Promise<FormFieldInfo | null> {
    return await this.page.evaluate<FormFieldInfo | null, string>(rawSelector => {
      let strategy: "xpath" | "css" = "xpath";
      let locator = rawSelector;
      if (rawSelector.startsWith("xpath=")) {
        locator = rawSelector.slice("xpath=".length);
      } else if (rawSelector.startsWith("css=")) {
        strategy = "css";
        locator = rawSelector.slice("css=".length);
      } else if (rawSelector.startsWith("//") || rawSelector.startsWith("(//")) {
        locator = rawSelector;
      } else {
        strategy = "css";
        locator = rawSelector;
      }

      let element: HTMLElement | null = null;
      try {
        if (strategy === "xpath") {
          const result = document.evaluate(locator, document, null, 9, null);
          element = result.singleNodeValue as HTMLElement | null;
        } else {
          element = document.querySelector(locator) as HTMLElement | null;
        }
      } catch (err) {
        return null;
      }

      if (!element) {
        return null;
      }

      const collectLabel = () => {
        let candidate: Element | null = null;
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        ) {
          const labels = element.labels;
          if (labels && labels.length > 0) {
            candidate = labels[0];
          }
        }
        if (!candidate) {
          const ariaLabelledBy = element.getAttribute("aria-labelledby");
          if (ariaLabelledBy) {
            const texts = ariaLabelledBy
              .split(" ")
              .map(id => document.getElementById(id)?.textContent?.trim())
              .filter((value): value is string => Boolean(value));
            if (texts.length > 0) {
              return texts.join(" ").trim();
            }
          }
        }
        if (!candidate) {
          let parent: Element | null = element.parentElement;
          while (parent) {
            if (parent.tagName.toLowerCase() === "label") {
              candidate = parent;
              break;
            }
            parent = parent.parentElement;
          }
        }
        if (candidate) {
          const text = candidate.textContent?.trim();
          if (text) {
            return text;
          }
        }
        const ariaLabel = element.getAttribute("aria-label");
        if (ariaLabel) {
          return ariaLabel.trim();
        }
        return null;
      };

      const tagName = element.tagName.toLowerCase();
      const base: FormFieldInfo = {
        tagName,
        label: collectLabel(),
        ariaLabel: element.getAttribute("aria-label"),
        placeholder: null,
        name:
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
            ? element.name ?? null
            : null,
        id: element.id || null,
        type: null,
        required: element.hasAttribute("required"),
        disabled: element.hasAttribute("disabled"),
        value: null,
        checked: null,
        multiple: null,
        options: null,
      };

      if (element instanceof HTMLInputElement) {
        base.type = element.type || "text";
        base.placeholder = element.getAttribute("placeholder");
        base.value = element.value ?? null;
        if (element.type === "checkbox" || element.type === "radio") {
          base.checked = element.checked;
        }
      } else if (element instanceof HTMLTextAreaElement) {
        base.type = "textarea";
        base.placeholder = element.getAttribute("placeholder");
        base.value = element.value ?? null;
      } else if (element instanceof HTMLSelectElement) {
        base.type = "select";
        base.multiple = element.multiple;
        base.value = element.value ?? null;
        base.options = Array.from(element.options).map(option => ({
          value: option.value,
          label: option.text,
          selected: option.selected,
        }));
      } else if ((element as HTMLElement).isContentEditable) {
        base.type = "contenteditable";
        base.value = element.textContent ?? null;
      }

      return base;
    }, selector);
  }
}
