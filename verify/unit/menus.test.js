import { beforeEach, describe, expect, test } from 'bun:test';
import { PRESETS } from '../../extensions/random-string/core/presets.js';
import {
  presetIdFromMenu,
  registerMenus,
} from '../../extensions/random-string/platform/menus.js';

function stubMenus() {
  const created = [];
  let removals = 0;
  globalThis.chrome = /** @type {any} */ ({
    contextMenus: {
      removeAll: (cb) => {
        removals++;
        created.length = 0;
        cb();
      },
      create: (props) => created.push(props),
    },
  });
  return { created, removals: () => removals };
}

describe('registerMenus', () => {
  test('creates one parent and one child per PRESETS entry', () => {
    const { created } = stubMenus();
    registerMenus();
    const [parent, ...children] = created;
    expect(parent.title).toBe('Generate random string');
    expect(parent.parentId).toBeUndefined();
    expect(children.map((c) => c.id)).toEqual(Object.keys(PRESETS).map((id) => `preset:${id}`));
    for (const child of children) {
      expect(child.parentId).toBe(parent.id);
      expect(child.title).toBe(PRESETS[child.id.slice('preset:'.length)].label);
    }
  });

  test('a second registration converges instead of duplicating', () => {
    const stub = stubMenus();
    registerMenus();
    const afterFirst = stub.created.length;
    registerMenus();
    expect(stub.removals()).toBe(2);
    expect(stub.created.length).toBe(afterFirst);
  });
});

describe('presetIdFromMenu', () => {
  beforeEach(() => stubMenus());

  test('round-trips every live preset id', () => {
    for (const id of /** @type {import('../../extensions/random-string/core/presets.js').PresetId[]} */ (
      Object.keys(PRESETS)
    )) {
      expect(presetIdFromMenu(`preset:${id}`)).toBe(id);
    }
  });

  test('rejects everything else', () => {
    for (const junk of ['preset:ghost', 'settings', 'preset:', '', 'google', 42, null, undefined]) {
      expect(presetIdFromMenu(/** @type {any} */ (junk))).toBeNull();
    }
  });
});
