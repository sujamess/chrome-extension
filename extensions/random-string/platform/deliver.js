import { PRESETS } from '../core/presets.js';
import { generate } from '../core/generator.js';
import { materialize } from '../core/recipe.js';
import { copyText } from './clipboard.js';
import { fillFocused } from './fill.js';
import { loadSettings } from './storage.js';

/** The click flow: resolve -> generate -> copy -> best-effort fill -> badge flash.
 *  The clipboard is the guaranteed outcome; the fill never fails the flow.
 *  @param {import('../core/presets.js').PresetId} presetId
 *  @param {chrome.tabs.Tab|null} tab
 *  @returns {Promise<boolean>} whether a string was copied */
export async function deliver(presetId, tab) {
  try {
    const preset = PRESETS[presetId];
    if (!preset) return false;
    const settings = await loadSettings();
    const text = generate(materialize(preset.recipe, settings));
    await copyText(text);
    fillTab(tab, text);
    flashBadge('ok');
    return true;
  } catch {
    flashBadge('err');
    return false;
  }
}

function fillTab(/** @type {chrome.tabs.Tab|null} */ tab, /** @type {string} */ text) {
  const tabId = tab && typeof tab.id === 'number' ? tab.id : null;
  const fillable = typeof tab?.url === 'string' && /^https?:/i.test(tab.url);
  if (tabId === null || !fillable) return;
  chrome.scripting.executeScript({ target: { tabId }, func: fillFocused, args: [text] }).catch(
    () => {},
  );
}

function flashBadge(/** @type {'ok'|'err'} */ text) {
  chrome.action.setBadgeBackgroundColor({ color: text === 'err' ? '#ef4444' : '#6366f1' });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
}
