// utils/auth-storage.ts
// Helpers around auth/user.json — used by fixtures that need to act as the
// authenticated user via the API (e.g. the apiArticle teardown).

import fs from 'node:fs';
import path from 'node:path';

const AUTH_FILE = path.resolve(process.cwd(), 'auth/user.json');

/** Read the per-run JWT token from auth/user.json. Returns null if missing. */
export function loadAuthToken(): string | null {
  try {
    const json = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    return json?.origins?.[0]?.localStorage?.[0]?.value ?? null;
  } catch {
    return null;
  }
}