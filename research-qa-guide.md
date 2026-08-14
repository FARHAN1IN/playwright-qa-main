# Research & Implementation Guide: Playwright QA Framework for Conduit (BondarAcademy)


## 1. Research Summary

- **App under test (UI):** `https://conduit.bondaracademy.com/` — an Angular "RealWorld/Medium clone" called Conduit.
- **Backend API:** `https://conduit-api.bondaracademy.com/api` — REST API used for register/login, articles, comments, tags, profiles, favorites. This follows the standard [RealWorld API spec](https://github.com/gothinkster/realworld/tree/main/api) (same shape as the reference `conduit.productionready.io` API), so endpoints like `POST /users/login`, `POST /articles`, `PUT /articles/:slug`, `DELETE /articles/:slug`, `GET /tags`, `PUT /user` are expected to exist and return `Authorization: Token <jwt>`-style auth.
- Auth token returned on login/register (`response.user.token`) must be sent as `Authorization: Token <jwt>` header for authenticated API calls (create/edit/delete article, update settings).
- Because this is a **shared public demo environment**, tests must use **dynamically generated data** (unique usernames/emails/article titles per run) rather than fixed seed data, to avoid collisions between parallel runs/CI runs/other students using the same site.
- No staging API exists publicly (`staging.conduit.bondaracademy.com` fails to resolve) — target only the production-like public instance above.

## 2. Architecture Decisions

| Concern | Decision |
|---|---|
| Language | TypeScript, `@playwright/test` |
| Design pattern | Page Object Model (POM) + API client classes, separated from test specs and test data |
| Auth strategy | Programmatic login via API (`POST /users/login` or `/users`) → save `storageState` (localStorage/cookies) once per project/browser → reuse via Playwright `storageState` project config, avoiding UI login in every test |
| Pre-conditions (Edit/Delete Article) | Create article via API request fixture before test runs, capture slug, clean up after test |
| Test data | `@faker-js/faker` for random titles, bodies, tags, emails, passwords |
| Locators | Prefer `getByRole`, `getByLabel`, `getByTestId`/`getByPlaceholder` over brittle CSS/XPath; centralize all locators inside Page Objects only |
| Retries/flake control | `test.retry()` in CI config, `expect.poll`/web-first assertions, no hard `waitForTimeout` |
| Reporting | Playwright HTML reporter + Allure reporter (`allure-playwright`) |
| Tracing | `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'` |
| Cross-browser | `projects` for chromium, firefox, webkit |
| Parallelism | `fullyParallel: true`, sharded workers |
| CI/CD | GitHub Actions workflow running on push/PR, uploading HTML + Allure + trace artifacts |

## 3. Folder Structure to Produce

```
conduit-playwright-framework/
├── .github/workflows/playwright.yml
├── playwright.config.ts
├── tsconfig.json
├── package.json
├── .env.example
├── test-data/
│   ├── data-generator.ts        # faker-based factories (user, article, comment)
│   └── constants.ts             # static config (base urls, timeouts)
├── api/
│   ├── api-client.ts            # thin request-context wrapper (auth, articles, users)
│   └── endpoints.ts
├── pages/
│   ├── base.page.ts
│   ├── login.page.ts
│   ├── register.page.ts
│   ├── home.page.ts             # global feed, tags sidebar
│   ├── editor.page.ts           # create/edit article form
│   ├── article.page.ts          # article detail view
│   └── settings.page.ts
├── fixtures/
│   ├── auth.fixture.ts          # extends base test, provides authenticated page + storageState
│   └── article.fixture.ts       # provides "createArticleViaApi" pre-condition + cleanup
├── tests/
│   ├── article-create.spec.ts
│   ├── article-edit.spec.ts
│   ├── article-delete.spec.ts
│   ├── article-filter-by-tag.spec.ts
│   └── user-settings.spec.ts
├── auth/                        # generated storageState json (gitignored)
├── utils/
│   └── helpers.ts
└── README.md
```

## 4. Scenario-Level Test Plan (positive + negative)

1. **Create New Article** (UI)
   - Positive: logged-in user fills title/description/body/tags in editor → submits → redirected to article page → title, body, tag(s), author visible → article appears in "My Articles"/global feed.
   - Negative: submit with empty required field(s) → stays on editor, inline validation/error shown, no navigation, no article created (verify via API that no new article with that title exists).

2. **Edit Article** (API pre-condition)
   - Pre-condition: create article via API using authenticated token, capture slug.
   - Positive: navigate directly to article → open editor → change title/body → submit → redirected to article page with updated slug/title/body → confirm via API GET that persisted values match.
   - Negative: clear the title field and submit → validation error / prevented submit → original article unchanged (verify via API).

3. **Delete Article** (API pre-condition)
   - Pre-condition: create article via API, capture slug.
   - Positive: open article → click Delete → confirmation/redirect to home → article no longer in feed → API GET for slug returns 404.
   - Negative: attempt to delete an article the current user does not own (e.g., seeded by a different API-created user) → Delete button not visible/disabled, or API call returns 403/422 and UI shows no removal.

4. **Filter Articles by Tag**
   - Positive: click a tag in the Popular Tags sidebar → feed updates to "Articles tagged with <tag>" → every visible article card includes that tag → tag pill highlighted as active.
   - Negative: filter by a tag known to have zero articles (create via API a uniquely random tag, don't attach it to any article, or use a nonsense tag through direct URL) → empty state message shown, no article cards rendered.

5. **Update User Settings**
   - Positive: authenticated user changes bio/URL/username (or one safely-editable field) → Update Settings → success indication (redirect to profile / updated field visible) → reload page confirms persistence.
   - Negative: attempt invalid input (e.g., malformed image URL, or empty required username) → inline/server validation error displayed, settings not persisted (reload confirms old value unchanged).

> Note: exact selectors/copy (button text, error message wording) must be confirmed by Puku CLI actually visiting the live site during implementation (see Phase 1 of the prompt) — don't hardcode assumptions from this plan.

## 5. Risks Called Out to Watch For

- Shared/public test environment → **always use randomized unique data**; never assert on global feed counts, only on data you created.
- Angular app may have async loading spinners/animations → use web-first `expect(locator).toBeVisible()` polling, not fixed waits.
- Article slugs are derived from titles; duplicate titles across parallel workers could collide — always suffix titles with a random string/timestamp.
- Confirm actual validation behavior (client-side vs server-side) before writing negative-test assertions, since it directly affects locators used.