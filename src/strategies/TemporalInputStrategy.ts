// A small, robust strategy for temporal inputs:
// date, time, datetime-local, month. We avoid picker UIs and set the native
// input value via the *native* property setter, then dispatch input/change.
export async function applyTemporalInput(
  page: any,
  selector: string,
  value: string
): Promise<void> {
  if (!selector) throw new Error("applyTemporalInput: missing selector");
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("applyTemporalInput: value must be a non-empty ISO-local string");
  }

  await page.evaluate(
    ({ sel, v }) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) throw new Error(`Temporal input not found: ${sel}`);
      const t = (el.type || "").toLowerCase();
      if (!["date", "time", "datetime-local", "month"].includes(t)) {
        throw new Error(`Element is not a temporal input: type='${t}'`);
      }

      // Use the native "value" property setter to avoid framework wrappers.
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      const nativeSetter = desc?.set;
      if (!nativeSetter) throw new Error("Failed to obtain native value setter");
      nativeSetter.call(el, v);

      // Fire the usual events so app code reacts.
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { sel: selector, v: value }
  );
}
