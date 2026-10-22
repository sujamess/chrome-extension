/** chrome.scripting serializes this function into the page, so it must stay
 *  self-contained: no imports, no closures over module state.
 *  @param {string} text
 *  @returns {{ filled: boolean }} */
export function fillFocused(text) {
  try {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const proto =
        el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setter = /** @type {(v: string) => void} */ (
        Object.getOwnPropertyDescriptor(proto, 'value')?.set
      );
      if (!setter) return { filled: false };
      setter.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return { filled: true };
    }
    if (el && /** @type {HTMLElement} */ (el).isContentEditable) {
      /** @type {HTMLElement} */ (el).focus();
      if (!document.execCommand('insertText', false, text)) {
        /** @type {HTMLElement} */ (el).textContent = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return { filled: true };
    }
    return { filled: false };
  } catch {
    return { filled: false };
  }
}
