import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@1tt/api-client/auth-schema";

// Use Neon's stateless HTTP API + Drizzle adapter to avoid
// Cloudflare Workers' cross-request I/O restrictions.
// Each query is a standalone HTTP request - no WebSocket
// connections, no persistent I/O objects between requests.
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

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
const isSecure = authURL.startsWith("https://");

export const auth = betterAuth({
  baseURL: authURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    "http://localhost:3001",
    "http://lvh.me:3001",
    "https://kim1.ai",
    "https://www.kim1.ai",
    // kim-mobile uses the `kim://` deep-link scheme for OAuth callbacks.
    // Without this, better-auth rejects the redirect as untrusted.
    "kim://",
  ],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // `expo()` teaches better-auth to treat Expo/RN clients as first-class:
  // it exposes a `/get-session` endpoint that returns the session token for
  // bearer-auth clients, and accepts the `kim://` callback without a cookie
  // jar. The matching client plugin lives in apps/kim-mobile.
  plugins: [expo()],
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
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
