# Playwright Patterns — Canonical Reference for Conduit framework

Scope: Angular 18 SPA at `https://conduit.bondaracademy.com/` + RealWorld API at `https://conduit-api.bondaracademy.com/api`. All citations point to playwright.dev, docs.qameta.io/allure.

---

## 1. Setup project + `storageState`

### `playwright.config.ts` shape

```ts
import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : Math.max(1, Math.ceil(os.cpus().length / 2)),
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
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { baseURL: process.env.BASE_URL ?? 'https://conduit.bondaracademy.com' },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: 'auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: 'auth/user.json' },
      dependencies: ['setup'],
    },
  ],
});
```

### `tests/auth.setup.ts`

```ts
import { test, request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { DataGenerator } from '../test-data/data-generator';
import { API_URL } from '../test-data/constants';

test('register a per-run user and persist JWT to storageState', async () => {
  const apiCtx = await request.newContext({ baseURL: API_URL });

  // 1. Register per-run unique user (avoids collisions on the shared demo).
  const user = DataGenerator.user();
  const reg = await apiCtx.post('users', { data: { user } });
  if (!reg.ok()) throw new Error(`register failed: ${reg.status()} ${await reg.text()}`);

  // 2. Re-login to obtain a fresh JWT (registration may include one; we want
  //    a guaranteed-valid token from the same endpoint the app will hit).
  const login = await apiCtx.post('users/login', { data: { user: { email: user.email, password: user.password } } });
  const body = await login.json();
  const token: string = body.user.token;

  // 3. Build a storageState-shaped object with the JWT in localStorage at the UI origin.
  //    The Angular app reads `localStorage.jwtToken` (confirmed during Phase 1).
  fs.mkdirSync('auth', { recursive: true });
  fs.writeFileSync(
    path.resolve('auth/user.json'),
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: process.env.BASE_URL ?? 'https://conduit.bondaracademy.com',
          localStorage: [{ name: 'jwtToken', value: token }],
        },
      ],
    }, null, 2),
  );

  await apiCtx.dispose();
});
```

> Sources: <https://playwright.dev/docs/auth>, <https://playwright.dev/docs/test-global-setup-teardown>.

### Why `addInitScript` is NOT needed in the shared project

`storageState` already materialises the `localStorage` entry at the right origin **before** any page navigates, so the Angular app reads `jwtToken` on bootstrap and considers the user logged in. `page.addInitScript` is only useful for tests that need a *different* token mid-run (e.g. switching users in a session).

If you DO need it:

```ts
await context.addInitScript(token => localStorage.setItem('jwtToken', token), otherToken);
// call BEFORE page.goto(...)
```

Source: <https://playwright.dev/docs/api/class-page#page-add-init-script>.

---

## 2. Custom fixture `apiArticle` (worker-scoped, auto)

```ts
// fixtures/article.fixture.ts
import { test as base, APIRequestContext } from '@playwright/test';
import { DataGenerator } from '../test-data/data-generator';
import { API_URL } from '../test-data/constants';

type ApiArticle = { slug: string; title: string };

export type WorkerFixtures = {
  _apiArticlePool: ApiArticle[];
};

export type Fixtures = {
  apiArticle: ApiArticle;
};

export const test = base.extend<Fixtures, WorkerFixtures>({
  // Worker-scoped auto fixture: collects every article the worker creates,
  // then DELETEs them all on worker teardown — regardless of test outcome.
  _apiArticlePool: [
    async ({ request }, use) => {
      const pool: ApiArticle[] = [];
      await use(pool);
      await Promise.all(
        pool.map(async ({ slug }) => {
          try {
            await request.delete(`${API_URL}/articles/${encodeURIComponent(slug)}`);
          } catch (e) {
            // swallow — test already failed; don't mask with cleanup error
          }
        }),
      );
    },
    { scope: 'worker', auto: true },
  ],

  apiArticle: async ({ request, _apiArticlePool }, use, testInfo) => {
    const article = DataGenerator.article();
    const res = await request.post(`${API_URL}/articles`, { data: { article } });
    const body = await res.json();
    const slug = body.article.slug;
    _apiArticlePool.push({ slug, title: article.title });
    testInfo.annotations.push({ type: 'created-article', description: slug });
    await use({ slug, title: article.title });
  },
});

export { expect } from '@playwright/test';
```

- `testInfo` (3rd arg of the fixture function) is the canonical way to read test metadata; `testInfo.annotations.push` adds visible decorations to the report.
- Worker scope = one fixture per worker; teardown runs once after the last test in that worker.
- Source: <https://playwright.dev/docs/test-fixtures#worker-scoped-fixtures>.

---

## 3. Bypass shared `storageState` in one test

```ts
// tests/login-ui.spec.ts
test.use({ storageState: { cookies: [], origins: [] } });

test('login via the UI', async ({ page }) => {
  await page.goto('/login');
  // ... exercise the login form
});
```

- `storageState: { cookies: [], origins: [] }` is the canonical "fresh context" override.
- `storageState: undefined` does NOT override — Playwright falls back to the project default.
- Source: <https://playwright.dev/docs/api/class-testoptions#test-options-storage-state>.

---

## 4. Allure wiring

```bash
npm i -D allure-playwright allure-commandline
```

In `playwright.config.ts`:
```ts
reporter: [
  ['list'],
  ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ['allure-playwright', { outputFolder: 'allure-results' }],
],
```

CLI:
```bash
npx allure generate ./allure-results --clean -o ./allure-report
npx allure open ./allure-report
```

Sources: <https://allurereport.org/docs/playwright/>, <https://www.npmjs.com/package/allure-playwright>.

---

## 5. Cross-browser + retries + tracing config keys

```ts
use: {
  baseURL: 'https://conduit.bondaracademy.com',
  trace: 'retain-on-failure',        // 'on' | 'off' | 'on-first-retry' | 'retain-on-failure'
  screenshot: 'only-on-failure',     // 'on' | 'off' | 'only-on-failure'
  video: 'retain-on-failure',        // 'on' | 'off' | 'retain-on-failure' | 'on-first-retry'
  actionTimeout: 10_000,
  navigationTimeout: 30_000,
},
retries: process.env.CI ? 2 : 0,
workers: process.env.CI ? 1 : Math.max(1, Math.ceil(os.cpus().length / 2)),
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox',  use: { ...devices['Desktop Firefox']  } },
  { name: 'webkit',   use: { ...devices['Desktop Safari']   } },
],
```

Source: <https://playwright.dev/docs/test-configuration>.

---

## 6. GitHub Actions

```yaml
name: playwright
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: allure-results
          path: allure-results/
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/
```

- Node 20 LTS (Playwright requires ≥18; 20 is current LTS).
- `--with-deps` installs OS libraries needed by headless browsers.
- `if: always()` ensures artifacts upload even when tests fail.
- Sources: <https://playwright.dev/docs/ci-intro#github-actions>, <https://github.com/actions/setup-node>.
