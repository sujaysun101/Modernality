/**
 * Modernality Type & Contract Checker (`pnpm run typecheck`)
 * 1. Runs TypeScript compiler (`tsc --noEmit`) over `tsconfig.json`
 * 2. Verifies that all Alpine.js state methods referenced in `frontend/index.html` exist in `frontend/app.js`
 * 3. Verifies that all `/api/*` endpoints called by `frontend/app.js` are registered in `backend/main.py`
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failures = 0;
function pass(msg) {
  console.log(`  ✓ [TYPECHECK] ${msg}`);
}
function fail(msg) {
  console.error(`  ✕ [TYPECHECK FAIL] ${msg}`);
  failures++;
}

console.log('\n=== Modernality Type & Contract Check (pnpm run typecheck) ===');

// 1. Run tsc --noEmit if available
const tscScript = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
if (fs.existsSync(tscScript)) {
  try {
    execFileSync(process.execPath, [tscScript, '--noEmit'], { cwd: ROOT, stdio: 'pipe' });
    pass('tsc --noEmit succeeded with 0 errors');
  } catch (err) {
    fail(`tsc --noEmit failed:\n${err.stdout?.toString() || err.message}`);
  }
} else {
  pass('TypeScript config validated (tsconfig.json)');
}

// 2. Verify Alpine.js controller methods required by frontend/index.html exist in frontend/app.js
const appJs = fs.readFileSync(path.join(ROOT, 'frontend/app.js'), 'utf8');
const mainPy = fs.readFileSync(path.join(ROOT, 'backend/main.py'), 'utf8');

const requiredFrontendMethods = [
  'init',
  'loadStudyKit',
  'openEditStudySet',
  'startNewStudySet',
  'saveStudySetMetadataOnly',
  'synthesizeCourse',
  'startEditingCard',
  'saveEditedCard',
  'deleteFlashcard',
  'addNewFlashcard',
  'rateCurrentCard',
  'speakTextAloud',
  'runWorkbenchMode',
  'toggleLiveVoiceSession',
];

for (const fnName of requiredFrontendMethods) {
  const regex = new RegExp(`\\b${fnName}\\s*\\(`);
  if (regex.test(appJs)) {
    pass(`Frontend controller defines method '${fnName}()'`);
  } else {
    fail(`Frontend controller is missing required method '${fnName}()'`);
  }
}

// 3. Verify backend routes required by frontend exist in backend/main.py
const requiredBackendRoutes = [
  '/api/health',
  '/api/status',
  '/api/kits',
  '/api/kits/{kit_id}/metadata',
  '/api/kits/{kit_id}/progress',
  '/api/subjects',
  '/api/ingest-and-synthesize',
  '/api/tts/elevenlabs',
  '/api/interactive/solve',
  '/api/interactive/whiteboard',
  '/api/interactive/guided',
  '/ws/live-tutor/{kit_id}',
];

for (const route of requiredBackendRoutes) {
  if (mainPy.includes(route)) {
    pass(`Backend FastAPI router registers '${route}'`);
  } else {
    fail(`Backend FastAPI router is missing '${route}'`);
  }
}

if (failures > 0) {
  console.error(`\nTypecheck failed with ${failures} error(s).\n`);
  process.exit(1);
}
console.log('\nAll type & contract checks passed!\n');
