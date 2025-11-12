import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import type { Observation, Affordance, FormFieldInfo } from "./types.js";
import { logDebug, logInfo, logWarn } from "./logger.js";
import { applyTemporalInput } from "./strategies/TemporalInputStrategy.js";

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
    // Disable experimental V3 context to avoid "V3 context not initialized" crash
    // seen in logs when filling datetime-local. We only need stable primitives.
    this.sh = new Stagehand({ env, experimental: false });
    await this.sh.init();
    logInfo("Stagehand environment initialized", { env, experimental: false });
  }

  get page(): any {
    return this.sh.context.pages()[0];
  }

  async goto(url: string) {
    await this.page.goto(url);
    logInfo("Navigated to URL", { url });
  }

  async currentObservation(retries = 2): Promise<Observation> {
    const url = this.page.url();
    const title = await this.page.title();

    let affordances: Affordance[] = [];
    let attempts = 0;

    // Fix 2: Retry observation if empty (page might still be rendering)
    while (affordances.length === 0 && attempts < retries) {
      if (attempts > 0) {
        logDebug("Observation returned no affordances, retrying", { attempt: attempts + 1, url });
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const observed = await this.sh.observe(
        "Find interactive controls relevant to the task, including buttons, links, form fields (inputs, textareas, selects), checkboxes, toggles, sliders, and other actionable elements."
      );
      affordances = await this.enrichAffordances(observed as Affordance[]);

      // Explicitly check for datetime-local inputs that might be missed by Stagehand
      const datetimeInputs = await this.detectDateTimeInputs();
      if (datetimeInputs.length > 0) {
        // Check if datetime inputs are already in affordances
        const existingSelectors = new Set(affordances.map(a => a.selector));
        for (const dtInput of datetimeInputs) {
          if (!existingSelectors.has(dtInput.selector)) {
            affordances.push(dtInput);
          }
        }
      }

      attempts++;
    }

    // Log warning if still empty after retries
    if (affordances.length === 0) {
      // Fallback: build a minimal, generic affordance set via DOM scan
      try {
        const fallbackAffordances = await this.page.evaluate(() => {
          const buildSelector = (el: Element): string => {
            const he = el as HTMLElement;
            if (he.id) return `#${he.id}`;
            if (he.getAttribute('name')) return `${he.tagName.toLowerCase()}[name="${he.getAttribute('name')}"]`;
            // Build a simple, stable-ish XPath
            const parts: string[] = [];
            let node: Element | null = el;
            // Limit depth to avoid huge strings
            let guard = 0;
            while (node && node.nodeType === Node.ELEMENT_NODE && guard < 15) {
              const tag = node.nodeName.toLowerCase();
              let index = 1;
              let sib = node.previousElementSibling;
              while (sib) {
                if (sib.nodeName.toLowerCase() === tag) index++;
                sib = sib.previousElementSibling;
              }
              parts.unshift(`${tag}${index > 1 ? `[${index}]` : ''}`);
              node = node.parentElement;
              guard++;
              if (node && node.nodeName.toLowerCase() === 'html') {
                parts.unshift('html');
                break;
              }
            }
            return 'xpath=/' + parts.join('/');
          };

          const textFor = (el: Element): string => {
            const t = (el.textContent || '').trim();
            return t.length > 0 ? t : (el.getAttribute('aria-label') || '').trim();
          };

          const out: any[] = [];
          const push = (el: Element, desc: string, method: 'click' | 'fill' | 'selectOption') => {
            const selector = buildSelector(el);
            out.push({ selector, description: desc, method, arguments: [] });
          };

          // Clickable controls
          const clickable = Array.from(document.querySelectorAll('a,button,[role="button"]'));
          clickable.forEach(el => {
            const label = textFor(el);
            const desc = label ? `clickable control '${label}'` : 'clickable control';
            push(el, desc, 'click');
          });

          // Form controls
          const inputs = Array.from(document.querySelectorAll('input,select,textarea'));
          inputs.forEach(el => {
            const tag = el.tagName.toLowerCase();
            const type = (el as HTMLInputElement).type?.toLowerCase?.() || tag;
            const label = textFor(el);
            const baseDesc = label ? `${tag} '${label}'` : tag;
            if (tag === 'select') {
              push(el, `select ${baseDesc}`, 'selectOption');
            } else {
              push(el, `${baseDesc} form control (${type})`, 'fill');
            }
          });

          return out;
        });

        affordances = (fallbackAffordances || []) as Affordance[];
      } catch {
        // Fallback generation failed; proceed with empty affordances
      }

      const { pageText } = await this.sh.extract();
      logWarn("No affordances detected after retries", {
        url,
        title,
        attempts,
        fallbackCount: affordances.length,
        hasPageContent: pageText.length > 0,
        pageTextPreview: pageText.slice(0, 500)
      });
    }

    // Raw page text can help with planning/critique:
    const { pageText } = await this.sh.extract();
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
    // Augment 'fill' for temporal inputs to use a robust native setter.
    if ((a.method || "").toLowerCase() === "fill" && a.selector) {
      try {
        // Ask the page for the element type so we only intercept temporal inputs.
        const t = await this.page.evaluate((sel: string) => {
          const el = document.querySelector(sel) as HTMLInputElement | null;
          return (el?.type || "").toLowerCase();
        }, a.selector);

        if (["date", "time", "datetime-local", "month"].includes(t)) {
          const v = (a.arguments && a.arguments[0]) || "";
          await applyTemporalInput(this.page, a.selector, v);
          logInfo("Action completed", { description: a.description, method: "temporal-input-fill" });
          return;
        }
      } catch (e) {
        // Fall through to default executor if type lookup fails
        logDebug("Temporal input detection failed, falling back to default", { error: e });
      }
    }

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

    // Default path (Stagehand/Playwright/etc.)
    if (action.selector && action.method) {
      // Minimal generic resilience: pre-hover and ensure visibility before clicks
      if (action.method.toLowerCase() === 'click' && action.selector) {
        try {
          await this.page.hover(action.selector);
        } catch {
          // ignore hover failures
        }
        try {
          await this.page.evaluate((sel: string) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            el?.scrollIntoView({ block: 'center', inline: 'center' });
          }, action.selector);
          await this.page.waitForTimeout(200);
        } catch {
          // ignore scroll failures
        }
      }
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

    // Fix 1: Wait for page to stabilize after action
    // This gives time for SPAs to render and DOM to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Optionally wait for network idle for navigation-like actions
    const isNavigationAction =
      action.description?.toLowerCase().includes('click') &&
      (action.description?.toLowerCase().includes('link') ||
       action.description?.toLowerCase().includes('navigation') ||
       action.description?.toLowerCase().includes('menu'));

    if (isNavigationAction) {
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 3000 });
        logDebug("Waited for network idle after navigation action");
      } catch {
        // Continue if timeout - page might be loaded already
        logDebug("Network idle timeout - continuing anyway");
      }
    }
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

  /**
   * Best-effort Shopify cart count reader.
   * Uses the platform JSON endpoint '/cart.js' which returns { item_count, ... }.
   * Returns null when the endpoint is unavailable (non-Shopify or blocked).
   */
  async getShopifyCartCount(timeoutMs = 0): Promise<number | null> {
    try {
      const count = await this.page.evaluate(async (ms: number) => {
        const fetchCount = async (): Promise<number | null> => {
          try {
            const res = await fetch('/cart.js', {
              credentials: 'same-origin',
              cache: 'no-store',
            });
            if (!res.ok) return null;
            const data = await res.json();
            const n = (data && typeof data.item_count === 'number') ? data.item_count : null;
            return n;
          } catch {
            return null;
          }
        };
        if (!ms || ms <= 0) {
          return await fetchCount();
        }
        const deadline = Date.now() + ms;
        let last: number | null = null;
        while (Date.now() < deadline) {
          const n = await fetchCount();
          if (typeof n === 'number') return n;
          await new Promise(r => setTimeout(r, 200));
        }
        return last;
      }, timeoutMs);
      if (typeof count === 'number') {
        logDebug("Shopify cart count read", { count });
        return count;
      }
    } catch {
      // ignore - likely not a Shopify store or blocked by CSP
    }
    return null;
  }

  /**
   * Polls '/cart.js' for an increase over a prior count.
   * Returns the outcome with the last observed postCount.
   */
  async waitForShopifyCartIncrease(previousCount: number | null, timeoutMs = 4000): Promise<{ increased: boolean; postCount: number | null }> {
    const deadline = Date.now() + timeoutMs;
    let last: number | null = await this.getShopifyCartCount(0);
    while (Date.now() < deadline) {
      const current = await this.getShopifyCartCount(0);
      if (typeof previousCount === 'number' && typeof current === 'number' && current > previousCount) {
        logInfo("Shopify cart count increased", { previousCount, current });
        return { increased: true, postCount: current };
      }
      last = current;
      await new Promise(r => setTimeout(r, 300));
    }
    return { increased: false, postCount: last };
  }

  private async enrichAffordances(affordances: Affordance[]): Promise<Affordance[]> {
    return await Promise.all(
      affordances.map(async affordance => {
        const enriched: Affordance = { ...affordance };
        const method = enriched.method?.toLowerCase();

        // Fix 4: Only collect field info for elements that are likely form controls
        const isLikelyFormControl =
          method === 'fill' ||
          method === 'selectoption' ||
          affordance.description?.toLowerCase().includes('input') ||
          affordance.description?.toLowerCase().includes('select') ||
          affordance.description?.toLowerCase().includes('textarea') ||
          affordance.description?.toLowerCase().includes('spinbutton');

        if (enriched.selector && isLikelyFormControl) {
          try {
            const fieldInfo = await this.collectFieldInfo(enriched.selector);
            if (fieldInfo) {
              enriched.fieldInfo = fieldInfo;
              if (fieldInfo.value !== undefined && fieldInfo.value !== null) {
                enriched.currentValue = fieldInfo.value;
              }
            }
          } catch (error) {
            // Fix 5: Reduce log verbosity - use DEBUG instead of WARN for non-critical errors
            logDebug("Failed to collect field metadata (non-critical)", {
              selector: enriched.selector,
              description: enriched.description,
              error: (error as Error)?.message || String(error),
            });
          }
        }

        return enriched;
      })
    );
  }

  private async detectDateTimeInputs(): Promise<Affordance[]> {
    const datetimeInputs = await this.page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="datetime-local"]');
      const results: any[] = [];

      inputs.forEach((input: any) => {
        // Generate selector
        let selector = '';
        if (input.id) {
          selector = `#${input.id}`;
        } else if (input.name) {
          selector = `input[name="${input.name}"]`;
        } else {
          // Generate xpath if no id or name
          const xpath = [];
          let element = input as Element;
          while (element && element.nodeType === Node.ELEMENT_NODE) {
            let index = 0;
            let sibling = element.previousSibling;
            while (sibling) {
              if (sibling.nodeType === Node.ELEMENT_NODE &&
                  sibling.nodeName === element.nodeName) {
                index++;
              }
              sibling = sibling.previousSibling;
            }
            const tagName = element.nodeName.toLowerCase();
            const xpathIndex = index > 0 ? `[${index + 1}]` : '';
            xpath.unshift(tagName + xpathIndex);
            element = element.parentNode as Element;
            if (element && element.nodeName.toLowerCase() === 'html') {
              break;
            }
          }
          selector = 'xpath=//' + xpath.join('/');
        }

        // Get label text
        let label = '';
        if (input.labels && input.labels.length > 0) {
          label = input.labels[0].textContent?.trim() || '';
        }

        results.push({
          selector,
          description: `datetime-local input field for '${label || input.name || input.id || 'date and time'}'`,
          method: 'fill',
          arguments: [''],
          fieldInfo: {
            tagName: 'input',
            type: 'datetime-local',
            id: input.id || null,
            name: input.name || null,
            required: input.required,
            disabled: input.disabled,
            value: input.value || null,
            label: label || null,
            ariaLabel: input.getAttribute('aria-label'),
            placeholder: input.getAttribute('placeholder'),
            checked: null,
            multiple: null,
            options: null
          },
          currentValue: input.value || null
        });
      });

      return results;
    });

    return datetimeInputs as Affordance[];
  }

  private async collectFieldInfo(selector: string): Promise<FormFieldInfo | null> {
    // Fix 1: Add outer try-catch to handle page.evaluate errors
    try {
      return await this.page.evaluate(rawSelector => {
        // Add inner try-catch for better error handling inside browser context
        try {
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
          } catch (selectorError) {
            // Selector evaluation failed - return null gracefully
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
        } catch (innerError) {
          // Catch any errors during field info collection inside browser context
          return null;
        }
      }, selector);
    } catch (outerError) {
      // Catch errors from page.evaluate itself (e.g., page closed, navigation, timeout)
      return null;
    }
  }
}
