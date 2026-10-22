import { beforeEach, describe, expect, test } from 'bun:test';
import { CHAR_CLASSES } from '../../extensions/random-string/core/presets.js';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '../../extensions/random-string/platform/storage.js';

/** @typedef {import('../../extensions/random-string/platform/storage.js').Settings} Settings */

/** @param {any} [initial] */
function stubStorage(initial) {
  const store = { ...initial };
  const writes = [];
  globalThis.chrome = /** @type {any} */ ({
    storage: {
      sync: {
        get: async (key) => (key in store ? { [key]: store[key] } : {}),
        set: async (items) => {
          Object.assign(store, items);
          writes.push({ ...items });
        },
      },
    },
  });
  return { store, writes };
}

describe('loadSettings', () => {
  beforeEach(() => stubStorage());

  test('an empty store yields the defaults', async () => {
    expect(await loadSettings()).toEqual({
      defaultPreset: 'google',
      symbolSet: CHAR_CLASSES.symbol,
      lengthOverride: null,
    });
  });

  test('a round trip preserves valid settings', async () => {
    await saveSettings({ defaultPreset: 'hex', symbolSet: '@%', lengthOverride: 20 });
    expect(await loadSettings()).toEqual({
      defaultPreset: 'hex',
      symbolSet: '@%',
      lengthOverride: 20,
    });
  });

  test('corrupt shapes degrade field by field, not to a blank slate', async () => {
    stubStorage({
      settings: { defaultPreset: 'ghost', symbolSet: 7, lengthOverride: 'junk' },
    });
    expect(await loadSettings()).toEqual({ ...DEFAULT_SETTINGS });
  });

  test('an unknown preset id falls back while good fields survive', async () => {
    stubStorage({ settings: { defaultPreset: 'ghost', symbolSet: '@#', lengthOverride: 12 } });
    expect(await loadSettings()).toEqual({
      defaultPreset: 'google',
      symbolSet: '@#',
      lengthOverride: 12,
    });
  });

  test('symbol sets are normalized at the boundary', async () => {
    stubStorage({ settings: { defaultPreset: 'hex', symbolSet: ' a b ', lengthOverride: null } });
    expect((await loadSettings()).symbolSet).toBe('ab');
  });

  test('a failing store never rejects', async () => {
    globalThis.chrome = /** @type {any} */ ({
      storage: {
        sync: {
          get: async () => {
            throw new Error('storage unavailable');
          },
          set: async () => {},
        },
      },
    });
    expect(await loadSettings()).toEqual({ ...DEFAULT_SETTINGS });
  });
});

describe('saveSettings', () => {
  test('writes the settings object under one key', async () => {
    const { store, writes } = stubStorage();
    /** @type {Settings} */
    const settings = { defaultPreset: 'numbers', symbolSet: '@', lengthOverride: null };
    await saveSettings(settings);
    expect(writes).toEqual([{ settings }]);
    expect(store.settings).toEqual(settings);
  });

  test('rejects settings that cannot produce a valid recipe', async () => {
    stubStorage();
    for (const bad of [
      { defaultPreset: 'ghost', symbolSet: '@', lengthOverride: null },
      { defaultPreset: 'symbols', symbolSet: '  ', lengthOverride: null },
      { defaultPreset: 'hex', symbolSet: '@', lengthOverride: 0 },
      { defaultPreset: 'hex', symbolSet: '@'.repeat(129), lengthOverride: null },
      null,
    ]) {
      await expect(saveSettings(/** @type {any} */ (bad))).rejects.toThrow();
    }
  });
});
