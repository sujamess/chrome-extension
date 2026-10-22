# chrome-extension

A home for Chrome extensions. Each extension is a self-contained folder under `extensions/` and loads as an unpacked extension with no build step.

## Extensions

| Folder | What it does |
| --- | --- |
| `extensions/random-string/` | Generates random strings and passwords from presets, from the popup or the right-click menu. |

## Load an extension

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked and select the extension folder, for example `extensions/random-string/`.

There is nothing to build or install first. The checkout is the loadable artifact.

## Verify

The checks run with [bun](https://bun.sh). From the repo root:

```
bun run verify
```

This runs the type check, the unit tests, the static structure checks, and the e2e suite against real Chrome. Each gate also runs on its own: `bun run typecheck`, `bun run unit`, `bun run static`, `bun run e2e`. See an extension's own README for what its checks cover.

## Add an extension

Create `extensions/<name>/` with its own `manifest.json`. Keep it self-contained: no imports from a sibling extension. If two extensions ever need the same code, that is the moment to extract a shared directory, not before.

The repo-level checks in `verify/` cover all extensions. An extension with its own extra checks adds its own scripts in the repo `package.json`.

## Random string: quick start

Click the toolbar icon to open the popup, pick a preset, and copy. Or right-click any page and choose Generate random string, then a preset. The string lands in your clipboard, and if you were focused in a text field it is filled there too.
