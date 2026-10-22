import { PRESETS } from '../core/presets.js';

const MENU_ROOT_ID = 'randomstring-root';
const MENU_PREFIX = 'preset:';

/** Register the context menu. Idempotent: removeAll, then one parent and one child per
 *  PRESETS entry, so re-runs and reinstalls converge on the same menu. */
export function registerMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ROOT_ID,
      title: 'Generate random string',
      contexts: ['all'],
    });
    for (const [id, preset] of Object.entries(PRESETS)) {
      chrome.contextMenus.create({
        id: `${MENU_PREFIX}${id}`,
        title: preset.label,
        parentId: MENU_ROOT_ID,
        contexts: ['all'],
      });
    }
  });
}

/** 'preset:google' -> 'google'. Anything else -> null (the caller ignores it).
 *  @param {string|number} menuItemId
 *  @returns {import('../core/presets.js').PresetId|null} */
export function presetIdFromMenu(menuItemId) {
  if (typeof menuItemId !== 'string' || !menuItemId.startsWith(MENU_PREFIX)) return null;
  const id = menuItemId.slice(MENU_PREFIX.length);
  return Object.hasOwn(PRESETS, id) ? /** @type {import('../core/presets.js').PresetId} */ (id) : null;
}
