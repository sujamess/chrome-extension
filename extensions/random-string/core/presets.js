/** @typedef {import('./recipe.js').Recipe} Recipe */

export const CHAR_CLASSES = Object.freeze({
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digit: '0123456789',
  symbol: '!@#$%^&*()-_=+[]{}<>?.,;:',
  hex: 'abcdef',
});

/** @typedef {keyof typeof CHAR_CLASSES} CharClassId */

/** @typedef {{ label: string, recipe: Recipe }} Preset */

/** Anchors the keys as literals; delete this function and PresetId widens to string.
 *  @template {string} K
 *  @param {{ [key in K]: Preset }} p
 *  @returns {{ [key in K]: Preset }} */
function registry(p) {
  return p;
}

export const PRESETS = Object.freeze(registry({
  letters: {
    label: 'Letters',
    recipe: { length: 16, pool: ['lower', 'upper'], required: [] },
  },
  numbers: {
    label: 'Numbers',
    recipe: { length: 12, pool: ['digit'], required: [] },
  },
  hex: {
    label: 'Hex',
    recipe: { length: 32, pool: ['digit', 'hex'], required: [] },
  },
  symbols: {
    label: 'Letters + symbols',
    recipe: { length: 16, pool: ['lower', 'upper', 'symbol'], required: [] },
  },
  google: {
    label: 'Strong password',
    recipe: {
      length: 18,
      pool: ['lower', 'upper', 'digit', 'symbol'],
      required: [
        { of: 'lower', min: 1 },
        { of: 'upper', min: 1 },
        { of: 'digit', min: 1 },
        { of: 'symbol', min: 1 },
      ],
    },
  },
}));

/** @typedef {keyof typeof PRESETS} PresetId */
