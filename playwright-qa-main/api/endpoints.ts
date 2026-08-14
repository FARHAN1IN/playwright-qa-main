// api/endpoints.ts
// String constants — keeps endpoint URLs in one place and lets tests reference them.

export const ENDPOINTS = {
  // User auth & profile
  register: '/api/users', // POST
  login: '/api/users/login', // POST
  currentUser: '/api/user', // GET/PUT (auth)

  // Articles
  articles: '/api/articles', // GET (filterable by tag, paginated by limit/offset) / POST (auth)
  article: (slug: string) => `/api/articles/${encodeURIComponent(slug)}`, // GET / PUT / DELETE (auth)

  // Tags
  tags: '/api/tags', // GET

  // Profiles (read-only here)
  profile: (username: string) => `/api/profiles/${encodeURIComponent(username)}`, // GET
} as const;
