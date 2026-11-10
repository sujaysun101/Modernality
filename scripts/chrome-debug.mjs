/**
 * Modernality Chrome Remote Debugging Launcher (`pnpm run chrome:debug`)
 * Ensures Chrome is listening on http://127.0.0.1:9222 so `.mcp.json` (`chrome-devtools-mcp@latest`)
 * and `pnpm run test` can inspect the live frontend DOM, console, network, and styles.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEBUG_PORT = 9222;
const APP_URL = process.env.APP_URL || 'http://127.0.0.1:8000';

async function checkPort9222() {
  try {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}
  return null;
}

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')
      : '',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  for (const exe of candidates) {
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

export async function ensureChromeDebugging({ headless = false } = {}) {
  let info = await checkPort9222();
  if (info) {
    console.log(`  ✓ Chrome DevTools already listening on http://127.0.0.1:${DEBUG_PORT} (${info.Browser})`);
    return info;
  }

  const exe = findBrowserExecutable();
  if (!exe) {
    throw new Error('Could not find Chrome or Chromium executable to launch port 9222.');
  }

  const profileDir = path.join(ROOT, '.chrome-debug-profile');
  fs.mkdirSync(profileDir, { recursive: true });

  const args = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];
  if (headless) {
    args.push('--headless=new', '--disable-gpu');
  }
  args.push(APP_URL);

  const child = spawn(exe, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 300));
    info = await checkPort9222();
    if (info) {
      console.log(`  ✓ Launched Chrome DevTools on http://127.0.0.1:${DEBUG_PORT} (${info.Browser})`);
      return info;
    }
  }

  throw new Error(`Timed out waiting for Chrome DevTools on http://127.0.0.1:${DEBUG_PORT}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const useHeadless = process.argv.includes('--headless');
  ensureChromeDebugging({ headless: useHeadless }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
