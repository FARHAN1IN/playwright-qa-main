// tests/article-delete.spec.ts
// Positive + negative for "Delete Article". Uses apiArticle fixture to seed
// a fresh article for the positive path; for the negative path it seeds an
// article as a *second* user so the logged-in user cannot delete it.

import { test, expect } from '../fixtures/article.fixture';
import { ArticlePage } from '../pages/article.page';
import { ApiClient } from '../api/api-client';
import { DataGenerator } from '../test-data/data-generator';
import { loadAuthToken } from '../utils/auth-storage';
import { API_URL, ARTICLE_URL } from '../test-data/constants';
import { ApiError } from '../api/api-client';
import { request as pwRequest } from '@playwright/test';

test.describe('Article - Delete', () => {
  test('positive: deletes the article and removes it from the API', async ({ page, request, apiArticle }) => {
    const articleView = new ArticlePage(page);

    // 1. Visit the article.
    await articleView.goto(ARTICLE_URL(apiArticle.slug));
    await articleView.waitForArticle();
    await expect(articleView.title).toBeVisible();

    // 2. Click Delete — no confirm dialog on this app.
    await articleView.deleteArticle();

    // 3. We should land on the home feed (URL no longer matches /article/).
    // The page-object helper already waits for the URL change via
    // waitForUrlNotMatching; re-assert here with a web-first assertion that
    // also tolerates Firefox being a touch slower than Chromium.
    await expect(page).not.toHaveURL(/\/article\//);

    // 4. API: the article is gone (404).
    const token = loadAuthToken();
    const client = new ApiClient(request, token ? { authToken: token } : {});
    await expect(client.getArticle(apiArticle.slug)).rejects.toThrow(ApiError);
    // Also confirm DELETE returns 404 / 403 / 422 — *not* 204.
    await expect(client.deleteArticle(apiArticle.slug)).rejects.toThrow(ApiError);
  });

  test('negative: cannot delete an article owned by a different user', async ({ page, request, apiArticle }) => {
    // Create a SECOND user + a new article as them, then try to delete as the
    // currently-logged-in user (who is NOT the second user).
    const otherUser = DataGenerator.user();
    const apiCtx = await pwRequest.newContext({ baseURL: API_URL });
    const otherClient = new ApiClient(apiCtx);
    try {
      await otherClient.register(otherUser);
    } catch {
      /* ignore duplicate */
    }
    const loginRes = await otherClient.login({ email: otherUser.email, password: otherUser.password });
    otherClient.authToken = loginRes.user.token;

    const created = await otherClient.createArticle(DataGenerator.article({ title: `Foreign ${Date.now()}` }));
    const foreignSlug = created.article.slug;

    // Now open the foreign article in the browser as the original user.
    const articleView = new ArticlePage(page);
    await articleView.goto(ARTICLE_URL(foreignSlug));
    await articleView.waitForArticle();

    // The Delete/Edit buttons only render for the author — so they MUST be absent here.
    await expect(articleView.deleteButton).toHaveCount(0);
    await expect(articleView.editButton).toHaveCount(0);

    // API: delete attempt by the original user (who is NOT the author) → 403.
    const token = loadAuthToken();
    const origClient = new ApiClient(request, token ? { authToken: token } : {});
    await expect(origClient.deleteArticle(foreignSlug)).rejects.toThrow(ApiError);

    // Confirm the foreign article is still around.
    const fetched = await origClient.getArticle(foreignSlug);
    expect(fetched.article.slug).toBe(foreignSlug);

    // Cleanup the foreign article so we don't leave it behind.
    try {
      await otherClient.deleteArticle(foreignSlug);
    } catch {
      /* ignore */
    }
    await apiCtx.dispose();
  });
});