import { ensureOffscreen } from './offscreen.js';
import { COPY_MESSAGE } from './copy-protocol.js';

/** Copy text from any extension context. Hides that the service worker has no clipboard
 *  API: pages write directly, the worker routes through the offscreen document.
 *  @param {string} text */
export async function copyText(text) {
  if (typeof document === 'undefined') {
    await ensureOffscreen();
    await requestOffscreenCopy(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

async function requestOffscreenCopy(/** @type {string} */ text) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const reply = await chrome.runtime.sendMessage({ type: COPY_MESSAGE, text });
      if (reply && reply.ok) return;
      lastError = new Error('offscreen copy was rejected');
    } catch (err) {
      // Right after createDocument the page's script may not listen yet; retry briefly.
      lastError = /** @type {Error} */ (err);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
  throw lastError;
}
