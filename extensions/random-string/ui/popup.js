import { PRESETS } from '../core/presets.js';
import { generate, entropyBits } from '../core/generator.js';
import { materialize, parseSymbolSet } from '../core/recipe.js';
import { copyText } from '../platform/clipboard.js';
import { loadSettings, saveSettings } from '../platform/storage.js';

const ui = /** @type {{
  chips: HTMLElement,
  length: HTMLInputElement,
  lengthValue: HTMLOutputElement,
  symbolRow: HTMLElement,
  symbol: HTMLInputElement,
  output: HTMLTextAreaElement,
  entropy: HTMLElement,
  copy: HTMLButtonElement,
  regenerate: HTMLButtonElement,
}} */ ({
  chips: document.querySelector('#chips'),
  length: document.querySelector('#length'),
  lengthValue: document.querySelector('#length-value'),
  symbolRow: document.querySelector('#symbol-row'),
  symbol: document.querySelector('#symbol'),
  output: document.querySelector('#output'),
  entropy: document.querySelector('#entropy'),
  copy: document.querySelector('#copy'),
  regenerate: document.querySelector('#regenerate'),
});

/** @type {import('../platform/storage.js').Settings} */
const state = await loadSettings();
let output = '';
/** @type {ReturnType<typeof setTimeout>|undefined} */
let copiedTimer;

function activeRecipe() {
  return materialize(PRESETS[state.defaultPreset].recipe, state);
}

function usesSymbols() {
  return PRESETS[state.defaultPreset].recipe.pool.includes('symbol');
}

function persist() {
  saveSettings({ ...state }).catch(() => {});
}

function regenerate() {
  output = generate(activeRecipe());
  render();
}

function render() {
  const recipe = activeRecipe();
  for (const chip of ui.chips.querySelectorAll('.chip')) {
    const active = /** @type {string} */ (chip.getAttribute('data-preset')) === state.defaultPreset;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  ui.length.value = String(recipe.length);
  ui.lengthValue.textContent = String(recipe.length);
  ui.symbolRow.hidden = !usesSymbols();
  ui.output.value = output;
  ui.entropy.textContent = `~${Math.round(entropyBits(recipe))} bits`;
}

for (const [id, preset] of Object.entries(PRESETS)) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.dataset.preset = id;
  chip.textContent = preset.label;
  chip.setAttribute('aria-pressed', 'false');
  chip.addEventListener('click', () => {
    state.defaultPreset = /** @type {import('../core/presets.js').PresetId} */ (id);
    persist();
    regenerate();
  });
  ui.chips.append(chip);
}

ui.length.addEventListener('input', () => {
  state.lengthOverride = Number(ui.length.value);
  persist();
  regenerate();
});

ui.symbol.addEventListener('input', () => {
  try {
    state.symbolSet = parseSymbolSet(ui.symbol.value);
    ui.symbol.classList.remove('invalid');
    persist();
    regenerate();
  } catch {
    ui.symbol.classList.add('invalid');
  }
});

ui.copy.addEventListener('click', async () => {
  try {
    await copyText(output);
    ui.copy.textContent = 'Copied';
    ui.copy.classList.add('copied');
  } catch {
    ui.copy.textContent = 'Copy failed';
  }
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    ui.copy.textContent = 'Copy';
    ui.copy.classList.remove('copied');
  }, 1500);
});

ui.regenerate.addEventListener('click', regenerate);

ui.symbol.value = state.symbolSet;
regenerate();
