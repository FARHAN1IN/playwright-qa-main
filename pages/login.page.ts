// pages/login.page.ts
// Locators + actions for the /login page.
// Form fields use placeholder-only identification (Angular Reactive Forms).

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ---------- Locators ----------
  get email(): Locator {
    return this.page.getByPlaceholder('Email');
  }
  get password(): Locator {
    return this.page.getByPlaceholder('Password');
  }
  get signInButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign in' });
  }
  /** Server-returned error messages (single-element list for the login form). */
  get formErrorMessage(): Locator {
    return this.page.locator('ul.error-messages li').first();
  }

  // ---------- Actions ----------

  /** Wait until the Angular SPA has rendered the login form. */
  async waitForForm(): Promise<void> {
    await this.email.waitFor({ state: 'visible' });
  }

  /** Fill credentials and submit. Returns when navigation away from /login completes. */
  async signIn(email: string, password: string): Promise<void> {
    await this.waitForForm();
    await this.email.fill(email);
    await this.password.fill(password);
    await this.signInButton.click();
    await this.waitForUrlNotMatching(/\/login/);
  }

  /** Fill credentials and submit but do NOT wait for navigation (for negative tests). */
  async attemptSignIn(email: string, password: string): Promise<void> {
    await this.waitForForm();
    await this.email.fill(email);
    await this.password.fill(password);
    await this.signInButton.click();
  }
}