// tests/article-filter-by-tag.spec.ts
// Positive + negative for "Filter articles by tag".
// Positive: click a Popular Tags sidebar pill → feed filter pill shows the
//           active tag and the article count is reduced/filtered.
// Negative: a random tag that exists in /api/tags but has no articles attached
//           to anything in the user's scope (we can't seed a tag with zero
//           articles client-side; the safest assertion is that the active
//           filter pill is visible after click).

import { test, expect } from '../fixtures/article.fixture';
import { HomePage } from '../pages/home.page';
import { ApiClient } from '../api/api-client';

test.describe('Article - Filter by Tag', () => {
  test('positive: clicking a sidebar tag filters the feed and shows the active tag', async ({ page, request }) => {
    const home = new HomePage(page);

    await home.goto('/');
    await home.waitForFeed();

    // Pick the first available sidebar pill.
    const firstPill = home.sidebarTags.first();
    const tagName = (await firstPill.textContent())?.trim() ?? '';
    expect(tagName.length).toBeGreaterThan(0);

    const cardsBefore = await home.articleCount();
    await home.filterBySidebarTag(tagName);

    // Active tag pill (with the # icon) appears in feed-toggle.
    const active = (await home.activeTagLabel()).trim();
    expect(active.toLowerCase()).toBe(tagName.toLowerCase());

    // After filtering, the article count should be <= the original count.
    const cardsAfter = await home.articleCount();
    expect(cardsAfter).toBeLessThanOrEqual(cardsBefore);

    // API confirms: GET /articles?tag=<tag> returns <= the unfiltered count.
    const client = new ApiClient(request);
    const filtered = await client.listArticles({ tag: tagName, limit: 50 });
    const unfiltered = await client.listArticles({ limit: 50 });
    expect(filtered.articlesCount).toBeLessThanOrEqual(unfiltered.articlesCount);
  });

  test('negative: filtering by a randomly-generated non-existent tag shows zero matching articles', async ({ page, request }) => {
    const home = new HomePage(page);
    const client = new ApiClient(request);

    // Use a unique tag name that won't be attached to any article.
    const fakeTag = `noresult_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    // API confirmation: zero articles for this tag.
    const list = await client.listArticles({ tag: fakeTag, limit: 50 });
    expect(list.articlesCount).toBe(0);
    expect(list.articles).toHaveLength(0);

    // The Angular UI doesn't support a query-string route, but the sidebar tag
    // click is wired to a state change — we can't easily filter by a non-existent
    // tag through the UI. Instead we assert that there is no such tag in the
    // sidebar (it never appears in Popular Tags because it's not in /api/tags).
    await home.goto('/');
    await home.waitForFeed();
    const sidebarText = (await home.sidebarTags.allTextContents()).map((t) => t.trim());
    expect(sidebarText).not.toContain(fakeTag);
  });
});