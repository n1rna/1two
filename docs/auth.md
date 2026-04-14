# Auth

How sign-in works across 1tt.dev and kim1.ai when they're two apps that
share one user identity.

## The model: one user, two auth instances

There is **one** `users` table in Postgres, shared by both apps through the
Drizzle schema at `packages/api-client/src/auth-schema.ts`. A given email
address maps to exactly one user row, and both apps see the same user.

There are **two** `betterAuth()` instances — one in each Next app:

- `apps/web/src/lib/auth.ts` — 1tt.dev
- `apps/kim/src/lib/auth.ts` — kim1.ai

Each instance:

- Is configured with the same `DATABASE_URL` (same DB).
- Uses the same Drizzle adapter (`drizzleAdapter(db, { provider: "pg", schema })`)
  pointing at the same shared schema.
- Has its **own** `BETTER_AUTH_SECRET` for signing session tokens — this is
  fine, because the Go API validates sessions by looking them up in the
  `sessions` table, not by verifying JWT signatures.
- Has its **own** `BETTER_AUTH_URL` (`https://1tt.dev` vs `https://kim1.ai`).
- Has its **own** GitHub and Google OAuth client IDs + secrets, each
  configured with the right callback URL for its domain.

A user who signs in on 1tt.dev with GitHub gets a session cookie scoped to
`.1tt.dev`. Later, when they visit kim1.ai and sign in with the same GitHub
account, better-auth creates a **new** session row for the same user (the
`users.id` is matched by email), and sets a cookie scoped to `.kim1.ai`.

There is no session sharing across domains — each cookie belongs to one
apex. But it's still "one account" in the sense that both sessions point
at the same row in `users`, so data is shared seamlessly on the backend.

## Cookie domains

`better-auth` cookies are configured per-app in the same pattern:

```ts
const authURL = process.env.BETTER_AUTH_URL || "http://lvh.me:3001";
const cookieDomain = (() => {
  try {
    const host = new URL(authURL).hostname;
    if (host === "localhost" || host.endsWith(".localhost")) return undefined;
    return "." + host;
  } catch {
    return undefined;
  }
})();
```

This gives you:

| `BETTER_AUTH_URL` | Cookie domain |
|---|---|
| `https://1tt.dev` | `.1tt.dev` |
| `https://kim1.ai` | `.kim1.ai` |
| `http://lvh.me:3000` (web dev) | `.lvh.me` |
| `http://lvh.me:3001` (kim dev) | `.lvh.me` |
| `http://localhost:3000` | `undefined` (no cross-subdomain sharing) |

In `advanced`, if `cookieDomain` is set, we enable `crossSubDomainCookies`
and `defaultCookieAttributes: { sameSite: "lax", secure: isSecure }`.

### Why `lvh.me` for dev

Chrome rejects `.localhost` as a cookie domain (it's on the Public Suffix
List). `lvh.me` is a public DNS record pointing `*.lvh.me` at `127.0.0.1`,
so you can run `http://lvh.me:3001` and the browser treats it like a real
domain for cookie purposes. This is why both apps default to `lvh.me` in
dev, and why `BETTER_AUTH_URL=http://lvh.me:3001` is in
`apps/kim/.env.kim.development`.

Running kim dev on `localhost:3001` will technically work, but the cookie
domain will be `undefined` and you'll lose cross-subdomain sharing (which
isn't critical locally, but the OAuth callback URL must still match).

## OAuth callback URLs

Each OAuth app must have its callback URL registered with the provider.
Since apps are on different domains, you need **four** OAuth clients in
total (two per provider: dev + prod is optional, but separating prod from
dev is cleaner).

**Kim (minimum):**

- GitHub OAuth app:
  - Callback: `https://kim1.ai/api/auth/callback/github`
  - (optional dev callback: `http://lvh.me:3001/api/auth/callback/github`)
- Google OAuth client:
  - Authorized JS origins: `https://kim1.ai`, `http://lvh.me:3001`
  - Redirect URIs: `https://kim1.ai/api/auth/callback/google`,
    `http://lvh.me:3001/api/auth/callback/google`

**Web:** identical idea, callbacks on `https://1tt.dev/...` and
`http://lvh.me:3000/...`.

One GitHub OAuth app can register multiple callback URLs only in some
setups — when in doubt, create a second app for dev.

## Session forwarding through the API proxy

Both Next apps expose `/api/proxy/[...path]/route.ts` — a generic proxy
that forwards to the Go API. The shared `@1tt/api-client` uses
`fetch("/api/proxy/...")` with `credentials: "include"` so the
browser's session cookie rides along to the proxy route (same origin).

Inside the proxy handler:

```ts
const session = await auth.api.getSession({ headers: await headers() });

if (session?.session) {
  forwardHeaders["x-session-token"] = session.session.token;
  forwardHeaders["x-user-id"] = session.user.id;
}
```

The Go API looks up `x-session-token` in the shared `sessions` table and
resolves the user. Because both apps write to the same table, a session
created by kim or web works transparently on the Go side.

This means the Go API never has to know whether a request came from 1tt.dev
or kim1.ai — it only cares about the session token.

## Public routes

Not everything on kim requires auth. The `AuthGate` component has an
explicit allow-list:

```ts
const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");
const isPublicRoute = isLoginRoute || pathname.startsWith("/m/");
```

`/login` and `/m/[slug]` render without the authenticated shell and
without a session. The gate returns `null` for all other paths until
`useSession()` resolves, so authenticated pages never fire API calls while
the session is still loading.

## Where the actual secrets live

See [env-and-secrets.md](./env-and-secrets.md) for the full story, but in
short:

| Layer | Where |
|---|---|
| Local dev | `apps/kim/.env.kim.development`, `apps/web/.env.web.development` (gitignored) |
| CI build | GitHub secret `ENV_VARS_KIM` / `ENV_VARS_WEB` — bundled dotenv, hydrated via `n1rna/ee-action` |
| Runtime | Cloudflare worker secrets set with `wrangler secret put` or `wrangler secret bulk` |

The source of truth is always the `.ee.kim` / `.ee.web` schema file plus
the local env file. Run `ee push github production` and
`ee push cloudflare production` to propagate changes.
