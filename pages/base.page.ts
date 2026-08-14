// pages/base.page.ts
// Shared navigation + wait helpers for every page object.
// Page objects must only expose *actions* and *locators* — no `expect()` here.

import { Page, Locator } from '@playwright/test';
import { BASE_URL, ROUTES } from '../test-data/constants';

export abstract class BasePage {
  /** Construct with a Playwright Page. Subclasses may narrow its type. */
  constructor(protected readonly page: Page) {}

  /** Navigate to a path on the UI base URL. Waits for `domcontentloaded`. */
  async goto(path: string = '/'): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  /** Wait for a server-side path pattern match on the URL. */
  async waitForUrl(pattern: RegExp | string): Promise<void> {
    await this.page.waitForURL(pattern, { waitUntil: 'domcontentloaded' });
  }

  /** Wait for the URL to no longer match a regex (e.g. wait until we left /login). */
  async waitForUrlNotMatching(pathRegex: RegExp): Promise<void> {
    await this.page.waitForFunction((src: string) => {
      const re = new RegExp(src);
      return !re.test(window.location.pathname);
    }, pathRegex.source, { timeout: 15_000 });
  }

  /** Current URL (useful for negative assertions). */
  url(): string {
    return this.page.url();
  }

  /** Whether a given locator is currently visible (no auto-retry). */
  isVisible(locator: Locator): Promise<boolean> {
    return locator.isVisible();
  }

  // Convenience constants — subclasses can reuse.
  protected readonly baseUrl = BASE_URL;
  protected readonly routes = ROUTES;

  /** Generic toast/error-list region used by every form. */
  get formErrors(): Locator {
    return this.page.locator('ul.error-messages li');
  }

  /** Whole error region (wrapper). */
  get formErrorRegion(): Locator {
    return this.page.locator('ul.error-messages');
  }
}