import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rmSync } from 'node:fs';
import net from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CHAR_CLASSES, PRESETS } from '../../extensions/random-string/core/presets.js';

// Branded Chrome 137+ ignores --load-extension, so Chrome for Testing is preferred when
// present; CHROME_BIN overrides both.
const chromeCandidates = [
  process.env.CHROME_BIN,
  join(
    homedir(),
    '.cache/chrome-for-testing/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  ),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const CHROME = chromeCandidates.find((path) => path && existsSync(path));
const EXTENSION_DIR = new URL('../../extensions/random-string', import.meta.url).pathname;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : Number(address);
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

class Cdp {
  ws = null;
  seq = 0;
  pending = new Map();

  static connect(wsUrl) {
    const cdp = new Cdp();
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      cdp.ws = ws;
      ws.onopen = () => resolve(cdp);
      ws.onerror = () => reject(new Error(`websocket failed: ${wsUrl}`));
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (!message.id || !cdp.pending.has(message.id)) return;
        const { resolve: res, reject: rej } = cdp.pending.get(message.id);
        cdp.pending.delete(message.id);
        if (message.error) rej(new Error(`cdp error: ${message.error.message}`));
        else res(message.result);
      };
    });
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`cdp ${method} timed out`));
      }, 15000);
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`evaluate failed: ${detail}`);
    }
    return result.result.value;
  }

  close() {
    this.ws?.close();
  }
}

function escapeCharClass(chars) {
  return chars.replace(/[\\\]^^-]/g, (ch) => `\\${ch}`);
}

async function findOwnServiceWorker(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(200);
    let candidates = [];
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      candidates = targets.filter(
        (target) =>
          target.type === 'service_worker' &&
          /^chrome-extension:\/\/[a-p]{32}\/background\.js$/.test(target.url),
      );
    } catch {
    }
    for (const candidate of candidates) {
      let worker = null;
      try {
        worker = await Cdp.connect(candidate.webSocketDebuggerUrl);
        const name = await worker.evaluate('chrome.runtime.getManifest().name');
        if (name === 'Random String') return { target: candidate, worker };
      } catch {
      }
      worker?.close();
    }
  }
  return null;
}

async function verifyAgainst(port, worker) {
  const origin = await worker.evaluate('chrome.runtime.getURL("")');
  const version = await worker.evaluate('chrome.runtime.getManifest().version');
  console.log(`extension origin: ${origin} (version ${version})`);

  const newTab = await (
    await fetch(
      `http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${origin}ui/popup.html`)}`,
      { method: 'PUT' },
    )
  ).json();
  const popup = await Cdp.connect(newTab.webSocketDebuggerUrl);
  try {
    let popupState = null;
    for (let i = 0; i < 50 && !popupState?.value; i++) {
      await sleep(200);
      popupState = await popup.evaluate(`(() => {
        const out = document.querySelector('#output');
        const active = document.querySelector('.chip.active');
        return {
          value: out ? out.value : '',
          chips: document.querySelectorAll('.chip').length,
          active: active ? active.dataset.preset : null,
          entropy: document.querySelector('#entropy')?.textContent ?? '',
        };
      })()`);
    }

    const google = PRESETS.google.recipe;
    const googleCharset = google.pool.map((id) => escapeCharClass(CHAR_CLASSES[id])).join('');
    check(
      'popup renders one chip per preset with the default active',
      popupState.chips === Object.keys(PRESETS).length && popupState.active === 'google',
      `chips=${popupState.chips} active=${popupState.active}`,
    );
    const googleShape = new RegExp(`^[${googleCharset}]{${google.length}}$`);
    check(
      'popup auto-generates on open, matching the active preset shape',
      googleShape.test(popupState.value),
      JSON.stringify(popupState.value),
    );
    check(
      'entropy caption renders',
      /^~\d+ bits$/.test(popupState.entropy),
      popupState.entropy,
    );

    await popup.evaluate(`document.querySelectorAll('.chip')[2].click()`);
    let hexOutput = '';
    for (let i = 0; i < 25 && !hexOutput; i++) {
      await sleep(100);
      const value = await popup.evaluate(`document.querySelector('#output').value`);
      if (/^[0-9a-f]{32}$/.test(value)) hexOutput = value;
    }
    check(
      'clicking the hex chip regenerates in the hex shape',
      /^[0-9a-f]{32}$/.test(hexOutput),
      JSON.stringify(hexOutput),
    );

    // ServiceWorkerGlobalScope bans import(), so deliver() itself is proven here in the
    // popup page; the SW-only clipboard route is proven separately over messaging.
    await popup.send('Page.enable');
    await popup.send('Page.bringToFront');
    const deliveredInPage = await popup.evaluate(
      `import('/platform/deliver.js').then((module) => module.deliver('hex', null))`,
    );
    check('deliver("hex", null) runs through its real module graph', deliveredInPage === true);

    const fillProbe = await popup.evaluate(`(async () => {
      const { fillFocused } = await import('/platform/fill.js');
      const target = document.querySelector('#output');
      target.focus();
      const result = fillFocused('filled-by-e2e');
      return { filled: result.filled, value: target.value, active: document.activeElement === target };
    })()`);
    check(
      'fillFocused writes the focused editable element',
      fillProbe.filled === true && fillProbe.value === 'filled-by-e2e' && fillProbe.active === true,
      JSON.stringify(fillProbe),
    );
  } finally {
    popup.close();
  }

  try {
    // Chrome 156 dropped contextMenus.getAll, so existence in the real menu store is
    // proven with update() (which rejects on unknown ids) and a duplicate-id create.
    const menuIds = ['randomstring-root', ...Object.keys(PRESETS).map((id) => `preset:${id}`)];
    const menuProbe = await worker.evaluate(
      `(async (ids) => {
        const exists = {};
        for (const id of ids) {
          try {
            await chrome.contextMenus.update(id, { enabled: true });
            exists[id] = true;
          } catch {
            exists[id] = false;
          }
        }
        return exists;
      })(${JSON.stringify(menuIds)})`,
    );
    const duplicate = await worker.evaluate(
      `new Promise((resolve) => {
        chrome.contextMenus.create(
          { id: 'preset:hex', title: 'probe', parentId: 'randomstring-root', contexts: ['all'] },
          () => resolve(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'created'),
        );
      })`,
    );
    check(
      'context menu registered the parent and one child per preset',
      menuIds.every((id) => menuProbe[id]) && /duplicate/i.test(duplicate),
      `existing=${JSON.stringify(menuProbe)} duplicateCreate=${JSON.stringify(duplicate)}`,
    );

    const offscreenProbe = await worker.evaluate(
      `(async () => {
        const before = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
        if (before.length === 0) {
          await chrome.offscreen.createDocument({
            url: 'platform/offscreen.html',
            reasons: ['CLIPBOARD'],
            justification: 'Write generated strings to the system clipboard',
          });
        }
        let reply;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            reply = await chrome.runtime.sendMessage({ type: 'randomstring:copy', text: 'e2e-probe' });
            break;
          } catch (error) {
            if (attempt === 4) reply = { ok: false, error: String(error) };
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
        const after = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
        return { offscreenDocuments: after.length, reply };
      })()`,
    );
    check(
      'offscreen page exists and answers the copy message with {ok:true}',
      offscreenProbe.offscreenDocuments === 1 && offscreenProbe.reply?.ok === true,
      `documents=${offscreenProbe.offscreenDocuments} reply=${JSON.stringify(offscreenProbe.reply)}`,
    );
  } finally {
    worker.close();
  }
}

async function runOnce(headless) {
  const port = await freePort();
  const userDataDir = `/tmp/randstr-e2e-${Date.now()}`;
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-component-extensions-with-background-pages',
    `--load-extension=${EXTENSION_DIR}`,
    `--disable-extensions-except=${EXTENSION_DIR}`,
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new');
  const chrome = spawn(CHROME, args, { stdio: 'ignore' });
  try {
    const found = await findOwnServiceWorker(port, 20000);
    if (!found) {
      throw new Error('no service worker for this extension appeared');
    }
    try {
      await verifyAgainst(port, found.worker);
    } finally {
      found.worker.close();
    }
  } finally {
    chrome.kill('SIGTERM');
    await sleep(500);
    chrome.kill('SIGKILL');
    rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

const headless = !process.argv.includes('--headed');
try {
  await runOnce(headless);
} catch (error) {
  if (!headless) {
    console.error(`FAIL ${error.message}`);
    process.exit(1);
  }
  console.log(`headless=new could not load the extension (${error.message}); retrying headed once`);
  await runOnce(false);
}
if (failures.length > 0) {
  console.error(`e2e FAILED: ${failures.length} assertion(s)`);
  process.exit(1);
}
console.log('e2e ok');
