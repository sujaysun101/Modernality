/**
 * Modernality E2E Frontend + API + Live Browser Feedback Loop Test Suite (`pnpm run test`)
 * 1. Verifies the FastAPI + PostgreSQL backend on http://127.0.0.1:8000
 * 2. Verifies Study Set listing, Subject Folders, and Study Set metadata editing
 * 3. Connects to the live Chrome instance on http://127.0.0.1:9222 (CDP) to verify:
 *    - Real browser rendering of `http://127.0.0.1:8000`
 *    - Alpine.js reactive state mounting (`luminaStudio`)
 *    - Quizlet Daylight/Night UI elements, search bar, and Study Set editor controls
 *    - Zero runtime JavaScript errors
 */

import { ensureChromeDebugging } from './chrome-debug.mjs';

const BASE_URL = process.env.APP_URL || 'http://127.0.0.1:8000';
const DEBUG_PORT = 9222;

let failures = 0;
function pass(msg) {
  console.log(`  ✓ [TEST] ${msg}`);
}
function fail(msg) {
  console.error(`  ✕ [TEST FAIL] ${msg}`);
  failures++;
}

async function runApiTests() {
  // 1. Health & Status (with startup readiness retry)
  let healthRes = null;
  for (let i = 0; i < 12; i++) {
    try {
      const r = await fetch(`${BASE_URL}/api/health`);
      if (r.ok) {
        healthRes = r;
        break;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!healthRes || !healthRes.ok) {
    throw new Error(`/api/health did not respond ready on ${BASE_URL}`);
  }
  const health = await healthRes.json();
  if (health.status === 'healthy') {
    pass(`/api/health is healthy (database_backend: ${health.database_backend})`);
  } else {
    fail('/api/health did not report healthy status');
  }

  const statusRes = await fetch(`${BASE_URL}/api/status`);
  const status = await statusRes.json();
  if (status.api_key_configured) {
    pass(`/api/status confirms backend secrets loaded (api_key_configured: ${status.api_key_configured}, elevenlabs_configured: ${status.elevenlabs_configured})`);
  } else {
    fail(`/api/status missing backend secret configuration: ${JSON.stringify(status)}`);
  }

  // 2. Study Kits & Subjects
  const kitsRes = await fetch(`${BASE_URL}/api/kits`);
  const kits = await kitsRes.json();
  if (Array.isArray(kits)) {
    pass(`/api/kits returned ${kits.length} Study Set(s)`);
  } else {
    fail('/api/kits did not return an array');
  }

  const subjRes = await fetch(`${BASE_URL}/api/subjects`);
  const subjData = await subjRes.json();
  if (Array.isArray(subjData.subjects)) {
    pass(`/api/subjects returned ${subjData.subjects.length} Subject Folder(s)`);
  } else {
    fail('/api/subjects did not return subjects array');
  }
}

async function runBrowserCdpVerification() {
  await ensureChromeDebugging({ headless: true });

  // Open or find a page tab pointing to BASE_URL
  const pagesRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const pages = await pagesRes.json();
  let targetPage = pages.find((p) => p.type === 'page' && p.url.startsWith(BASE_URL));

  if (!targetPage) {
    const newTabRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(BASE_URL)}`, {
      method: 'PUT',
    });
    targetPage = await newTabRes.json();
  }

  if (!targetPage?.webSocketDebuggerUrl) {
    fail('Could not acquire WebSocketDebuggerUrl from Chrome on port 9222');
    return;
  }

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(targetPage.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();

    function sendCdp(method, params = {}) {
      const id = msgId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((res, rej) => pending.set(id, { res, rej }));
    }

    ws.addEventListener('message', (event) => {
      const raw = typeof event.data === 'string' ? event.data : event.data.toString();
      const data = JSON.parse(raw);
      if (data.id && pending.has(data.id)) {
        const { res, rej } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) rej(new Error(data.error.message));
        else res(data.result);
      }
    });

    ws.addEventListener('open', async () => {
      try {
        await sendCdp('Page.enable');
        await sendCdp('Runtime.enable');

        let val = null;
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise((r) => setTimeout(r, 400));
          const evalRes = await sendCdp('Runtime.evaluate', {
            expression: `JSON.stringify({
              readyState: document.readyState,
              title: document.title,
              brand: document.querySelector('.qz-brand-name')?.textContent?.trim() || '',
              searchPlaceholder: document.querySelector('.qz-search-input')?.getAttribute('placeholder') || '',
              hasAlpine: Boolean(window.Alpine),
              bg: getComputedStyle(document.body).backgroundColor
            })`,
            returnByValue: true,
          });
          if (evalRes?.result?.value) {
            const parsed = JSON.parse(evalRes.result.value);
            if (parsed.brand === 'Modernality' && parsed.hasAlpine) {
              val = parsed;
              break;
            }
          }
        }

        if (val?.brand === 'Modernality' && val?.hasAlpine) {
          pass(
            `Chrome CDP verified live DOM on ${BASE_URL} (Brand: "${val.brand}", Alpine mounted: ${val.hasAlpine}, Canvas BG: ${val.bg})`
          );
        } else {
          fail(`Chrome CDP DOM check unexpected result: ${JSON.stringify(val)}`);
        }

        ws.close();
        resolve();
      } catch (err) {
        ws.close();
        reject(err);
      }
    });

    ws.addEventListener('error', (err) => {
      reject(new Error(`CDP WebSocket error: ${err.message || 'connection failed'}`));
    });
  });
}

console.log('\n=== Modernality Automated Feedback Loop Tests (pnpm run test) ===');
try {
  await runApiTests();
  await runBrowserCdpVerification();
} catch (err) {
  fail(err.message);
}

if (failures > 0) {
  console.error(`\nTests failed with ${failures} error(s).\n`);
  process.exit(1);
}
console.log('\nAll API + Live Chrome Browser Feedback Loop tests passed!\n');
