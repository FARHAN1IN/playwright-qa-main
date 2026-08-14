// test-data/data-generator.ts
// Faker-based factories that produce unique data per-run (avoids collisions on the
// shared public demo). Suffix is computed once per process so all factories within
// a single run share a common timestamp, making log files easier to read.

import { faker } from '@faker-js/faker';

/** Run-unique suffix (set lazily on first call). */
let runSuffix: string | null = null;
function getRunSuffix(): string {
  if (runSuffix === null) {
    runSuffix = `${Date.now()}-${faker.string.alphanumeric({ length: 6, casing: 'lower' })}`;
  }
  return runSuffix;
}

/** Truncate a string to `max` chars (used to satisfy username <=20). */
function clamp(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

export type UserData = {
  username: string;
  email: string;
  password: string;
};

export type ArticleData = {
  title: string;
  description: string;
  body: string;
  tagList: string[];
};

export type SettingsPatch = Partial<{
  bio: string;
  image: string;
  email: string;
  username: string;
  password: string;
}>;

export const DataGenerator = {
  /** Generate a unique user. Username + password each <= 20 chars (server-enforced). */
  user(): UserData {
    const suffix = getRunSuffix();
    // Username capped at 20 chars (server rule).
    const username = clamp(`u_${suffix}`, 20);
    // Email has no enforced length cap, but keep suffix under 40 chars total for sanity.
    const email = `e_${suffix}@example.com`;
    // Password ALSO capped at 20 chars by the server (verified empirically).
    // Use a tight password: 1 upper + 1 lower + 1 digit + 1 special + 6 random chars = 9 chars < 20.
    const randomTail = faker.string.alphanumeric({ length: 6, casing: 'mixed' });
    const password = clamp(`P_${suffix}_${randomTail}!`, 20);
    return { username, email, password };
  },

  /** Generate a unique article payload. */
  article(overrides: Partial<ArticleData> = {}): ArticleData {
    const suffix = getRunSuffix();
    // Title must be unique-enough to not collide with parallel runs.
    const title = overrides.title ?? `Article ${suffix} ${faker.word.words(2)}`;
    return {
      title,
      description: overrides.description ?? `Description for ${title}`,
      body: overrides.body ?? faker.lorem.paragraphs(2, '\n\n'),
      tagList: overrides.tagList ?? [`tag${suffix.slice(-6)}`],
    };
  },

  /** Generate a settings patch (defaults to changing bio only — safest field). */
  settings(overrides: Partial<SettingsPatch> = {}): SettingsPatch {
    const suffix = getRunSuffix();
    return {
      bio: `Updated bio ${suffix} — ${faker.lorem.sentence()}`,
      ...overrides,
    };
  },

  /** Useful for the "tag with no articles" negative test. */
  randomTag(): string {
    return `noresult_${getRunSuffix()}_${faker.string.alphanumeric({ length: 6, casing: 'lower' })}`;
  },

  /** Username regex group (for nav-element assertions). */
  usernameFor(user: UserData): string {
    return user.username;
  },

  /** Exposes the run suffix (useful for log annotation). */
  runSuffix(): string {
    return getRunSuffix();
  },
};
