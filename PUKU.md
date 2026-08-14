# PUKU.md

This file provides guidance to puku-cli when working with code in this repository.

## What this project is

Playwright + TypeScript E2E framework targeting the **shared public demo** at
`https://conduit.bondaracademy.com/` (Angular 18 CSR SPA) with a REST API at
`https://conduit-api.bondaracademy.com/api` (RealWorld spec).

There is **no application code to modify** — only test/spec/fixture work. The
target is a deployed third-party site; we cannot change its behaviour.

## Commands

| Purpose | Command |
| --- | --- |
| Run all tests (all 3 browsers) | `npm test` |
| Run Chromium only | `npm run test:chromium` |
| Run Firefox only | `npm run test:firefox` |
| Run WebKit only (needs `sudo npx playwright install-deps` first) | `npm run test:webkit` |
| Run only the auth setup project | `npm run test:setup` |
| View HTML report | `npm run test:report` |
| Generate Allure HTML report (needs Java) | `npm run allure:generate` |
| Open Allure report | `npm run allure:open` |
| Type-check | `npm run typecheck` (= `npm run lint`) |

Local workers = 2, CI workers = 1, retries = 2 in CI / 0 locally. See
`playwright.config.ts` — do not bump workers locally; the shared public demo
gets flaky under heavier concurrent load.

## Critical quirks (target app behaviour)

These are verified in `.exploration/ui-notes.md` and `.exploration/api-notes.md`.
Read those files in full when editing specs — they are the source of truth.

- **JWT localStorage key is `jwtToken`** (not `jwt`, not `user`). The
  Angular fork diverges from canonical RealWorld. Seed only this key in
  `auth/setup.ts`.
- **Forms have no `name` or `required` attrs** — only `formcontrolname` and
  `placeholder`. Use `getByPlaceholder(...)`, never `input[name=...]`.
- **Tag filter does NOT change the URL** — URL stays at `/`. The only
  visible indicator is a 3rd `.feed-toggle` pill with an `<i class="ion-pound">`.
- **Delete has no confirm dialog** — click is direct, then immediate navigation.
- **Settings form does NOT pre-populate from `GET /user`** — every field is
  empty on load. The server **silently treats empty fields as "no change"**
  (returns 200 with unchanged user). Never assert "negative" by clearing
  username and expecting an error message; the SPA renders no error. Assert
  the correct semantic: blank username ⇒ username preserved via API.
- **Slug regenerates on `PUT /articles/:slug`** when title changes. Capture
  the new slug from the response, never hardcode.
- **Auth header is `Authorization: Token <jwt>`** (NOT `Bearer`).
- **Username AND password both capped at 20 chars** — the server returns 422
  `is too long` above that. `DataGenerator` clamps both.

## Conventions

- **Page objects** expose only **actions** and **getters** (no `expect()`).
  Web-first assertions live in specs.
- **ApiClient owns its own baseURL** via `fullUrl()` — never pass UI's
  `baseURL` to a request fixture, or you'll get a `baseURL` leak.
- **`page.waitForURL` does NOT accept a function predicate** — use
  `BasePage.waitForUrlNotMatching` which delegates to `page.waitForFunction`
  with the regex source.
- **Tests sharing the same authenticated user MUST run serially** — use
  `test.describe.configure({ mode: 'serial' })` at the top of the describe.
  Otherwise concurrent PUTs race and one overwrites the other. See
  `tests/user-settings.spec.ts` for the canonical example.
- **Fixtures that mutate state MUST register cleanup** — `apiArticle` and
  `article-create` positive both push into the worker-scoped
  `_apiArticlePool` so leftover articles are deleted on worker teardown.

## File map

| Concern | Location |
| --- | --- |
| TS strict, `moduleResolution: bundler` (TS 7 removed `"node"`) | `tsconfig.json` |
| Projects, reporters, timeouts, storageState | `playwright.config.ts` |
| One browser per project, shared `auth/user.json` | `playwright.config.ts` |
| Endpoints (`/api/...`) | `api/endpoints.ts` |
| Typed API wrapper | `api/api-client.ts` |
| Test data factories (faker, 20-char clamp) | `test-data/data-generator.ts` |
| Base URLs, JWT key, route constants | `test-data/constants.ts` |
| Page objects (POM — actions + getters only) | `pages/*.page.ts` |
| Worker-scoped auto-fixture with teardown | `fixtures/article.fixture.ts` |
| Specs (one per PRD scenario) | `tests/*.spec.ts` |
| Auth setup project (registers per-run user, writes JWT) | `tests/auth.setup.ts` |
| Live target app quirks (verified notes) | `.exploration/ui-notes.md`, `.exploration/api-notes.md` |

## Required environment

- Node 20+ (CI pins Node 20; any 20+ works locally).
- Playwright browsers: `npx playwright install --with-deps` (one-time).
- WebKit on Linux additionally needs `sudo npx playwright install-deps`.
- Java (only for Allure HTML report generation) — not needed for raw
  `allure-results/*.json` output, which CI uploads as an artifact.

## Git / commit hygiene

- `auth/user.json` is **gitignored** (per-run JWT) — never commit.
- `playwright-report/`, `test-results/`, `allure-results/`, `allure-report/`
  are all gitignored.
- `.exploration/` is committed and is the source of truth for target-app
  quirks. Update it when you discover new behaviour.
