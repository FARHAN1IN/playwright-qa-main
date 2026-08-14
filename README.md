# Playwright QA — Conduit (BondarAcademy)

Production-quality Playwright + TypeScript end-to-end framework targeting the
shared public demo at:

| Surface    | URL                                                          |
| ---------- | ------------------------------------------------------------ |
| UI (SPA)   | `https://conduit.bondaracademy.com/` (Angular 18, CSR)      |
| REST API   | `https://conduit-api.bondaracademy.com/api` (RealWorld spec) |

The framework covers five PRD scenarios — Create / Edit / Delete Article,
Filter Articles by Tag, Update User Settings — each with a positive and
negative case, plus a bonus Login-UI spec. It runs across Chromium, Firefox,
and WebKit and produces HTML + Allure reports with traces, screenshots and
video on failure.

---

## Quickstart

```bash
npm ci
npx playwright install --with-deps   # one-time: download browser binaries
npm run test:chromium                # fastest feedback (single project)
```

Open the HTML report after a run:

```bash
npm run test:report
```

Generate + open the Allure report:

```bash
npm run allure:generate
npm run allure:open
```

---

## Project layout

```
playwright-qa/
├── .github/workflows/playwright.yml   # CI: install, test, upload artifacts
├── .env.example                       # BASE_URL, API_URL (committed)
├── api/
│   ├── endpoints.ts                   # /api/... path constants
│   └── api-client.ts                  # typed wrapper over APIRequestContext
├── auth/user.json                     # generated, gitignored
├── fixtures/
│   ├── auth-fixture.ts                # shared test with bypass-storageState
│   └── article.fixture.ts             # apiArticle fixture (worker teardown)
├── pages/
│   ├── base.page.ts                   # BasePage — goto, waitForUrlNotMatching
│   ├── login.page.ts
│   ├── register.page.ts
│   ├── home.page.ts
│   ├── editor.page.ts
│   ├── article.page.ts
│   └── settings.page.ts
├── test-data/
│   ├── constants.ts                   # BASE_URL, API_URL, JWT key, ROUTES
│   └── data-generator.ts              # faker-based user/article/settings
├── tests/
│   ├── auth.setup.ts                  # setup project — register + persist JWT
│   ├── article-create.spec.ts
│   ├── article-edit.spec.ts
│   ├── article-delete.spec.ts
│   ├── article-filter-by-tag.spec.ts
│   ├── user-settings.spec.ts
│   └── login-ui.spec.ts               # bonus — bypasses shared auth
└── utils/
    ├── helpers.ts                     # slugify, expectViaApi
    └── auth-storage.ts                # loadAuthToken() reads auth/user.json
```

---

## How authentication works (per-run unique user)

The Angular SPA reads its JWT from `localStorage.jwtToken` at the UI origin
(confirmed during Phase 1 exploration — see `.exploration/ui-notes.md`). The
`auth.setup.ts` Playwright setup project:

1. Generates a fresh `DataGenerator.user()` with a unique username/email
   suffix (`${Date.now()}-${randomAlpha(6)}`). This avoids collision on the
   shared public demo.
2. Registers via `POST /api/users`, then logs in via `POST /api/users/login`
   to obtain a fresh JWT.
3. Writes a `storageState`-shaped JSON file to `auth/user.json` containing
   only `{ name: 'jwtToken', value: token }` at the UI origin.

The Chromium / Firefox / WebKit projects then load `auth/user.json`
automatically (no UI login needed per-test) and start already authenticated.

The `login-ui.spec.ts` bonus test bypasses the shared auth via:

```typescript
test.use({ storageState: { cookies: [], origins: [] } });
```

…then drives the login form directly with freshly-seeded credentials.

---

## How test isolation works (apiArticle fixture)

`fixtures/article.fixture.ts` exports a worker-scoped **auto fixture**
(`apiArticle`) that creates one article per test via the API and pushes the
slug into a worker-local pool. When the worker tears down, every slug in the
pool is deleted via `DELETE /api/articles/:slug` — so even on a failed test
the shared public demo isn't littered with leftover articles.

Usage:

```typescript
import { test, expect } from '../fixtures/article.fixture';

test('does something', async ({ page, request, apiArticle }) => {
  // apiArticle.slug + apiArticle.title available immediately.
});
```

---

## How reporting works

| Reporter          | Output dir            | How to view                     |
| ----------------- | --------------------- | ------------------------------- |
| `list`            | stdout                | inline                          |
| `html`            | `playwright-report/`  | `npm run test:report`           |
| `allure-playwright` | `allure-results/`   | `npm run allure:generate && npm run allure:open` |

On failure, the following land in `test-results/<spec>-<browser>/`:

- `trace.zip` — full Playwright trace (open with `npx playwright show-trace <path>`)
- `video.webm` — screen recording
- `test-failed-1.png` — final-page screenshot
- `error-context.md` — Playwright-generated failure summary

The GitHub Actions workflow uploads all three directories as artifacts on
every run (success or failure), with 14-day retention.

---

## Running cross-browser

```bash
npm test                    # all 3 browsers, default workers (CPU/2 locally, 1 in CI)
npm run test:chromium       # just Chromium
npm run test:firefox        # just Firefox
npm run test:webkit         # just WebKit
npm run test:headed         # headed mode (requires display)
```

Local workers: `Math.max(1, Math.ceil(os.cpus().length / 2))`.
CI workers: `1` — the shared demo gets rate-limited under parallel load.

---

## Quirks worth knowing

These are documented in `.exploration/ui-notes.md` and `.exploration/api-notes.md`
(Phase 1 findings). Highlights:

- **JWT key is `jwtToken`** (not `jwt`, not `user`). The BondarAcademy fork
  diverges from the canonical RealWorld frontend here.
- **Tag filter does NOT change the URL**. The UI uses client-side state only;
  the visible indicator is a 3rd `.feed-toggle` pill with `<i class="ion-pound">`.
- **Forms have no `name` attrs** — only `formcontrolname` and `placeholder`.
  Use `getByPlaceholder(...)`, never `input[name=...]`.
- **Delete has no confirm dialog** — click is direct, then immediate navigation.
- **Settings form does NOT pre-populate from `GET /user`** — every field is
  empty on load. The server silently treats empty fields as "no change".
- **Slug regenerates on `PUT /articles/:slug`** when the title changes; capture
  the new slug from the response, never hardcode it.

---

## Cross-browser notes

The framework is configured for **Chromium, Firefox, and WebKit**. Chromium and
Firefox work out of the box on Linux. WebKit needs a few extra system
libraries that only the CI runner installs by default:

```bash
sudo npx playwright install-deps
```

If you don't run WebKit locally, that's fine — the CI matrix will catch any
WebKit-specific regressions. To skip it locally use `--project=chromium` or
`--project=firefox`.

## Troubleshooting

- **`auth/user.json` is stale or missing** — delete it and re-run. The setup
  project regenerates it on every run.
- **`net::ERR_BLOCKED_BY_CLIENT` on the API call** — usually CORS-related;
  the API only allows the production UI origin. Playwright's `request`
  context bypasses this, so the issue is usually browser-side (e.g. an ad
  blocker).
- **Worker scale-up warnings** — `fullyParallel: false` plus 2 workers
  locally is intentional. The shared public demo gets flaky under heavier
  concurrent load; bump to 4 only if you have a fast private staging
  environment.
