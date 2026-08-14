// pages/article.page.ts
// Locators + actions for the article detail page (`/article/<slug>`).

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class ArticlePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ---------- Locators ----------
  get title(): Locator {
    return this.page.locator('h1');
  }
  get body(): Locator {
    return this.page.locator('.article-content');
  }
  /** Tag pills at the bottom of the article (footer tag-list). */
  get tags(): Locator {
    return this.page.locator('.tag-list .tag-pill, ul.tag-list li');
  }
  get authorLink(): Locator {
    return this.page.locator('.article-meta a, .author');
  }
  get articleActions(): Locator {
    return this.page.locator('.article-actions');
  }
  get deleteButton(): Locator {
    // Two delete buttons render on the page (banner + footer); .first() picks the topmost.
    return this.page.getByRole('button', { name: /Delete Article/ }).first();
  }
  get editButton(): Locator {
    return this.page.getByRole('link', { name: /Edit Article/ });
  }

  // ---------- Actions ----------
  async waitForArticle(): Promise<void> {
    await this.title.waitFor({ state: 'visible' });
  }

  /**
   * Click "Delete Article" and wait for navigation back to home.
   * The Conduit app shows NO `window.confirm` dialog — the click is direct.
   */
  async deleteArticle(): Promise<void> {
    await this.deleteButton.click();
    // After deletion, we land back on the home feed.
    await this.waitForUrlNotMatching(/\/article\//);
  }
}