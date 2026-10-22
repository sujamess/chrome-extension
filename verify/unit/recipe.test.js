import { describe, expect, test } from 'bun:test';
import { CHAR_CLASSES, PRESETS } from '../../extensions/random-string/core/presets.js';
import {
  InvalidInput,
  assertValidRecipe,
  materialize,
  parseLength,
  parseSymbolSet,
} from '../../extensions/random-string/core/recipe.js';

describe('parseLength', () => {
  test('accepts number-likes inside 1..1024', () => {
    expect(parseLength(16)).toBe(16);
    expect(parseLength('32')).toBe(32);
    expect(parseLength(1)).toBe(1);
    expect(parseLength(1024)).toBe(1024);
  });

  test('rejects junk and out-of-range values', () => {
    for (const bad of [0, 1025, -4, 16.5, 'abc', NaN, Infinity, null, undefined]) {
      expect(() => parseLength(bad)).toThrow(InvalidInput);
    }
  });
});

describe('parseSymbolSet', () => {
  test('strips whitespace and keeps the rest', () => {
    expect(parseSymbolSet('!@#')).toBe('!@#');
    expect(parseSymbolSet(' a b ')).toBe('ab');
    expect(() => parseSymbolSet('\t')).toThrow(InvalidInput);
    expect(() => parseSymbolSet('')).toThrow(InvalidInput);
    expect(() => parseSymbolSet(42)).toThrow(InvalidInput);
  });

  test('enforces the storage.sync headroom limits', () => {
    expect(parseSymbolSet('a'.repeat(128))).toBe('a'.repeat(128));
    expect(() => parseSymbolSet('a'.repeat(129))).toThrow(InvalidInput);
    const unique32 = '0123456789abcdefghijklmnopqrstuv';
    expect(unique32.length).toBe(32);
    expect(parseSymbolSet(unique32)).toBe(unique32);
    expect(() => parseSymbolSet(`${unique32}w`)).toThrow(InvalidInput);
  });
});

describe('materialize', () => {
  const noOverrides = { lengthOverride: null, symbolSet: CHAR_CLASSES.symbol };

  test('no overrides returns the preset recipe, copied', () => {
    expect(materialize(PRESETS.hex.recipe, noOverrides)).toEqual({
      length: 32,
      pool: ['digit', 'hex'],
      required: [],
    });
  });

  test('lengthOverride replaces the preset length', () => {
    expect(materialize(PRESETS.hex.recipe, { ...noOverrides, lengthOverride: 8 }).length).toBe(8);
    expect(() => materialize(PRESETS.hex.recipe, { ...noOverrides, lengthOverride: 0 })).toThrow(
      InvalidInput,
    );
  });

  test('symbolSet applies only where the pool draws symbols', () => {
    const withSymbols = materialize(PRESETS.symbols.recipe, {
      lengthOverride: null,
      symbolSet: 'A%',
    });
    expect(withSymbols.symbolSet).toBe('A%');
    const withoutSymbols = materialize(PRESETS.letters.recipe, {
      lengthOverride: null,
      symbolSet: 'A%',
    });
    expect(withoutSymbols.symbolSet).toBeUndefined();
  });

  test('an invalid symbolSet is rejected for symbol presets', () => {
    expect(() =>
      materialize(PRESETS.symbols.recipe, { lengthOverride: null, symbolSet: '  ' }),
    ).toThrow(InvalidInput);
  });

  test('the result is detached from the frozen registry', () => {
    const detached = materialize(PRESETS.letters.recipe, noOverrides);
    detached.pool.push('hex');
    expect(PRESETS.letters.recipe.pool).toEqual(['lower', 'upper']);
  });
});

describe('assertValidRecipe', () => {
  test('accepts every registry entry and returns it', () => {
    for (const preset of Object.values(PRESETS)) {
      expect(assertValidRecipe(preset.recipe)).toBe(preset.recipe);
    }
  });

  test('rejects each violated invariant', () => {
    const good = { length: 4, pool: ['lower', 'digit'], required: [{ of: 'digit', min: 2 }] };
    expect(() => assertValidRecipe(good)).not.toThrow();
    const broken = [
      null,
      {},
      { length: 0, pool: ['lower'], required: [] },
      { length: 1025, pool: ['lower'], required: [] },
      { length: 4.5, pool: ['lower'], required: [] },
      { length: 4, pool: [], required: [] },
      { length: 4, pool: ['ghost'], required: [] },
      { length: 4, pool: ['lower'], required: [{ of: 'digit', min: 1 }] },
      { length: 2, pool: ['lower', 'digit'], required: [{ of: 'lower', min: 2 }, { of: 'digit', min: 1 }] },
      { length: 4, pool: ['lower'], required: [{ of: 'lower', min: 0 }] },
      { length: 4, pool: ['lower'], required: 'nope' },
      { length: 4, pool: ['lower'], required: [], symbolSet: 7 },
    ];
    for (const recipe of broken) {
      expect(() => assertValidRecipe(recipe)).toThrow(InvalidInput);
    }
  });
});
