import { describe, expect, test } from 'bun:test';
import { CHAR_CLASSES, PRESETS } from '../../extensions/random-string/core/presets.js';
import { assertValidRecipe, materialize } from '../../extensions/random-string/core/recipe.js';
import { generate } from '../../extensions/random-string/core/generator.js';

function seededRng(seed) {
  let s = seed >>> 0;
  return {
    bytes: (n) => {
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        s ^= s << 13;
        s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5;
        s >>>= 0;
        out[i] = s & 255;
      }
      return out;
    },
  };
}

describe('PRESETS registry', () => {
  test('every entry is a valid, generatable recipe with a label', () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
      expect(() => assertValidRecipe(preset.recipe)).not.toThrow();
      expect(preset.label.length).toBeGreaterThan(0);
      const overrides = { lengthOverride: null, symbolSet: '@#' };
      expect(generate(materialize(preset.recipe, overrides), seededRng(1)).length).toBe(
        preset.recipe.length,
      );
    }
  });

  test('every pool class exists in CHAR_CLASSES', () => {
    for (const preset of Object.values(PRESETS)) {
      for (const id of preset.recipe.pool) {
        expect(CHAR_CLASSES[id].length).toBeGreaterThan(0);
      }
    }
  });

  test('menus, chips and storage all key off the same five ids', () => {
    expect(Object.keys(PRESETS)).toEqual(['letters', 'numbers', 'hex', 'symbols', 'google']);
  });
});
