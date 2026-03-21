import { defineConfig } from '@playwright/test';

/** Load `dist/renderer` from disk when app is not packaged (Playwright / CI). */
process.env.OPAL_USE_DIST = '1';

export default defineConfig({
    testDir: 'e2e',
    timeout: 120_000,
    expect: { timeout: 45_000 },
    fullyParallel: false,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
});
