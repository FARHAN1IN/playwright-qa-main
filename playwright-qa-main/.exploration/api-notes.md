# Live API exploration — Conduit RealWorld (BondarAcademy)

**Base URL:** `https://conduit-api.bondaracademy.com/api`
**Auth:** `Authorization: Token <jwt>` header (NOT `Bearer`).
**Content-Type:** `application/json; charset=utf-8`.
**JWT format:** 3 dot-separated base64url segments (HS256).
**CORS:** `access-control-allow-origin: https://conduit.bondaracademy.com` (only the production UI origin is allowed).

All endpoints below were exercised with `curl` against the live site during Phase 1. Status codes, response shapes, and error wording are quoted from the actual responses saved to `/tmp/api-explore/*.json`.

---

## 1. Per-endpoint table

| Method | Path                       | Auth | Status | Response wrapper                       |
| ------ | -------------------------- | ---- | ------ | -------------------------------------- |
| POST   | `/users`                   | no   | 201    | `{ user: {...} }`                      |
| POST   | `/users` (duplicate)       | no   | 422    | `{ errors: { field: ["msg"] } }`       |
| POST   | `/users/login`             | no   | 200    | `{ user: {...} }`                      |
| POST   | `/users/login` (bad pw)    | no   | 403    | `{ errors: { "email or password": [...] } }` |
| PUT    | `/user`                    | yes  | 200    | `{ user: {...} }`                      |
| GET    | `/articles?limit=N`        | no   | 200    | `{ articles: [...], articlesCount: N }` |
| GET    | `/articles?tag=X`          | no   | 200    | `{ articles: [...], articlesCount: N }` (same wrapper; filter by tag) |
| GET    | `/articles/:slug`          | no   | 200/404| `{ article: {...} }` / `{}`           |
| POST   | `/articles`                | yes  | 201    | `{ article: {...} }`                   |
| PUT    | `/articles/:slug`          | yes  | 200    | `{ article: {...} }` (slug regenerated if title changes) |
| DELETE | `/articles/:slug`          | yes  | 204    | empty body                             |
| DELETE | `/articles/:slug` (not author) | yes | 403 | `{ errors: {...} }`                    |
| GET    | `/tags`                    | no   | 200    | `{ tags: ["Test","Blog",...] }`        |
| GET    | `/profiles/:username`      | no   | 200/404| `{ profile: {...} }` / `{}`           |

The `/articles/:slug` endpoint returns `404 {}` (empty object, NOT a JSON `{"errors":...}` shape) when the slug does not exist — Playwright `expect(res.status()).toBe(404)` is the right assertion.

---

## 2. Auth flow

`POST /users` (or `POST /users/login`) returns:

```json
{
  "user": {
    "id": 64356,
    "email": "e_1786627904@example.com",
    "username": "e_1786627904",
    "bio": null,
    "image": "https://conduit-api.bondaracademy.com/images/smiley-cyrus.jpeg",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<payload>.<sig>"
  }
}
```

**Important**: registration/login do NOT require email confirmation. The `image` field defaults to a fixed smiley URL.

**Username constraints** (observed):
- `username` max length: **20 characters** (server returns `422 {"errors":{"username":["is too long (maximum is 20 characters)"]}}`).
- `username` must be unique — duplicate gives `422 {"errors":{"email":["has already been taken"],"username":["has already been taken"]}}`.

**Password constraints** — minimum length not confirmed but seems to be ~6+; observed 8-character passwords work. The user-settings endpoint accepts a `password` field for password change.

---

## 3. Article shape

Sample `POST /articles` request → `201`:

```json
{
  "article": {
    "slug": "explore-title-1786627904-64356",
    "title": "explore title 1786627904",
    "description": "desc 1786627904",
    "body": "body 1786627904",
    "tagList": ["Test","explore"],
    "createdAt": "2026-08-13T13:32:16.883Z",
    "updatedAt": "2026-08-13T13:32:16.883Z",
    "favorited": false,
    "favoritesCount": 0,
    "author": {
      "username": "e_1786627904",
      "bio": null,
      "image": "https://conduit-api.bondaracademy.com/images/smiley-cyrus.jpeg",
      "following": false
    }
  }
}
```

- `tagList` is always a `string[]` (the server appears to lowercase & de-dupe; "Test" was uppercased from our input — the spec only supports lower-case tag names but the server preserves user-entered casing).
- `slug` is `kebab-case(title) + "-" + user.id`. If title contains spaces/non-ASCII, they're replaced with `-`.
- On `PUT /articles/:slug` with a new title, the **slug regenerates** and `tagList` is **replaced** (empty array if not provided in the PUT body — important for our edit test).

---

## 4. Error shapes (for negative tests)

| Trigger                            | Status | Body                                                         |
| ---------------------------------- | ------ | ------------------------------------------------------------ |
| Duplicate username/email register  | 422    | `{"errors":{"email":["has already been taken"],"username":["has already been taken"]}}` |
| Username > 20 chars                | 422    | `{"errors":{"username":["is too long (maximum is 20 characters)"]}}` |
| Wrong password login               | 403    | `{"errors":{"email or password":["is invalid"]}}`            |
| Missing/empty title on POST article| 422    | `{"errors":{"title":["can't be blank"]}}` (observed)         |
| DELETE /articles/:slug not author  | 403    | `{"errors":{"article":["not found"]}}` (observed)           |

---

## 5. Quirks / gotchas

- **Slug changes on every PUT** that modifies the title — tests that assert "the new slug" must capture it from the PUT response, not hardcode.
- **Tag list is replaced on PUT** (not merged) — sending `{title: "..."}` without a `tagList` field empties the tags. PUT for "edit title only" must echo back the original tagList if we want to preserve it.
- The `/articles?tag=X` endpoint IS the supported tag filter (and it does work — verified empty result for `nonexistent_tag_xyz`), but the Angular UI does **NOT** push the tag into the URL on click. The UI filter uses client-side state only.
- The `password` field on the user object is **never returned** by the API after registration/login (good — safe to ignore in fixtures).
- Server returns `access-control-allow-origin: https://conduit.bondaracademy.com` — only that origin can call the API from a browser. Our tests use Playwright's `request` context which bypasses CORS, so this is not an issue.
- The server **rate-limits 422 responses** (when we tried repeatedly with malformed JSON, we got 500s back). Tests should treat 422 as expected for negative scenarios and not retry blindly.
- Headers include `x-cloud-trace-context` — Google Frontend hosted.

---

## 6. Useful single-curl recipes

```bash
BASE=https://conduit-api.bondaracademy.com/api
TOKEN="<jwt>"

# Register
curl -X POST -H 'Content-Type: application/json' \
  -d '{"user":{"username":"u_<ts>","email":"u_<ts>@example.com","password":"Test1234"}}' \
  $BASE/users

# Login
curl -X POST -H 'Content-Type: application/json' \
  -d '{"user":{"email":"<email>","password":"Test1234"}}' \
  $BASE/users/login

# Create article
curl -X POST -H 'Content-Type: application/json' -H "Authorization: Token $TOKEN" \
  -d '{"article":{"title":"My title","description":"d","body":"b","tagList":["t1"]}}' \
  $BASE/articles

# Delete
curl -X DELETE -H "Authorization: Token $TOKEN" $BASE/articles/<slug>
```

All confirmed working against the live API.