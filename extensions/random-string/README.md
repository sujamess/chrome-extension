# Random string

Generates random strings from presets and puts them on your clipboard. You reach it from the toolbar popup or from a right-click menu on any page. All randomness comes from crypto.getRandomValues.

## Load it

1. Open chrome://extensions and turn on Developer mode.
2. Click "Load unpacked" and select this folder.
3. Click the toolbar icon, or right-click any page and choose "Generate random string".

Nothing to build or install first. The folder you load is the shipped artifact.

## Use it

- In the popup, pick a preset chip, drag the length slider, press Copy. The popup generates on open and again on every change, so a string is always ready.
- From the context menu, pick a preset. The string lands in your clipboard. If you were focused in a text field on an http(s) page, it is filled there too. The clipboard copy always happens; the fill is best effort.
- On presets that use symbols you can replace the default symbol set. Your default preset, length override, and symbol set sync through chrome.storage.sync.

## Verify

From the repo root:

```sh
bun run verify
```

That runs four gates: a typecheck over the JSDoc-checked source, the unit tests, the static structural check, and an end-to-end run that loads this folder into a headless Chrome and drives the popup, the context menu store, and the offscreen clipboard path over the DevTools protocol. Branded Chrome 137 and later ignore --load-extension, so the e2e gate uses Chrome for Testing from ~/.cache/chrome-for-testing when present, falls back to the system Chrome, and honors a CHROME_BIN override.

Automation cannot click Chrome's native context menu, so that one gesture has a ten-second smoke test. Right-click a page, choose Generate random string > Strong password, and paste anywhere. If you were focused in a text field on an http(s) page, the string appears there too.

## Permissions

The manifest asks for six permissions and nothing else. There are no host permissions. The extension never reads a page you have not clicked in.

- contextMenus. Adds the "Generate random string" menu and one child per preset. Without it there is no right-click entry point.
- storage. Saves your default preset, length override, and symbol set in storage.sync so they follow your Chrome profile. Exactly one file touches storage, platform/storage.js.
- offscreen. Opens the single offscreen document that writes to the clipboard, because an MV3 service worker has no clipboard API. The document is created on demand and reused afterwards.
- scripting. Injects the best-effort fill into the field you were focused in when you clicked the menu. It runs only on http(s) pages, only right after your click, and the injected function only writes into that one field.
- activeTab. Grants temporary access to the tab you clicked in, which is what lets the fill happen without any host permission. The clipboard copy works even where activeTab is not granted, such as chrome:// pages.
- clipboardWrite. Lets the popup's Copy button and the offscreen document write to the clipboard without depending on a user gesture in every context.

## Add a preset

One entry in core/presets.js. The menu, the popup chips, and the tests all derive from that registry:

```js
dicewareish: {
  label: 'Letters and numbers',
  recipe: { length: 20, pool: ['lower', 'upper', 'digit'], required: [] },
},
```

## Layout

- core/ holds pure modules: the preset registry, recipe materialization and validation, and the generator. No chrome.* appears in core, which verify/static/check.js enforces.
- platform/ holds the chrome.* adapters: storage, clipboard, the offscreen lifecycle, menus, the menu click flow, and the page fill function.
- ui/ holds the popup. verify/ holds the unit tests, the static check, and the e2e driver.
