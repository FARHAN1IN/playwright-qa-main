// tests/auth.setup.ts
// Setup project (configured in playwright.config.ts via `projects: [{name:'setup', testMatch:/.*\.setup\.ts/}]`).
//
// Flow:
//   1. Generate a unique throwaway user (DataGenerator handles suffixing).
//   2. Register + login via the API to obtain a fresh JWT.
//   3. Write a storageState-shaped JSON file containing only the JWT in
//      localStorage at the UI origin. The Angular SPA reads `localStorage.jwtToken`
//      on bootstrap (confirmed in Phase 1), so the browser projects that consume
//      this state start already authenticated.

import { test, request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { DataGenerator } from '../test-data/data-generator';
import { API_URL, BASE_URL } from '../test-data/constants';
import { ApiClient, ApiError } from '../api/api-client';
import type { UserData } from '../test-data/data-generator';

const AUTH_FILE = path.resolve(process.cwd(), 'auth/user.json');

test('authenticate via API and persist JWT to storageState', async () => {
  // Pre-existing users on the shared public demo can collide — keep this fresh.
  const user: UserData = DataGenerator.user();
  process.stdout.write(`[auth.setup] user=${user.username}\n`);

  const apiCtx = await request.newContext({ baseURL: API_URL });
  const client = new ApiClient(apiCtx);

  // Register — fresh user per run. If the username is already taken (422), that's
  // fine: the user exists, so we just login below.
  try {
    await client.register(user);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 422) {
      throw err; // any error other than "already taken" is a real problem.
    }
    // 422 = already taken; we'll just login as that user.
  }

  // Login to guarantee a fresh token.
  const loginRes = await client.login({ email: user.email, password: user.password });
  if (!loginRes?.user?.token) {
    throw new Error(`login returned no token for ${user.email}`);
  }
  const token = loginRes.user.token;
  await apiCtx.dispose();

  // Build the storageState object. The Angular SPA reads `localStorage.jwtToken`
  // synchronously on bootstrap; setting it via storageState is enough — no addInitScript needed.
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: BASE_URL,
        localStorage: [
          { name: process.env.JWT_LOCALSTORAGE_KEY ?? 'jwtToken', value: token },
        ],
      },
    ],
  };

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2));
  process.stdout.write(`[auth.setup] wrote ${AUTH_FILE} (token len=${token.length})\n`);
});