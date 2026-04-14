import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@1tt/api-client/auth-schema";

// Use Neon's stateless HTTP API + Drizzle adapter to avoid
// Cloudflare Workers' cross-request I/O restrictions.
// Each query is a standalone HTTP request - no WebSocket
// connections, no persistent I/O objects between requests.
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

// Resolve the cookie domain so the session is shared between the main site
// (1tt.dev) and the Kim subdomain (kim.1tt.dev). Also supports `lvh.me` for
// local development — lvh.me is a public DNS record (*.lvh.me → 127.0.0.1)
// whose cookies browsers do accept, unlike `.localhost`.
const authURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const cookieDomain = (() => {
  try {
    const host = new URL(authURL).hostname;
    // Strip an optional leading "kim." so the cookie covers the apex + any
    // subdomain under it.
    const apex = host.replace(/^kim\./, "");
    // Browsers reject .localhost as a cookie domain (it's on the Public
    // Suffix List). Skip cross-subdomain sharing on localhost entirely.
    if (apex === "localhost" || apex.endsWith(".localhost")) {
      return undefined;
    }
    return "." + apex;
  } catch {
    return undefined;
  }
})();
const isSecure = authURL.startsWith("https://");

export const auth = betterAuth({
  baseURL: authURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3003",
    "http://kim.localhost:3000",
    "http://lvh.me:3000",
    "http://kim.lvh.me:3000",
    "https://1tt.dev",
    "https://kim.1tt.dev",
    "https://1two.dev",
  ],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  advanced: {
    // Share session cookies across apex ↔ subdomain whenever the configured
    // host family allows it: `.1tt.dev` in prod, `.lvh.me` in dev.
    // `.localhost` is skipped because Chrome rejects it.
    crossSubDomainCookies: cookieDomain
      ? {
          enabled: true,
          domain: cookieDomain,
        }
      : undefined,
    defaultCookieAttributes: cookieDomain
      ? {
          sameSite: "lax",
          secure: isSecure,
        }
      : undefined,
  },
});
