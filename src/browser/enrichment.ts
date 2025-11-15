import type { Affordance, FormFieldInfo } from "../core/types.js";
import { logWarn } from "../utils/logger.js";

/**
 * Enrich affordances with field metadata (fieldInfo and currentValue)
 */
export async function enrichAffordances(
  page: any,
  affordances: Affordance[]
): Promise<Affordance[]> {
  return await Promise.all(
    affordances.map(async (affordance) => {
      const enriched: Affordance = { ...affordance };

      if (enriched.selector) {
        try {
          const fieldInfo = await collectFieldInfo(page, enriched.selector);
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

/**
 * Collect detailed field information from a form element
 */
export async function collectFieldInfo(
  page: any,
  selector: string
): Promise<FormFieldInfo | null> {
  return await page.evaluate((rawSelector) => {
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
    } catch {
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
            .map((id) => document.getElementById(id)?.textContent?.trim())
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
          ? (element.name ?? null)
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
      base.options = Array.from(element.options).map((option) => ({
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
