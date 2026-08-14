import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';

/**
 * Playwright config for the Conduit (BondarAcademy) E2E framework.
 *
 * - Three browser projects (chromium / firefox / webkit) share an authenticated
 *   storageState produced by the `setup` project (see tests/auth.setup.ts).
 * - Locally we run fully parallel with workers = ceil(cpu/2) for speed.
 * - In CI we serialise (workers = 1) and retry flaky tests once.
 */
export default defineConfig({
  testDir: './tests',
  // We restrict parallelism because the target is a shared public demo whose
  // backend gets flaky under concurrent load. We use 2 workers locally
  // (best-effort speed) and 1 in CI (deterministic).
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,

  // Trace/screenshot/video only on failure — keeps storage tiny.
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['allure-playwright', { outputFolder: 'allure-results' }],
  ],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://conduit.bondaracademy.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  // The shared public demo's API can be slow under load. Give individual
  // tests plenty of headroom — each test orchestrates multiple UI steps
  // plus 1-2 API round-trips.
  timeout: 60_000,

  // The shared auth state is consumed by all three browser projects below
  // and is produced by the `setup` project.
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { baseURL: process.env.BASE_URL ?? 'https://conduit.bondaracademy.com' },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
