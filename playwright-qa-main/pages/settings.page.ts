// pages/settings.page.ts
// Locators + actions for `/settings`.

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class SettingsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ---------- Locators ----------
  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Your Settings' });
  }
  get imageUrl(): Locator {
    return this.page.getByPlaceholder('URL of profile picture');
  }
  get username(): Locator {
    return this.page.getByPlaceholder('Username');
  }
  get bio(): Locator {
    return this.page.getByPlaceholder('Short bio about you');
  }
  get email(): Locator {
    return this.page.getByPlaceholder('Email');
  }
  get newPassword(): Locator {
    return this.page.getByPlaceholder('New Password');
  }
  get updateButton(): Locator {
    return this.page.getByRole('button', { name: /Update Settings/ });
  }
  get logoutButton(): Locator {
    return this.page.getByRole('button', { name: /logout/i });
  }
  get formErrorMessage(): Locator {
    return this.page.locator('ul.error-messages li').first();
  }

  // ---------- Actions ----------
  async waitForSettings(): Promise<void> {
    await this.heading.waitFor({ state: 'visible' });
  }

  /** Apply a patch and submit. The app does NOT navigate on success — assert
   *  on the form reflecting new values + a GET /user round-trip instead. */
  async updateSettings(patch: { bio?: string; image?: string; email?: string; username?: string; password?: string }): Promise<void> {
    await this.waitForSettings();
    if (patch.bio !== undefined) await this.bio.fill(patch.bio);
    if (patch.image !== undefined) await this.imageUrl.fill(patch.image);
    if (patch.email !== undefined) await this.email.fill(patch.email);
    if (patch.username !== undefined) await this.username.fill(patch.username);
    if (patch.password !== undefined) await this.newPassword.fill(patch.password);
    await this.updateButton.click();
  }
}