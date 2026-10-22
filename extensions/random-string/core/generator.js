import { CHAR_CLASSES } from './presets.js';
import { InvalidInput } from './recipe.js';

/** @typedef {import('./presets.js').CharClassId} CharClassId */
/** @typedef {import('./recipe.js').Recipe} Recipe */

/** The only seam tests need.
 *  @typedef {{ bytes: (n: number) => Uint8Array }} Rng */

/** @type {Rng} */
export const browserRng = {
  bytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
};

function classChars(/** @type {CharClassId} */ id, /** @type {string|undefined} */ symbolSet) {
  return id === 'symbol' && symbolSet !== undefined ? symbolSet : CHAR_CLASSES[id];
}

function effectivePool(/** @type {Recipe} */ recipe) {
  const chars = [];
  for (const id of recipe.pool) {
    for (const ch of classChars(id, recipe.symbolSet)) {
      if (!chars.includes(ch)) chars.push(ch);
    }
  }
  return chars;
}

function unbiased(/** @type {number} */ n, /** @type {Rng} */ rng) {
  if (n <= 256) {
    const limit = Math.floor(256 / n) * n;
    for (;;) {
      const b = rng.bytes(1)[0];
      if (b < limit) return b % n;
    }
  }
  const limit = Math.floor(4294967296 / n) * n;
  for (;;) {
    const b = rng.bytes(4);
    const word = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    if (word < limit) return word % n;
  }
}

/** One random string. Pure given rng. Throws on an empty effective pool. */
export function generate(recipe, rng = browserRng) {
  const pool = effectivePool(recipe);
  if (pool.length === 0) throw new InvalidInput('recipe has an empty effective pool');
  const slots = [];
  for (const req of recipe.required) {
    const chars = classChars(req.of, recipe.symbolSet);
    for (let i = 0; i < req.min; i++) slots.push(chars[unbiased(chars.length, rng)]);
  }
  while (slots.length < recipe.length) slots.push(pool[unbiased(pool.length, rng)]);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = unbiased(i + 1, rng);
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots.join('');
}

/** Approximate entropy in bits: result length * log2(effective pool size). */
export function entropyBits(recipe) {
  const pool = effectivePool(recipe);
  if (pool.length === 0) throw new InvalidInput('recipe has an empty effective pool');
  return recipe.length * Math.log2(pool.length);
}
