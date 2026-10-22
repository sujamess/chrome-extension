import { COPY_MESSAGE } from './copy-protocol.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== COPY_MESSAGE) return;
  writeToClipboard(String(message.text)).then(
    () => sendResponse({ ok: true }),
    () => sendResponse({ ok: false }),
  );
  return true;
});

async function writeToClipboard(/** @type {string} */ text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // The offscreen page often has no focus, which writeText rejects; execCommand does not.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  if (!copied) throw new Error('execCommand copy rejected');
}
