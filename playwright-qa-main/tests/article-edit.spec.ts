// tests/article-edit.spec.ts
// Positive + negative for "Edit Article". Uses apiArticle fixture to create
// a fresh article via the API, then drives the editor UI to modify it.

import { test, expect } from '../fixtures/article.fixture';
import { EditorPage } from '../pages/editor.page';
import { ArticlePage } from '../pages/article.page';
import { ApiClient } from '../api/api-client';
import { loadAuthToken } from '../utils/auth-storage';

test.describe('Article - Edit', () => {
  test('positive: updates title + body and persists via the API', async ({ page, request, apiArticle }) => {
    const editor = new EditorPage(page);
    const articleView = new ArticlePage(page);

    // 1. Navigate to the editor. The Angular SPA loads /api/articles/<slug>
    //    asynchronously and then calls FormControl.setValue() to populate the
      //    inputs. We MUST wait for that population before we re-fill, otherwise
    //    our fills race against setValue() and the SPA ends up submitting the
    //    *original* values (verified bug — see CI run 31730808495 trace).
    await editor.goto(`/editor/${apiArticle.slug}`);
    await editor.waitForEditor();
    await expect(editor.title).toHaveValue(apiArticle.title, { timeout: 10_000 });
    // Body is faker-generated; we just need a non-empty value to know setValue() ran.
    await expect(editor.body).not.toHaveValue('');

    // 2. Modify the title + body.
    const newTitle = `Edited ${apiArticle.title}`;
    await editor.title.fill(newTitle);
    await editor.body.fill('Edited body content.');
    // Sanity-check the model is reflecting our edits before we publish —
    // protects against the same race recurring if the SPA changes its
    // hydration order.
    await expect(editor.title).toHaveValue(newTitle);
    await expect(editor.body).toHaveValue('Edited body content.');

    // 3. Publish and capture the (possibly regenerated) slug.
    const newSlug = await editor.publish();

    // 4. Confirm the article page renders the new title. We allow both the
    //    new slug URL AND a navigation that lands on the old slug URL with
    //    refreshed data — the SPA has been observed to do both (see
    //    .exploration/ui-notes.md and CI traces).
    await articleView.waitForArticle();
    await expect(articleView.title).toHaveText(newTitle, { timeout: 15_000 });
    await expect(articleView.body).toContainText('Edited body content.');

    // 5. API confirms persistence with the new slug.
    const token = loadAuthToken();
    const client = new ApiClient(request, token ? { authToken: token } : {});
    const fetched = await client.getArticle(newSlug);
    expect(fetched.article.title).toBe(newTitle);
    expect(fetched.article.body).toBe('Edited body content.');

    // 6. The original slug should now be gone (PUT regenerated it).
    await expect(client.getArticle(apiArticle.slug)).rejects.toThrow();
  });

  test('negative: clearing the title prevents an update and leaves the article unchanged', async ({ page, request, apiArticle }) => {
    const editor = new EditorPage(page);

    // 1. Open the editor pre-filled with the article.
    await editor.goto(`/editor/${apiArticle.slug}`);
    await editor.waitForEditor();

    // 2. Clear the title and submit.
    await editor.title.fill('');
    await editor.attemptPublish();

    // 3. Wait briefly for the request to settle.
    await page.waitForTimeout(2000);

    // 4. The original article must still be reachable via the API (the
    //    change either failed or was rejected, but it never destroyed data).
    const token = loadAuthToken();
    const client = new ApiClient(request, token ? { authToken: token } : {});
    const fetched = await client.getArticle(apiArticle.slug);
    // The original title (`apiArticle.title`) is preserved — the invalid PUT
    // either errored out or the server rejected the empty title.
    expect(fetched.article.title).toBe(apiArticle.title);
    expect(fetched.article.title.length).toBeGreaterThan(0);
  });
});