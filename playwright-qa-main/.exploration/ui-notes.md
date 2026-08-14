# Live UI exploration — Conduit (BondarAcademy) Angular SPA

**Tooling:** headless Chromium via `@playwright/test`.
**Sites:** UI `https://conduit.bondaracademy.com/` (CSR Angular 18), API `https://conduit-api.bondaracademy.com/api`.

This is a **client-side rendered Angular 18 app** — `index.html` ships an empty `<app-root></app-root>` shell + `styles-7JQYGRL6.css` + chunked JS bundles (no SSR). All forms, navbar and feed are rendered by Angular after JS boots, so the test driver **must wait for hydration** (`waitUntil: 'networkidle'` + a short post-load delay, or `waitForSelector('form')`). The empty root before hydration means `getByPlaceholder()` on the first paint will time out.

## 1. Critically important: JWT localStorage key

The Angular app reads its JWT from `localStorage.jwtToken` (string, not JSON). This is the **only** key the app uses for auth — no `user`, no `jwt`, no `authToken` (the standard realworld frontend uses one of those names; this BondarAcademy fork uses `jwtToken`).

Confirmed by: seeded only `localStorage['jwtToken'] = <token>`, then navigated to `/settings` — settings form, logout button, and profile link all rendered as if logged in.

```
{ jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
```

Implication for `auth.setup.ts`: only seed `jwtToken`. Do **not** seed `user` or other keys — the app ignores them.

## 2. StorageState caveat

Because the Angular app reads `localStorage` synchronously on bootstrap, we must seed it **before** the first page load. Two safe patterns:

1. `page.addInitScript(token => localStorage.setItem('jwtToken', token), token)` before `page.goto('/')` (used in tests that need a logged-in page mid-run, e.g. fixture-driven).
2. Pre-write `auth/user.json` with an entry of shape:
   ```json
   { "cookies": [], "origins": [{ "origin": "https://conduit.bondaracademy.com", "localStorage": [{ "name": "jwtToken", "value": "<jwt>" }] }] }
   ```
   Then `use: { storageState: 'auth/user.json' }` is the canonical project-level injection.

## 3. Forms — actual placeholder-only fields (no `name` attrs)

The app uses Angular Reactive Forms via `formcontrolname="..."` only — **there are NO `name` attributes and NO `required` attributes** on inputs. Locators MUST use `getByPlaceholder()` or `getByRole('textbox', { name: <placeholder> })`. CSS selectors like `input[name=email]` will NOT match.

### 3a. Register (`/register`)
| Field        | Placeholder       | Type   | locator                                            |
| ------------ | ----------------- | ------ | -------------------------------------------------- |
| Username     | `Username`        | text   | `page.getByPlaceholder('Username')`                |
| Email        | `Email`           | text   | `page.getByPlaceholder('Email')`                   |
| Password     | `Password`        | pass   | `page.getByPlaceholder('Password')`                |
| Submit       | —                 | button | `page.getByRole('button', { name: 'Sign up' })`    |

### 3b. Login (`/login`)
| Field        | Placeholder | Type   | locator                                            |
| ------------ | ----------- | ------ | -------------------------------------------------- |
| Email        | `Email`     | text   | `page.getByPlaceholder('Email')`                   |
| Password     | `Password`  | pass   | `page.getByPlaceholder('Password')`                |
| Submit       | —           | button | `page.getByRole('button', { name: 'Sign in' })`    |

### 3c. Editor (`/editor` create, `/editor/:slug` edit)
| Field         | Placeholder                          | Type     | locator                                                    |
| ------------- | ------------------------------------ | -------- | ---------------------------------------------------------- |
| Title         | `Article Title`                      | text     | `page.getByPlaceholder('Article Title')`                   |
| Description   | `What's this article about?`         | text     | `page.getByPlaceholder("What's this article about?")`      |
| Body          | `Write your article (in markdown)`   | textarea | `page.getByPlaceholder('Write your article (in markdown)')` |
| Tags          | `Enter tags`                         | text     | `page.getByPlaceholder('Enter tags')`                     |
| Submit        | —                                    | button   | `page.getByRole('button', { name: /Publish Article/ })`    |

Tags are entered as plain text — when the user types the tag and the field **loses focus** or **clicks Publish**, the input is parsed comma/space-separated into chips inside a sibling `<div class="tag-list">`. Empty `Enter tags` + Publish is allowed (article can have no tags).

### 3d. Settings (`/settings`)
| Field        | Placeholder                  | Type    | locator                                              |
| ------------ | ---------------------------- | ------- | ---------------------------------------------------- |
| Profile pic  | `URL of profile picture`     | text    | `page.getByPlaceholder('URL of profile picture')`    |
| Username     | `Username`                   | text    | `page.getByPlaceholder('Username')`                  |
| Bio          | `Short bio about you`        | textarea| `page.getByPlaceholder('Short bio about you')`       |
| Email        | `Email`                      | email   | `page.getByPlaceholder('Email')`                     |
| New Password | `New Password`               | pass    | `page.getByPlaceholder('New Password')`              |
| Submit       | —                            | button  | `page.getByRole('button', { name: /Update Settings/ })` |
| Logout       | —                            | button  | `page.getByRole('button', { name: /logout/i })`        |

### 3e. Error message region

All forms wrap their inputs in:
```html
<app-list-errors><ul class="error-messages">…</ul></app-list-errors>
```
Concrete text observed (from server errors):
- Wrong password login: `"email or password is invalid"` (single error string, key unquoted but indexed)
- For all server errors, render as `<li>key value</li>` items inside `ul.error-messages`.

Empty form submits **do NOT trigger HTML5 validation** (no `required` attrs); the SPA submits and the server returns 422 with the per-field error. The page does NOT navigate. The `error-messages` `<ul>` populates.

### 3f. Settings form — critically important quirks

The `/settings` form has **three quirks** that are easy to miss:

1. **No pre-population** — the form is **entirely empty** on load. `GET /user` is NOT called on page render; the user must fill every field from scratch (or trust server-side "no change" semantics for empty fields).
2. **Empty fields are silently ignored** by the server (`PUT /user` with `{"user":{"username":"", "email":"", "bio":"", "image":"", "password":""}}` returns `200` with the user object **unchanged**). There is no client-side or server-side validation that surfaces these as errors.
3. **After a successful PUT, the SPA navigates to `/profile/<username>`** — not back to `/settings`. There is no success toast, no remaining form. A second visit to `/settings` re-renders the empty form.

**Implication for the user-settings spec**:
- The "positive" test should verify bio persistence via `GET /user` (API), not by reloading the form (which is always empty).
- The "negative" test cannot reliably trigger an error message — the SPA renders no errors for empty fields. The defensible negative assertion is: fill **only the bio field** with new data and submit (leaving username/email blank), then verify via `GET /user` that the bio was updated but username/email were unchanged (i.e. the server's "no-change on empty" semantics worked).
- The previous assumption that clearing the username produces a `ul.error-messages` entry is **WRONG** — the server silently ignores the empty string.

## 4. Navigation links (top-bar)

`<nav class="navbar navbar-light">` always present. Anchor locators:

| Link text             | href              | locator                                                            |
| --------------------- | ----------------- | ------------------------------------------------------------------ |
| `conduit` (logo)      | `/`               | `page.getByRole('link', { name: 'conduit' })`                      |
| `Home`                | `/`               | `page.getByRole('link', { name: /^Home$/ })`                       |
| `New Article`         | `/editor`         | `page.getByRole('link', { name: /New Article/ })`                  |
| `Settings`            | `/settings`       | `page.getByRole('link', { name: /^Settings$/ })`                   |
| `<username>` (logged) | `/profile/<name>` | `page.getByRole('link', { name: <username> })` (last nav link)     |
| `Sign in`             | `/login`          | `page.getByRole('link', { name: /sign in/i })`                     |
| `Sign up`             | `/register`       | `page.getByRole('link', { name: /sign up/i })`                     |

**Logged-in indicator**: the `<username>` text in the top-nav right-side list. Confirmed working.

## 5. Home page feed + tag filter

URL: `/`.
Tabs (`.feed-toggle ul.nav-pills`):
- `.feed-toggle a:has-text("Your Feed")` — disabled / non-clickable when not following anyone
- `.feed-toggle a:has-text("Global Feed")` — always present, default active
- `.feed-toggle a:has-text('<tag>')` — appears as a 3rd pill with `<i class="ion-pound">` icon when a tag filter is active

Sidebar (`.sidebar`):
- Text "Popular Tags" inside `.sidebar p` (used as header assert)
- Tag pills: `.sidebar a.tag-pill` — list of tag strings, NO `href`. Clicking one filters the feed but **DOES NOT CHANGE THE URL** (URL stays `/`). The visible filter state is the 3rd `.feed-toggle` pill with `class="nav-link active"` and `<i class="ion-pound">`.

**Tag filter URL**: there is NO query-param routing — the URL stays at `/`. Tests must assert on the feed-toggle pill (`expect(thirdPill).toContainText('Test')`) and the filtered article count, not the URL.

Article preview card structure (inside `.feed-toggle .col-md-9 app-article-list app-article-preview`):
```
<a class="preview-link" href="/article/<slug>">
  <h1>title</h1>
  <p>description</p>
  <span>Read more...</span>
  <ul class="tag-list">
    <li class="tag-default tag-pill tag-outline"> tagname </li>
  </ul>
</a>
```
Card count: `page.locator('app-article-preview').count()`.

**Article pill on a card** (e.g. `li.tag-default.tag-pill:has-text('qa career')`) — clicking should filter the feed to that tag (same mechanism as sidebar).

## 6. Article detail page (`/article/<slug>`)

DOM:
- `.banner.page-hero` → `.container` → article title `<h1 data-test="article-title">` (Angular template includes a `data-test` attr in some templates — verify per render; otherwise `h1` is unique inside the article page)
- `.article-content` for body
- `.tag-list .tag-pill` for the article's tags
- `.article-actions` → `<button class="btn btn-sm btn-outline-danger">Delete Article</button>` (only visible to the article's author)
- `<a class="btn btn-sm btn-outline-secondary">Edit Article</a>` (only to the author)

**Delete confirmation**: NO `window.confirm` dialog, NO custom modal — clicking "Delete Article" immediately sends `DELETE /api/articles/:slug` and navigates to `/`. (Confirmed with `page.on('dialog')` — no event fires.)

**Author visibility**: the `.article-actions` row only renders the Delete/Edit buttons **if the current user is the article author**. For the negative delete test (a different user), the buttons will be entirely absent — the spec must assert on absence, not on a disabled state.

## 7. URL patterns (final)

| Action                                | URL                                                    |
| ------------------------------------- | ------------------------------------------------------ |
| Home                                  | `/`                                                    |
| Login                                 | `/login`                                               |
| Register                              | `/register`                                            |
| Editor (create)                       | `/editor`                                              |
| Editor (edit)                         | `/editor/<slug>`                                       |
| Settings                              | `/settings`                                            |
| Article detail                        | `/article/<Slugified-Title-UserId>` (e.g. `/article/Create-UI-1786628272087-64358`) |
| Profile (other user)                  | `/profile/<username>`                                  |
| Tag filter                            | stays `/` (no query-string routing)                    |

Slug rules (server-side): kebab-case title + dash-suffixed unique id; PUT /articles/:slug regenerates the slug from the new title (`explore-title-1786627904-64356` → `updated-title-1786627904-64356`).

### 7a. Editor edit-mode FormControl race — IMPORTANT

The `/editor/<slug>` page fetches the article via `GET /api/articles/<slug>` and then calls `FormControl.setValue()` to populate the title/body/description/tags inputs **asynchronously**. The `<input>` elements render and become visible BEFORE `setValue()` runs. If a test does `editor.title.fill(newTitle)` immediately after `editor.waitForEditor()` (which only waits for visibility), the fill happens *before* the SPA's `setValue()`. Angular's `setValue()` then overwrites the filled value with the API-loaded value, and the click Publish button submits the *original* article.

This is a **deterministic race in CI but timing-dependent locally** — it fired 3/3 times in CI run 31730808495 (chromium + firefox, all 3 attempts each) and was silent in local runs. The PUT request body captured in the trace showed all original values, not the test's edited values.

**Fix in specs**: wait for `editor.title` to have the *expected loaded value* (`apiArticle.title`) before calling `.fill()`. After fill(), re-check the value to confirm the FormControl actually picked up the edit. The same pattern is needed for body (wait for non-empty value before re-filling).

This bug exists in BOTH edit and any other form that pre-populates from an API load (e.g. settings form, if pre-populate is ever fixed).

## 8. Things that surprised us / implicit behavior

- The Angular templates use **`placeholder` as the sole label**. Real Conduit (reference) ships with `placeholder` AND `formcontrolname` AND `name`; this fork omits `name`. `getByLabel()` won't work. We standardized on `getByPlaceholder()` everywhere.
- No HTML5 `required` attrs → empty-form submissions are sent to the server. The server returns 422 and populates the inline `.error-messages` list. Tests for "empty submit" must assert on `.error-messages` content, NOT browser `validationMessage`.
- **Feed-toggle 3rd pill** for an active tag is the only visual indicator of which tag is filtered — assert on that, not on the URL.
- The `a.tag-pill` elements in the sidebar have **no `href`** — clicking triggers an Angular route/state change (the URL doesn't change). They use `(click)="setListTag(tag)"` semantics. Use `.click()` after `waitFor()`-ing the element, never `page.goto()` to filter.
- The `Tags` API at `GET /api/tags` returns `{"tags":["Test","Blog",…]}` — same 10 tags that render in the sidebar, in the same order. We can use API tags to drive UI tag filter tests (positive) and a tag absent from `/api/tags` for the negative test.
- The article-card tag pills (inside `li.tag-default.tag-pill` within an article preview) trigger the same filter when clicked — useful for a positive filter test.
- `<app-list-errors><ul class="error-messages">` is the canonical place to wait for server validation errors in any form.

## 9. Locator cheat sheet (verified during exploration)

```typescript
// Auth/forms
page.getByPlaceholder('Username')
page.getByPlaceholder('Email')
page.getByPlaceholder('Password')
page.getByPlaceholder('Article Title')
page.getByPlaceholder("What's this article about?")
page.getByPlaceholder('Write your article (in markdown)')
page.getByPlaceholder('Enter tags')
page.getByPlaceholder('URL of profile picture')
page.getByPlaceholder('Short bio about you')
page.getByPlaceholder('New Password')

// Buttons
page.getByRole('button', { name: 'Sign in' })
page.getByRole('button', { name: 'Sign up' })
page.getByRole('button', { name: /Publish Article/ })
page.getByRole('button', { name: /Update Settings/ })
page.getByRole('button', { name: /Delete Article/ })
page.getByRole('button', { name: /logout/i })

// Nav
page.getByRole('link', { name: 'conduit' })
page.getByRole('link', { name: /^Home$/ })
page.getByRole('link', { name: /New Article/ })
page.getByRole('link', { name: /^Settings$/ })
page.getByRole('link', { name: <loggedInUsername> })

// Feed + tag filter
page.locator('.feed-toggle')                       // tabs container
page.locator('app-article-preview')                // each article card
page.locator('.sidebar .tag-pill', { hasText: '<tag>' })  // sidebar tag pill
page.locator('.sidebar')                           // right sidebar block
page.locator('ul.error-messages li')               // form error messages

// Article page
page.locator('h1')                                 // article title (usually unique on detail page)
page.locator('.article-content')                   // article body
page.locator('.article-actions')                   // delete/edit buttons region (author only)
```
