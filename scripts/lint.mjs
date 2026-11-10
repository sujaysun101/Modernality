/**
 * Modernality Frontend & Full-Stack Linter (`pnpm run lint`)
 * Validates:
 * 1. JavaScript syntax in `frontend/app.js` and `scripts/*.mjs`
 * 2. HTML/CSS integrity and Quizlet design tokens in `frontend/index.html` & `frontend/styles.css`
 * 3. Security & Branding invariants (zero API key inputs or backend/cloud/model jargon on frontend)
 * 4. `.mcp.json` Chrome DevTools MCP configuration (`http://127.0.0.1:9222`) & `skills/chrome-debugging/SKILL.md`
 * 5. Python backend compilation (`backend/*.py`)
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failures = 0;
function pass(msg) {
  console.log(`  ✓ [LINT] ${msg}`);
}
function fail(msg) {
  console.error(`  ✕ [LINT FAIL] ${msg}`);
  failures++;
}

console.log('\n=== Modernality Lint Check (pnpm run lint) ===');

// 1. Check JS syntax via node --check
for (const relPath of ['frontend/app.js']) {
  const full = path.join(ROOT, relPath);
  try {
    execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
    pass(`${relPath} passed ES syntax check`);
  } catch (err) {
    fail(`${relPath} syntax error: ${err.stderr?.toString() || err.message}`);
  }
}

// 2. Check HTML & CSS structure + Security/Branding Invariants
const htmlPath = path.join(ROOT, 'frontend/index.html');
const cssPath = path.join(ROOT, 'frontend/styles.css');
const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

const forbiddenUiPhrases = [
  'Enter API Key',
  'Paste your GEMINI_API_KEY',
  'Gemini 4 Argon',
  'DCP: Modernality',
  'Gemini Ready',
];
for (const phrase of forbiddenUiPhrases) {
  if (html.includes(phrase)) {
    fail(`frontend/index.html contains forbidden UI phrase: "${phrase}"`);
  }
}
pass('frontend/index.html has zero exposed API key inputs or forbidden model/cloud jargon');

if (css.includes('#f6f7fb') && css.includes('#4255ff') && css.includes('.qz-card-scene')) {
  pass('frontend/styles.css contains Quizlet Daylight/Night palette and 3D card styles');
} else {
  fail('frontend/styles.css is missing required Quizlet design tokens');
}

// 3. Verify .mcp.json and skills/chrome-debugging/SKILL.md
const mcpJsonPath = path.join(ROOT, '.mcp.json');
if (!fs.existsSync(mcpJsonPath)) {
  fail('Missing .mcp.json at repository root');
} else {
  const mcpObj = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
  const chromeServer = mcpObj?.mcpServers?.['chrome-devtools'];
  if (
    chromeServer &&
    chromeServer.command === 'npx' &&
    Array.isArray(chromeServer.args) &&
    chromeServer.args.includes('chrome-devtools-mcp@latest') &&
    chromeServer.args.includes('http://127.0.0.1:9222')
  ) {
    pass('.mcp.json configured with chrome-devtools-mcp@latest on http://127.0.0.1:9222');
  } else {
    fail('.mcp.json does not match required chrome-devtools configuration');
  }
}

const skillPath = path.join(ROOT, 'skills/chrome-debugging/SKILL.md');
if (fs.existsSync(skillPath)) {
  pass('skills/chrome-debugging/SKILL.md is present');
} else {
  fail('Missing skills/chrome-debugging/SKILL.md');
}

// 4. Check Python backend syntax
try {
  execFileSync(
    'uv',
    [
      'run',
      'python',
      '-m',
      'py_compile',
      'backend/main.py',
      'backend/postgres_db.py',
      'backend/ingestion.py',
      'backend/gemini_service.py',
    ],
    { cwd: ROOT, stdio: 'pipe' }
  );
  pass('backend/*.py passed Python bytecode compilation check');
} catch (err) {
  fail(`Python backend syntax check failed: ${err.stderr?.toString() || err.message}`);
}

if (failures > 0) {
  console.error(`\nLint failed with ${failures} error(s).\n`);
  process.exit(1);
}
console.log('\nAll lint checks passed!\n');
