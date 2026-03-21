import path from 'path';
import { test, expect } from '@playwright/test';
import { _electron as electron } from '@playwright/test';

const projectRoot = path.resolve(__dirname, '..');

test.describe('Opal AI Tutor (Electron)', () => {
    test('main window shows Solution mode', async () => {
        const electronApp = await electron.launch({
            cwd: projectRoot,
            args: ['.'],
            env: {
                ...process.env,
                OPAL_USE_DIST: '1',
                NODE_ENV: 'production',
            },
        });

        try {
            const window = await electronApp.firstWindow();
            await window.waitForLoadState('domcontentloaded');
            await expect(window.getByRole('button', { name: 'Solution' })).toBeVisible();
        } finally {
            await electronApp.close();
        }
    });
});
