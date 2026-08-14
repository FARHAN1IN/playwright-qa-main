// pages/editor.page.ts
// Locators + actions for `/editor` (create) and `/editor/<slug>` (edit).

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { ARTICLE_SLUG_PATTERN } from '../test-data/constants';

export class EditorPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ---------- Locators ----------
  get title(): Locator {
    return this.page.getByPlaceholder('Article Title');
  }
  get description(): Locator {
    return this.page.getByPlaceholder("What's this article about?");
  }
  get body(): Locator {
    return this.page.getByPlaceholder('Write your article (in markdown)');
  }
  get tags(): Locator {
    return this.page.getByPlaceholder('Enter tags');
  }
  get publishButton(): Locator {
    return this.page.getByRole('button', { name: /Publish Article/i });
  }
  get formErrorMessage(): Locator {
    return this.page.locator('ul.error-messages li').first();
  }

  // ---------- Actions ----------
  async waitForEditor(): Promise<void> {
    await this.title.waitFor({ state: 'visible' });
  }

  /** Fill the article form. Accepts partial data — only filled fields are written. */
  async fillArticle(opts: { title?: string; description?: string; body?: string; tags?: string }): Promise<void> {
    await this.waitForEditor();
    if (opts.title !== undefined) await this.title.fill(opts.title);
    if (opts.description !== undefined) await this.description.fill(opts.description);
    if (opts.body !== undefined) await this.body.fill(opts.body);
    if (opts.tags !== undefined) await this.tags.fill(opts.tags);
  }

  /** Publish and wait until we land on `/article/<slug>`. Returns the slug. */
  async publish(): Promise<string> {
    await this.publishButton.click();
    await this.waitForUrl(ARTICLE_SLUG_PATTERN);
    const url = this.page.url();
    return decodeURIComponent(url.split('/article/')[1]);
  }

  /**
   * Publish without expecting success (for negative tests that assert "no navigation").
   * Returns when the URL has either stayed or moved — caller decides.
   */
  async attemptPublish(): Promise<void> {
    await this.publishButton.click();
  }
}