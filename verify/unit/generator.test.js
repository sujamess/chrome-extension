import { describe, expect, test } from 'bun:test';
import { CHAR_CLASSES, PRESETS } from '../../extensions/random-string/core/presets.js';
import { browserRng, entropyBits, generate } from '../../extensions/random-string/core/generator.js';

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

describe('generate with a seeded Rng', () => {
  test('produces the exact pinned output per algorithm', () => {
    expect(generate(PRESETS.letters.recipe, seededRng(0x5eed))).toBe('sTuvWDMKPvOVVrIl');
    expect(generate(PRESETS.google.recipe, seededRng(0x5eed))).toBe('_l*W:v>-J0k1%#+6f{');
    expect(generate(PRESETS.hex.recipe, seededRng(0x5eed))).toBe('0815496618691252a4b910025ec6b132');
  });

  test('same seed, same string; different seed, different string', () => {
    expect(generate(PRESETS.google.recipe, seededRng(7))).toBe(
      generate(PRESETS.google.recipe, seededRng(7)),
    );
    expect(generate(PRESETS.google.recipe, seededRng(7))).not.toBe(
      generate(PRESETS.google.recipe, seededRng(8)),
    );
  });

  test('symbolSet replaces the symbol class byte for byte', () => {
    const recipe = { length: 24, pool: ['symbol'], required: [], symbolSet: '@#%' };
    expect(generate(recipe, seededRng(0x5eed))).toBe('@@#%#%#%%@@%%%%##@%%%%@@');
  });

  test('shuffles a 1024-char string, where Fisher-Yates indices exceed one byte', () => {
    const recipe = { length: 1024, pool: ['lower'], required: [] };
    const out = generate(recipe, seededRng(0x5eed));
    expect(out.length).toBe(1024);
    expect(out).not.toBe('a'.repeat(1024));
  });
});

describe('generate with browserRng', () => {
  test('honors recipe length', () => {
    for (let i = 0; i < 200; i++) {
      expect(generate(PRESETS.google.recipe).length).toBe(18);
    }
  });

  test('every google run contains at least one char of each required class', () => {
    const classes = [CHAR_CLASSES.lower, CHAR_CLASSES.upper, CHAR_CLASSES.digit, CHAR_CLASSES.symbol];
    for (let i = 0; i < 200; i++) {
      const out = generate(PRESETS.google.recipe);
      for (const chars of classes) {
        const present = [...chars].some((c) => out.includes(c));
        if (!present) throw new Error(`required class missing from ${out}`);
        expect(present).toBe(true);
      }
    }
  });

  test('letters + symbols output draws only from its pool', () => {
    const pool = [...CHAR_CLASSES.lower, ...CHAR_CLASSES.upper, ...CHAR_CLASSES.symbol];
    for (let i = 0; i < 200; i++) {
      const out = generate(PRESETS.symbols.recipe);
      for (const ch of out) {
        if (!pool.includes(ch)) throw new Error(`unexpected char ${ch} in ${out}`);
      }
    }
  });
});

describe('uniformity (modulo-bias gate)', () => {
  test('every lowercase char lands within 6% of its fair share over 104000 draws', () => {
    const recipe = { length: 1000, pool: ['lower'], required: [] };
    const counts = new Map([...CHAR_CLASSES.lower].map((c) => [c, 0]));
    for (let i = 0; i < 104; i++) {
      for (const ch of generate(recipe)) counts.set(ch, counts.get(ch) + 1);
    }
    const expected = 104000 / 26;
    const floor = Math.floor(expected * 0.94);
    for (const [ch, n] of counts) {
      if (n < floor) throw new Error(`char ${ch} drew ${n}, expected ~${expected}; modulo bias is back`);
      expect(n).toBeGreaterThanOrEqual(floor);
    }
  });
});

describe('entropyBits', () => {
  test('hex pools a power of two, so the number is exact', () => {
    expect(entropyBits(PRESETS.hex.recipe)).toBe(128);
    expect(entropyBits(PRESETS.numbers.recipe)).toBe(12 * Math.log2(10));
  });

  test('symbolSet substitution shrinks the pool', () => {
    expect(entropyBits({ length: 10, pool: ['symbol'], required: [], symbolSet: 'ab' })).toBe(10);
  });

  test('rejects an empty effective pool', () => {
    expect(() => entropyBits({ length: 4, pool: [], required: [] })).toThrow();
    expect(() => generate({ length: 4, pool: [], required: [] })).toThrow();
  });
});
