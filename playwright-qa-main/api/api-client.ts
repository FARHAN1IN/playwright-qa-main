// api/api-client.ts
// Thin, typed wrapper over Playwright's APIRequestContext.
//
// Why a wrapper?
//   1. Centralises the `Authorization: Token <jwt>` header format.
//   2. Centralises error handling — non-2xx responses throw an ApiError with
//      a normalised { status, body, errors? } shape that tests can pattern-match.
//   3. Keeps fixtures and specs terse — `client.createArticle(...)` instead of
//      `request.post('/articles', { data: { article: {...} }, headers: {...} })`.
//
// Usage from a fixture or spec:
//   const client = new ApiClient(request);
//   const { token } = await client.login({ email, password });
//   const { slug } = await client.createArticle({ title, description, body, tagList });

import { APIRequestContext } from '@playwright/test';
import { ENDPOINTS } from './endpoints';
import { AUTH_HEADER, API_URL } from '../test-data/constants';
import type { UserData, ArticleData, SettingsPatch } from '../test-data/data-generator';

// ---------- Public types ----------

export type UserDto = {
  id: number;
  email: string;
  username: string;
  bio: string | null;
  image: string | null;
  token: string;
};

export type AuthorDto = {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
};

export type ArticleDto = {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: AuthorDto;
};

export type ArticleListDto = {
  articles: ArticleDto[];
  articlesCount: number;
};

// ---------- Errors ----------

export class ApiError extends Error {
  status: number;
  body: unknown;
  /** Convenience: parsed errors object if the body matches `{errors:{...}}`. */
  errors?: Record<string, string[]>;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    if (body && typeof body === 'object' && 'errors' in body && body.errors && typeof body.errors === 'object') {
      this.errors = body.errors as Record<string, string[]>;
    }
  }
}

// ---------- Wrapper ----------

export class ApiClient {
  /** Token to use for authenticated calls. Mutate this for per-user contexts. */
  authToken: string | null;

  /**
   * Base URL prepended to every endpoint path. Defaults to API_URL so the
   * client doesn't accidentally inherit the test's UI baseURL.
   */
  baseURL: string;

  constructor(
    private readonly request: APIRequestContext,
    opts: { authToken?: string; baseURL?: string } = {},
  ) {
    this.authToken = opts.authToken ?? null;
    this.baseURL = opts.baseURL ?? API_URL;
  }

  /** Build the Authorization header value when a token is present. */
  private authHeader(): Record<string, string> {
    return this.authToken ? { [AUTH_HEADER]: `Token ${this.authToken}` } : {};
  }

  /** Build absolute URL so the test's UI baseURL doesn't leak in. */
  private fullUrl(path: string): string {
    if (/^https?:\/\//.test(path)) return path;
    return `${this.baseURL.replace(/\/$/, '')}${path}`;
  }

  /** Internal: POST/GET/etc. wrapper that throws on non-2xx. */
  private async send<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    opts: { data?: unknown; params?: Record<string, string | number> } = {},
  ): Promise<T> {
    const url = this.fullUrl(path);
    const res = await this.request.fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...this.authHeader() },
      data: opts.data,
      params: opts.params,
    });
    const contentType = res.headers()['content-type'] ?? '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '');

    if (res.status() < 200 || res.status() >= 300) {
      throw new ApiError(res.status(), body, `API ${method.toUpperCase()} ${path} → ${res.status()}`);
    }
    return body as T;
  }

  // ----- Users -----

  /** POST /api/users */
  async register(user: UserData): Promise<{ user: UserDto }> {
    return this.send('post', ENDPOINTS.register, { data: { user } });
  }

  /** POST /api/users/login — returns the response payload (includes token). */
  async login(creds: Pick<UserData, 'email' | 'password'>): Promise<{ user: UserDto }> {
    return this.send('post', ENDPOINTS.login, { data: { user: creds } });
  }

  /** GET /api/user — fetch the authenticated user. */
  async getCurrentUser(): Promise<{ user: UserDto }> {
    return this.send('get', ENDPOINTS.currentUser);
  }

  /** PUT /api/user — patch the authenticated user. */
  async updateCurrentUser(patch: SettingsPatch): Promise<{ user: UserDto }> {
    return this.send('put', ENDPOINTS.currentUser, { data: { user: patch } });
  }

  // ----- Articles -----

  /** POST /api/articles (auth required). */
  async createArticle(article: ArticleData): Promise<{ article: ArticleDto }> {
    return this.send('post', ENDPOINTS.articles, { data: { article } });
  }

  /** GET /api/articles?limit=N&offset=N&tag=X (no auth needed). */
  async listArticles(params: { limit?: number; offset?: number; tag?: string } = {}): Promise<ArticleListDto> {
    const p: Record<string, string | number> = {};
    if (params.limit !== undefined) p.limit = params.limit;
    if (params.offset !== undefined) p.offset = params.offset;
    if (params.tag !== undefined) p.tag = params.tag;
    return this.send('get', ENDPOINTS.articles, { params: p });
  }

  /** GET /api/articles/:slug. Throws ApiError(404) when missing. */
  async getArticle(slug: string): Promise<{ article: ArticleDto }> {
    return this.send('get', ENDPOINTS.article(slug));
  }

  /** PUT /api/articles/:slug (auth). Slug may regenerate when title changes. */
  async updateArticle(slug: string, patch: Partial<ArticleData>): Promise<{ article: ArticleDto }> {
    return this.send('put', ENDPOINTS.article(slug), { data: { article: patch } });
  }

  /** DELETE /api/articles/:slug (auth). Returns true on 204. */
  async deleteArticle(slug: string): Promise<boolean> {
    const res = await this.request.fetch(this.fullUrl(ENDPOINTS.article(slug)), {
      method: 'delete',
      headers: { ...this.authHeader() },
    });
    if (res.status() === 204) return true;
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status(), body, `DELETE /api/articles/${slug} → ${res.status()}`);
  }

  // ----- Tags -----

  /** GET /api/tags. */
  async listTags(): Promise<{ tags: string[] }> {
    return this.send('get', ENDPOINTS.tags);
  }

  // ----- Profiles (read-only) -----

  /** GET /api/profiles/:username. */
  async getProfile(username: string): Promise<{ profile: AuthorDto }> {
    return this.send('get', ENDPOINTS.profile(username));
  }
}