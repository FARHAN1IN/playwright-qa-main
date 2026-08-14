// pages/register.page.ts
// Locators + actions for the /register page.

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class RegisterPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get username(): Locator {
    return this.page.getByPlaceholder('Username');
  }
  get email(): Locator {
    return this.page.getByPlaceholder('Email');
  }
  get password(): Locator {
    return this.page.getByPlaceholder('Password');
  }
  get signUpButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign up' });
  }
  get formErrorMessage(): Locator {
    return this.page.locator('ul.error-messages li').first();
  }

  async waitForForm(): Promise<void> {
    await this.username.waitFor({ state: 'visible' });
  }

  async register(username: string, email: string, password: string): Promise<void> {
    await this.waitForForm();
    await this.username.fill(username);
    await this.email.fill(email);
    await this.password.fill(password);
    await this.signUpButton.click();
    await this.waitForUrlNotMatching(/\/register/);
  }
}