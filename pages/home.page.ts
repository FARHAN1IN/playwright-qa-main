// pages/home.page.ts
// Locators + actions for the home feed (`/`) and the Popular Tags sidebar.

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ---------- Locators ----------
  get feedTabs(): Locator {
    return this.page.locator('.feed-toggle');
  }
  get yourFeedTab(): Locator {
    return this.feedTabs.getByRole('link', { name: ' Your Feed' });
  }
  get globalFeedTab(): Locator {
    return this.feedTabs.getByRole('link', { name: ' Global Feed' });
  }
  /** The optional 3rd tab that appears with an active tag filter. */
  get activeTagTab(): Locator {
    return this.feedTabs.locator('a.nav-link.active').filter({ has: this.page.locator('i.ion-pound') });
  }

  get sidebar(): Locator {
    return this.page.locator('.sidebar');
  }
  get popularTagsHeader(): Locator {
    return this.sidebar.locator('p', { hasText: 'Popular Tags' });
  }
  /** All tag pills in the sidebar (no href — they trigger Angular state). */
  get sidebarTags(): Locator {
    return this.sidebar.locator('a.tag-pill');
  }

  get articlePreviews(): Locator {
    return this.page.locator('app-article-preview');
  }
  /** All tag pills rendered inside individual article cards. */
  get articleCardTags(): Locator {
    return this.articlePreviews.locator('li.tag-pill');
  }
  get pagination(): Locator {
    return this.page.locator('nav .pagination');
  }

  // ---------- Actions ----------
  async waitForFeed(): Promise<void> {
    await this.feedTabs.waitFor({ state: 'visible' });
    await this.sidebar.waitFor({ state: 'visible' });
  }

  /** Click a sidebar tag and wait until the filter is active (3rd pill appears). */
  async filterBySidebarTag(tagName: string): Promise<void> {
    await this.waitForFeed();
    const pill = this.sidebarTags.filter({ hasText: new RegExp(`^\\s*${tagName}\\s*$`) }).first();
    await pill.click();
    // The active filter is reflected as a 3rd pill with .active class
    // containing an <i class="ion-pound"> prefix.
    await this.page.waitForSelector('.feed-toggle a.nav-link.active i.ion-pound', { timeout: 10_000 });
  }

  /** Click a tag pill inside an article card. */
  async filterByArticleCardTag(tagName: string): Promise<void> {
    await this.waitForFeed();
    const pill = this.articleCardTags.filter({ hasText: new RegExp(`^\\s*${tagName}\\s*$`) }).first();
    await pill.click();
    await this.page.waitForSelector('.feed-toggle a.nav-link.active i.ion-pound', { timeout: 10_000 });
  }

  /** Get the visible active-tag label (the text after `ion-pound`). */
  async activeTagLabel(): Promise<string> {
    const text = await this.activeTagTab.textContent();
    return (text ?? '').trim();
  }

  /** Number of article preview cards currently rendered. */
  async articleCount(): Promise<number> {
    return this.articlePreviews.count();
  }
}