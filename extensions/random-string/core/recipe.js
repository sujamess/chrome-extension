import { CHAR_CLASSES } from './presets.js';

/** @typedef {import('./presets.js').CharClassId} CharClassId */

/** A complete instruction generate() can run.
 *  Invariant: length 1..1024; pool non-empty; every required.of appears in pool;
 *  sum of required.min <= length.
 *  @typedef {{
 *   length: number,
 *   pool: CharClassId[],
 *   required: Array<{of: CharClassId, min: number}>,
 *   symbolSet?: string,
 * }} Recipe */

export class InvalidInput extends Error {
  constructor(/** @type {string} */ message) {
    super(message);
    this.name = 'InvalidInput';
  }
}

export function parseLength(raw) {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 1024) {
    throw new InvalidInput('length must be an integer from 1 to 1024');
  }
  return n;
}

export function parseSymbolSet(raw) {
  if (typeof raw !== 'string') throw new InvalidInput('symbol set must be a string');
  const set = raw.replace(/\s+/g, '');
  if (set.length === 0) throw new InvalidInput('symbol set is empty');
  if (set.length > 128) throw new InvalidInput('symbol set is over 128 characters');
  if (new Set(set).size > 32) throw new InvalidInput('symbol set has over 32 unique characters');
  return set;
}

/** Combine a preset recipe with user overrides. Pure. Re-validates the result.
 *  @param {Recipe} recipe
 *  @param {{ lengthOverride: number|null, symbolSet: string }} overrides
 *  @returns {Recipe} */
export function materialize(recipe, overrides) {
  const length = overrides.lengthOverride == null
    ? recipe.length
    : parseLength(overrides.lengthOverride);
  const symbolSet = recipe.pool.includes('symbol')
    ? overrides.symbolSet == null ? recipe.symbolSet : parseSymbolSet(overrides.symbolSet)
    : recipe.symbolSet;
  /** @type {Recipe} */
  const next = {
    length,
    pool: [...recipe.pool],
    required: recipe.required.map((r) => ({ ...r })),
  };
  if (symbolSet !== undefined) next.symbolSet = symbolSet;
  return assertValidRecipe(next);
}

/** Guard for Recipe-shaped data arriving from outside core. Throws InvalidInput.
 *  @param {any} recipe
 *  @returns {Recipe} */
export function assertValidRecipe(recipe) {
  const fail = (/** @type {string} */ why) => { throw new InvalidInput(`invalid recipe: ${why}`); };
  if (!recipe || typeof recipe !== 'object') fail('not an object');
  parseLength(recipe.length);
  if (!Array.isArray(recipe.pool) || recipe.pool.length === 0) fail('pool is empty');
  for (const id of recipe.pool) {
    if (typeof id !== 'string' || !Object.hasOwn(CHAR_CLASSES, id)) fail(`unknown pool class ${id}`);
  }
  if (!Array.isArray(recipe.required)) fail('required is not an array');
  let minSum = 0;
  for (const req of recipe.required) {
    if (!req || typeof req.of !== 'string' || !Object.hasOwn(CHAR_CLASSES, req.of)) {
      fail(`unknown required class ${req && req.of}`);
    }
    if (!Number.isInteger(req.min) || req.min < 1) fail('required min must be a positive integer');
    if (!recipe.pool.includes(req.of)) fail(`required class ${req.of} is not in the pool`);
    minSum += req.min;
  }
  if (minSum > recipe.length) fail('required mins exceed length');
  if (recipe.symbolSet !== undefined && typeof recipe.symbolSet !== 'string') {
    fail('symbolSet must be a string');
  }
  return recipe;
}
