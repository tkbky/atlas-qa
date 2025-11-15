import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import type { Observation, Affordance } from "../core/types.js";
import { logDebug, logInfo } from "../utils/logger.js";
import { enrichAffordances } from "./enrichment.js";
import { detectDateTimeInputs } from "./detectors.js";

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
    this.sh = new Stagehand({ env, experimental: true });
    await this.sh.init();
    logInfo("Stagehand environment initialized", { env, experimental: true });
  }

  get page(): any {
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
    const affordances = await enrichAffordances(
      this.page,
      observed as Affordance[]
    );

    // Explicitly check for datetime-local inputs that might be missed by Stagehand
    const datetimeInputs = await detectDateTimeInputs(this.page);
    if (datetimeInputs.length > 0) {
      // Check if datetime inputs are already in affordances
      const existingSelectors = new Set(affordances.map((a) => a.selector));
      for (const dtInput of datetimeInputs) {
        if (!existingSelectors.has(dtInput.selector)) {
          affordances.push(dtInput);
        }
      }
    }

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

    // Handle special instructions that don't require Stagehand's LLM
    if (action.instruction) {
      const instruction = action.instruction.toLowerCase();

      // Handle page refresh/reload
      if (instruction.includes("refresh") || instruction.includes("reload")) {
        await this.page.reload({ waitUntil: "domcontentloaded" });
        logInfo("Action completed", { description: action.description });
        return;
      }

      // Handle scroll down
      if (instruction.includes("scroll down")) {
        await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
        logInfo("Action completed", { description: action.description });
        return;
      }

      // Handle scroll up
      if (instruction.includes("scroll up")) {
        await this.page.evaluate(() => window.scrollBy(0, -window.innerHeight));
        logInfo("Action completed", { description: action.description });
        return;
      }

      // For other instructions, fall through to Stagehand's natural language processor
      try {
        await this.sh.act(action.instruction); // natural-language
        logInfo("Action completed", { description: action.description });
      } catch (error) {
        // If Stagehand's LLM fails, log the error and provide helpful context
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to execute instruction "${action.instruction}": ${errorMsg}. ` +
            `Consider using specific selector+method actions instead of natural language instructions.`
        );
      }
      return;
    }

    if (action.selector && action.method) {
      await this.sh.act({
        selector: action.selector,
        description: action.description,
        method: action.method,
        arguments: action.arguments ?? [],
      }); // deterministic (no LLM)
      logInfo("Action completed", { description: action.description });
      return;
    }

    throw new Error(
      "Invalid action: need either selector+method or instruction"
    );
  }

  async captureFinalState(): Promise<any> {
    const url = this.page.url();
    const title = await this.page.title();
    const { pageText } = await this.sh.extract();

    // Capture a simplified representation of visible elements for assertions
    const visibleElements = await this.page.evaluate(() => {
      const elements = [];
      for (const el of document.querySelectorAll("body *")) {
        const style = window.getComputedStyle(el);
        if (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          (el as HTMLElement).offsetParent !== null
        ) {
          elements.push({
            tagName: el.tagName.toLowerCase(),
            text: el.textContent?.trim().slice(0, 200),
            id: el.id,
            "data-testid": el.getAttribute("data-testid"),
          });
        }
      }
      return elements;
    });

    return {
      url,
      title,
      pageText,
      visibleElements,
    };
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
}
