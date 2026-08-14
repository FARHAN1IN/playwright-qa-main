// tests/login-ui.spec.ts
// Bonus spec — explicitly drive the login UI form (not the shared auth setup).
// `test.use({ storageState: { cookies: [], origins: [] } })` bypasses the per-run
// JWT-injected storage so we land on /login as a fresh visitor.

import { test, expect, request as pwRequest } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { HomePage } from '../pages/home.page';
import { DataGenerator } from '../test-data/data-generator';
import { ApiClient } from '../api/api-client';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login UI', () => {
  test('positive: logs a known user in via the UI', async ({ page }) => {
    // Seed a fresh user via the API so we have valid credentials to type.
    const user = DataGenerator.user();
    const apiCtx = await pwRequest.newContext();
    const api = new ApiClient(apiCtx);
    try {
      await api.register(user);
    } catch {
      /* ignore duplicate */
    }
    await apiCtx.dispose();

    const login = new LoginPage(page);
    const home = new HomePage(page);

    await login.goto('/login');
    await login.signIn(user.email, user.password);

    // We expect to land on the home feed; the username link in the top nav is the proof.
    await home.waitForFeed();
    await expect(page.getByRole('link', { name: user.username })).toBeVisible();
  });

  test('negative: wrong password shows an error and does not navigate', async ({ page }) => {
    const user = DataGenerator.user();
    const apiCtx = await pwRequest.newContext();
    const api = new ApiClient(apiCtx);
    try {
      await api.register(user);
    } catch {
      /* ignore duplicate */
    }
    await apiCtx.dispose();

    const login = new LoginPage(page);

    await login.goto('/login');
    await login.attemptSignIn(user.email, 'wrongPassword');

    // Server returns 403 with an "email or password is invalid" error.
    await expect(login.formErrorMessage).toBeVisible({ timeout: 10_000 });
    await expect(login.formErrorMessage).toContainText(/invalid/i);

    // URL should remain on /login.
    expect(/\/login/.test(page.url()), 'should remain on /login after wrong password').toBeTruthy();
  });
});