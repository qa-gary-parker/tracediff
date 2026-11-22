import { defineConfig } from '@playwright/test';
import path from 'node:path';

const out = path.join(import.meta.dirname, '.out');

export default defineConfig({
  testDir: path.join(import.meta.dirname, 'tests'),
  outputDir: path.join(out, 'test-results'),
  reporter: 'list',
  workers: 1,
  use: {
    headless: true,
    viewport: { width: 480, height: 360 },
    trace: { mode: 'on', screenshots: false, snapshots: true, sources: false },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
