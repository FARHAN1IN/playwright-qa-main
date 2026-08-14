// test-data/constants.ts
// Centralised configuration for URLs, timeouts, and frequently-used fixtures.

export const BASE_URL = process.env.BASE_URL ?? 'https://conduit.bondaracademy.com';

/**
 * Bare API origin — endpoints paths in `api/endpoints.ts` start with `/api/...`.
 * Use this for Playwright's `request.newContext({ baseURL })`.
 */
export const API_URL = process.env.API_URL ?? 'https://conduit-api.bondaracademy.com';

/** Angular SPA reads JWT from this localStorage key (confirmed via Phase 1 exploration). */
export const JWT_LOCALSTORAGE_KEY = process.env.JWT_LOCALSTORAGE_KEY ?? 'jwtToken';

/** Auth header format used by the API. */
export const AUTH_HEADER = 'Authorization';

/** Common URL fragments. */
export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  editor: '/editor',
  settings: '/settings',
};

/** Article URL pattern is `/article/<slug>` — slug is generated server-side. */
export const ARTICLE_URL = (slug: string) => `/article/${encodeURIComponent(slug)}`;

/** Slug regex used in URL matchers. */
export const ARTICLE_SLUG_PATTERN = /\/article\/([\w-:.]+)/;

/** Timeouts — used in `expect.toHaveURL`/`expect.toBeVisible` style assertions. */
export const TIMEOUTS = {
  /** How long we wait for the Angular SPA to hydrate a form. */
  hydration: 30_000,
  /** Standard web-first assertion timeout. */
  default: 10_000,
  /** When re-fetching /articles after an action. */
  api: 15_000,
};
