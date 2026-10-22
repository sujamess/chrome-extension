import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const self = fileURLToPath(import.meta.url);
const ext = join(root, 'extensions', 'random-string');

const failures = [];
const fail = (message) => failures.push(message);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const extensionJs = walk(ext).filter((path) => path.endsWith('.js'));

for (const path of extensionJs.filter((path) => path.includes('/core/'))) {
  const source = readFileSync(path, 'utf8');
  for (const banned of ['chrome.', 'window.', 'document.']) {
    if (source.includes(banned)) fail(`${path}: core contains ${banned}`);
  }
}

const storageFiles = extensionJs.filter((path) => readFileSync(path, 'utf8').includes('chrome.storage'));
if (storageFiles.length !== 1 || !storageFiles[0].endsWith('platform/storage.js')) {
  fail(`chrome.storage must appear only in platform/storage.js, found: ${storageFiles.join(', ')}`);
}

const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
const requiredPermissions = ['contextMenus', 'storage', 'offscreen', 'scripting', 'activeTab', 'clipboardWrite'];
const actualPermissions = [...manifest.permissions].sort();
if (JSON.stringify(actualPermissions) !== JSON.stringify([...requiredPermissions].sort())) {
  fail(
    `manifest permissions must equal [${requiredPermissions.join(', ')}], found [${actualPermissions.join(', ')}]`,
  );
}

const sources = [
  ...extensionJs,
  ...walk(join(root, 'verify')).filter((path) => path.endsWith('.js') && path !== self),
];
for (const path of sources) {
  if (readFileSync(path, 'utf8').includes('buildRecipe')) fail(`${path}: buildRecipe must not exist`);
}

if (failures.length > 0) {
  console.error(`static check FAILED (${failures.length}):`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(`static check ok: ${extensionJs.length} extension files, ${sources.length} sources scanned`);
