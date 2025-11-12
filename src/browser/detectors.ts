import type { Affordance } from "../core/types.js";

/**
 * Explicitly detect datetime-local inputs that might be missed by Stagehand
 */
export async function detectDateTimeInputs(page: any): Promise<Affordance[]> {
  const datetimeInputs = await page.evaluate(() => {
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
