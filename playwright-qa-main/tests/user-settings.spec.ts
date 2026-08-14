// tests/user-settings.spec.ts
// Positive + negative for "Update User Settings".
//
// IMPORTANT DISCOVERIES (Phase 1 + Phase 6 debugging, see .exploration/ui-notes.md §3f):
//   • The Angular settings form does NOT pre-populate from GET /user — every
//     field is empty on load. The user must type values explicitly.
//   • The PUT payload sent by the form includes EVERY field (image, username,
//     bio, email, password) — empty strings are accepted by the server.
//   • After a successful PUT, the SPA navigates to /profile/<username>.
//     There is no success toast, no return-to-form behaviour. Reloading
//     /settings re-renders the empty form (still no pre-populate).
//   • The server treats empty string for username/email/bio/image as
//     "do not change" — returns 200 with the unchanged user object.
//   • There is no client-side validation, and server validation errors
//     (e.g. 422 on register/login) do NOT surface as <ul.error-messages>
//     entries from the settings page in any observed path.
//
// Therefore:
//   • Positive: fill bio via the UI, submit, verify via API that the bio
//     persists. We don't try to assert on the form re-rendering — it
//     doesn't reflect PUT results on re-visit.
//   • Negative: leave username blank (an invalid form per the spec's
//     server-side rules), fill only the bio with a value, submit, verify
//     via API that the username was NOT changed (empty string is silently
//     ignored by the server) and the bio WAS changed. This proves the
//     form's empty field was correctly handled by the API without
//     destroying valid existing data.

import { test, expect } from '@playwright/test';
import { SettingsPage } from '../pages/settings.page';
import { ApiClient } from '../api/api-client';
import { loadAuthToken } from '../utils/auth-storage';

// Both user-settings tests share the same authenticated user (from
// auth/user.json). Running them concurrently causes a PUT-race where both
// tests submit bios at the same time and one overwrites the other. Force
// serial execution within this describe block.
test.describe.configure({ mode: 'serial' });

test.describe('User - Settings', () => {
  test('positive: updates bio through the UI and persists via API', async ({ page, request }) => {
    const settings = new SettingsPage(page);
    const newBio = `Bio ${Date.now()} — totally unique`;

    await settings.goto('/settings');
    await settings.waitForSettings();

    // Fill only the bio — the server treats empty other fields as no-ops,
    // so we don't need to round-trip username/email to type them.
    await settings.bio.fill(newBio);

    await settings.updateButton.click();

    // After a successful PUT the SPA navigates to /profile/<username>.
    await page.waitForURL(/\/profile\//, { timeout: 10_000 });

    // API confirmation: bio is the value we typed.
    const token = loadAuthToken();
    const client = new ApiClient(request, token ? { authToken: token } : {});
    const me = await client.getCurrentUser();
    expect(me.user.bio).toBe(newBio);
  });

  test('negative: clearing the username leaves the username unchanged while still updating the bio', async ({ page, request }) => {
    const settings = new SettingsPage(page);
    const token = loadAuthToken();

    // 1. Capture the current user via GET /user so we know the baseline.
    const client = new ApiClient(request, token ? { authToken: token } : {});
    const before = await client.getCurrentUser();
    const baselineUsername = before.user.username;
    const baselineBio = before.user.bio ?? '';

    // 2. Visit settings, fill only the bio with a new value, leave username blank.
    await settings.goto('/settings');
    await settings.waitForSettings();
    await settings.username.fill('');
    const newBio = `Negative bio ${Date.now()}`;
    await settings.bio.fill(newBio);

    await settings.updateButton.click();

    // 3. After submit, the SPA navigates to /profile/<username>.
    await page.waitForURL(/\/profile\//, { timeout: 10_000 });

    // 4. Verify via API that:
    //      • bio was updated to newBio (the one field we filled)
    //      • username is unchanged (empty input was treated as "no change")
    //    This is the correct "negative" semantics: invalid input did NOT
    //    destroy valid existing data.
    const after = await client.getCurrentUser();
    expect(after.user.username).toBe(baselineUsername);
    expect(after.user.username.length).toBeGreaterThan(0);
    expect(after.user.bio).toBe(newBio);

    // Cleanup: restore baseline bio so the next test run starts from a known state.
    if (baselineBio !== newBio) {
      await client.updateCurrentUser({ bio: baselineBio });
    }
  });
});
