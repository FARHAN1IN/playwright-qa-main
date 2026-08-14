// fixtures/article.fixture.ts
//
// Provides an `apiArticle` fixture that creates a fresh article via the API before
// each test that requests it. A worker-scoped auto fixture (`_apiArticlePool`)
// tracks every article created by the worker and DELETEs them in teardown — so
// leftover data is cleaned up regardless of test outcome.
//
// Usage in a spec:
//   import { test, expect } from '../fixtures/article.fixture';
//   test('something', async ({ apiArticle, request }) => {
//     // apiArticle.slug is the freshly-created article
//   });

import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../api/api-client';
import { DataGenerator, ArticleData } from '../test-data/data-generator';
import { API_URL } from '../test-data/constants';
import { loadAuthToken } from '../utils/auth-storage';

export type CreatedArticle = { slug: string; title: string };

export type ArticleFixtures = {
  apiArticle: CreatedArticle;
};

export type WorkerFixtures = {
  _apiArticlePool: CreatedArticle[];
};

export const test = base.extend<ArticleFixtures, WorkerFixtures>({
  // Worker-scoped, auto: tracks everything the worker creates, deletes on teardown.
  // Worker fixtures don't get `request` directly — we open a brand-new context
  // with the JWT from auth/user.json so cleanup runs even if no test opened a browser.
  _apiArticlePool: [
    async ({}, use) => {
      const pool: CreatedArticle[] = [];
      await use(pool);
      if (pool.length === 0) return;
      const token = loadAuthToken();
      const cleanupCtx = await (await import('@playwright/test')).request.newContext({ baseURL: API_URL });
      const client = new ApiClient(cleanupCtx, token ? { authToken: token } : {});
      await Promise.all(
        pool.map(async ({ slug }) => {
          try {
            await client.deleteArticle(slug);
          } catch {
            // Swallow — delete-after-test failure should not mask the real test result.
          }
        }),
      );
      await cleanupCtx.dispose();
    },
    { scope: 'worker', auto: true },
  ],

  apiArticle: async ({ request, _apiArticlePool }, use, testInfo) => {
    const article: ArticleData = DataGenerator.article();
    // Read the JWT from the auth state so we create the article as the logged-in user.
    const token = loadAuthToken();
    const client = new ApiClient(request, token ? { authToken: token } : {});

    const res = await client.createArticle(article);
    const slug = res.article.slug;
    const created: CreatedArticle = { slug, title: article.title };
    _apiArticlePool.push(created);

    // Surface the created slug as a report annotation so failures are easier to triage.
    testInfo.annotations.push({ type: 'created-article-slug', description: slug });
    await use(created);
  },
});

export { expect };