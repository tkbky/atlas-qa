import type { Affordance, FormFieldInfo } from "../core/types.js";
import { logWarn } from "../utils/logger.js";

const FORM_METHODS = new Set(["fill", "type", "select", "selectoption"]);

const FIELD_HINT_PATTERNS = [
  /input/,
  /field/,
  /textbox/,
  /password/,
  /email/,
  /form/,
  /select/,
];

type FieldInfoEvalResult =
  | { ok: true; data: FormFieldInfo }
  | { ok: false; reason?: string; stack?: string; silent?: boolean };

type FieldInfoErrorResult = Extract<FieldInfoEvalResult, { ok: false }>;

const isFieldInfoErrorResult = (
  result: FieldInfoEvalResult
): result is FieldInfoErrorResult => result.ok === false;

const shouldCollectFieldInfo = (affordance: Affordance): boolean => {
  if (!affordance.selector) return false;
  const method = (affordance.method ?? "").toLowerCase();
  if (FORM_METHODS.has(method)) return true;
  const desc = (affordance.description ?? "").toLowerCase();
  return FIELD_HINT_PATTERNS.some((pattern) => pattern.test(desc));
};

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

      if (shouldCollectFieldInfo(enriched)) {
        try {
          const fieldInfo = await collectFieldInfo(page, enriched.selector);
          if (fieldInfo) {
            enriched.fieldInfo = fieldInfo;
            if (fieldInfo.value !== undefined && fieldInfo.value !== null) {
              enriched.currentValue = fieldInfo.value;
            }
          }
        } catch (error) {
          if ((error as { silent?: boolean })?.silent) {
            return enriched;
          }
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
  const evaluateFieldInfoSource = String.raw`
    const CSS_HAS_TEXT = /:has-text\(/i;

    function resolveElement(selectorValue) {
      var strategy = "xpath";
      var locator = selectorValue;
      if (selectorValue.startsWith("xpath=")) {
        locator = selectorValue.slice("xpath=".length);
      } else if (selectorValue.startsWith("css=")) {
        strategy = "css";
        locator = selectorValue.slice("css=".length);
      } else if (selectorValue.startsWith("//") || selectorValue.startsWith("(//")) {
        locator = selectorValue;
      } else {
        strategy = "css";
        locator = selectorValue;
      }

      if (strategy === "css" && CSS_HAS_TEXT.test(locator)) {
        return { error: { ok: false, reason: "Unsupported :has-text selector syntax in CSS mode", silent: true } };
      }

      if (strategy === "xpath") {
        try {
          var xpathResult = document.evaluate(locator, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          return { element: xpathResult.singleNodeValue };
        } catch (err) {
          return {
            error: {
              ok: false,
              reason: err instanceof Error ? err.message : "Failed to evaluate XPath selector",
              silent: true,
            },
          };
        }
      }

      try {
        return { element: document.querySelector(locator) };
      } catch (err) {
        return {
          error: {
            ok: false,
            reason: err instanceof Error ? err.message : "Failed to execute querySelector",
            silent: true,
          },
        };
      }
    }

    function collectLabelText(element) {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        var labels = element.labels;
        if (labels && labels.length > 0) {
          var text = labels[0].textContent;
          if (text) {
            return text.trim();
          }
        }
      }

      var ariaLabelledBy = element.getAttribute("aria-labelledby");
      if (ariaLabelledBy) {
        var labelText = [];
        ariaLabelledBy.split(" ").forEach(function (id) {
          var node = document.getElementById(id);
          if (node && node.textContent) {
            labelText.push(node.textContent.trim());
          }
        });
        if (labelText.length > 0) {
          return labelText.join(" ").trim();
        }
      }

      var parent = element.parentElement;
      while (parent) {
        if (parent.tagName.toLowerCase() === "label") {
          if (parent.textContent) {
            return parent.textContent.trim();
          }
          break;
        }
        parent = parent.parentElement;
      }

      var ariaLabel = element.getAttribute("aria-label");
      if (ariaLabel) {
        return ariaLabel.trim();
      }

      return null;
    }

    function describeElement(element) {
      var base = {
        tagName: element.tagName ? element.tagName.toLowerCase() : "unknown",
        label: collectLabelText(element),
        ariaLabel: element.getAttribute("aria-label"),
        placeholder: null,
        name:
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
            ? element.name || null
            : null,
        id: element.id || null,
        type: null,
        required: element.hasAttribute("required"),
        disabled: element.hasAttribute("disabled"),
        value: null,
        checked: null,
        multiple: false,
        options: null,
      };

      if (element instanceof HTMLInputElement) {
        base.type = element.type || "text";
        base.placeholder = element.getAttribute("placeholder");
        base.value = element.value || null;
        if (element.type === "checkbox" || element.type === "radio") {
          base.checked = element.checked;
        }
      } else if (element instanceof HTMLTextAreaElement) {
        base.type = "textarea";
        base.placeholder = element.getAttribute("placeholder");
        base.value = element.value || null;
      } else if (element instanceof HTMLSelectElement) {
        base.type = "select";
        base.multiple = element.multiple;
        base.value = element.value || null;
        base.options = Array.from(element.options).map(function (option) {
          return { value: option.value, label: option.text, selected: option.selected };
        });
      } else if (element.isContentEditable) {
        base.type = "contenteditable";
        base.value = element.textContent || null;
      }

      return base;
    }

    try {
      var resolution = resolveElement(rawSelector);
      if (resolution.error) {
        return resolution.error;
      }
      var element = resolution.element;
      if (!element) {
        return { ok: false, reason: "Element not found", silent: true };
      }
      return { ok: true, data: describeElement(element) };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack || void 0 : void 0,
      };
    }
  `;

  const evaluator = new Function("rawSelector", evaluateFieldInfoSource);
  const result = (await page.evaluate(evaluator as any, selector)) as FieldInfoEvalResult | null;

  if (!result) {
    return null;
  }

  if (isFieldInfoErrorResult(result)) {
    if (result.silent) {
      return null;
    }
    const err = new Error(result.reason || "Failed to collect field metadata");
    if (result.stack) {
      err.stack = result.stack;
    }
    throw err;
  }

  return result.data;
}
