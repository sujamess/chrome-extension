import { CHAR_CLASSES, PRESETS } from '../core/presets.js';
import { InvalidInput, materialize, parseLength, parseSymbolSet } from '../core/recipe.js';

/** @typedef {import('../core/presets.js').PresetId} PresetId */

/** The storage delta, never a resolved recipe.
 *  @typedef {{ defaultPreset: PresetId, symbolSet: string, lengthOverride: number|null }} Settings */

export const DEFAULT_SETTINGS = Object.freeze({
  defaultPreset: 'google',
  symbolSet: CHAR_CLASSES.symbol,
  lengthOverride: null,
});

const STORAGE_KEY = 'settings';

/** Read settings. Total: never rejects. Parses field by field over defaults, so a corrupt
 *  or partial store, or a preset id that no longer exists, degrades to defaults. The store
 *  is never rewritten on read.
 *  @returns {Promise<Settings>} */
export async function loadSettings() {
  try {
    const stored = await chrome.storage.sync.get(STORAGE_KEY);
    return parseSettings(stored ? stored[STORAGE_KEY] : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Validate by materializing the recipe these settings would produce, then persist.
 *  Throws InvalidInput when the settings cannot run.
 *  @param {Settings} settings */
export async function saveSettings(settings) {
  const preset = settings && Object.hasOwn(PRESETS, settings.defaultPreset)
    ? PRESETS[settings.defaultPreset]
    : undefined;
  if (!preset) throw new InvalidInput('unknown preset id');
  parseSymbolSet(settings.symbolSet);
  materialize(preset.recipe, settings);
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

/** @param {any} raw
 *  @returns {Settings} */
function parseSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    defaultPreset: Object.hasOwn(PRESETS, s.defaultPreset)
      ? s.defaultPreset
      : DEFAULT_SETTINGS.defaultPreset,
    symbolSet: typeof s.symbolSet === 'string'
      ? overFailure(parseSymbolSet, s.symbolSet) ?? DEFAULT_SETTINGS.symbolSet
      : DEFAULT_SETTINGS.symbolSet,
    lengthOverride: s.lengthOverride == null ? null : overFailure(parseLength, s.lengthOverride),
  };
}

function overFailure(/** @type {(raw: any) => any} */ parse, /** @type {any} */ raw) {
  try {
    return parse(raw);
  } catch {
    return null;
  }
}
