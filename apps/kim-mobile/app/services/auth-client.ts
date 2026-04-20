import { createAuthClient } from "better-auth/react"
import { expoClient } from "@better-auth/expo/client"
import * as SecureStore from "expo-secure-store"
import * as WebBrowser from "expo-web-browser"

import Config from "@/config"

/**
 * Mobile auth client. Talks to the same better-auth instance that powers
 * kim1.ai (see apps/kim/src/lib/auth.ts). The expo plugin plumbs the
 * session hook and bearer-token storage on top; we still use it for
 * `useSession` / `signOut` / cookie persistence.
 *
 * The expo plugin's built-in `signIn.social` is bypassed by the custom
 * `signInSocialMobile` below because our deployed kim1.ai double-decodes
 * the query string (appears to be an opennextjs-cloudflare quirk), which
 * drops the `state` param inside the encoded `authorizationURL`. Sending
 * the authorization URL double-encoded sidesteps the bug.
 */
export const authClient = createAuthClient({
  // better-auth expects the `/api/auth` path on the baseURL — the client
  // hits `${baseURL}/sign-in/social` etc. without adding the prefix itself.
  baseURL: `${Config.authBaseUrl}/api/auth`,
  plugins: [
    expoClient({
      scheme: "kim",
      storagePrefix: "kim",
      storage: SecureStore,
    }),
  ],
})

/** Raw session token, or null if unauthenticated. Read from SecureStore. */
export async function getStoredSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync("kim_session")
  } catch {
    return null
  }
}

/**
 * Replacement for `authClient.signIn.social` that double-encodes the
 * authorizationURL when forwarding through better-auth's
 * `/expo-authorization-proxy`. This dodges a Next.js-on-Cloudflare
 * double-decode that otherwise strips the OAuth `state` param out of
 * authorizationURL, triggering a 400 "Unexpected error" on the proxy.
 *
 * The rest of the flow is identical to the expo plugin's built-in:
 *  - POST /sign-in/social to get the provider OAuth URL
 *  - open system browser via WebBrowser.openAuthSessionAsync
 *  - on success, extract the session cookie from the callback URL and
 *    hand it back to the expo plugin via its storage prefix so the
 *    `useSession` hook picks it up.
 */
export async function signInSocialMobile(
  provider: "google" | "github",
): Promise<void> {
  const base = `${Config.authBaseUrl}/api/auth`

  // Step 1: ask better-auth for the provider OAuth URL.
  const res = await fetch(`${base}/sign-in/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      callbackURL: "kim://auth/callback",
    }),
  })
  if (!res.ok) {
    throw new Error(`sign-in failed (${res.status})`)
  }
  const data = (await res.json()) as { url?: string; redirect?: boolean }
  if (!data.url) {
    throw new Error("no provider URL returned")
  }

  // Step 2: build the proxy URL with *double-encoded* authorizationURL so
  // the server's double-decode ends up with the single-encoded value at
  // the endpoint. Normal single-encode gets mangled into a 400.
  const doubleEncoded = encodeURIComponent(encodeURIComponent(data.url))
  const proxyURL = `${base}/expo-authorization-proxy?authorizationURL=${doubleEncoded}`

  // Step 3: open browser, wait for the kim:// callback deep link.
  const result = await WebBrowser.openAuthSessionAsync(
    proxyURL,
    "kim://auth/callback",
  )
  if (result.type !== "success") return

  // Step 4: pull the Set-Cookie header string from the callback URL, turn
  // it into the JSON jar shape expected by @better-auth/expo/client, and
  // store under the `kim_cookie` key so `authClient.useSession()` starts
  // returning the user. Mirrors what better-auth's onSuccess hook does
  // internally — inlined here because those helpers aren't exported.
  const cookieHeader = new URL(result.url).searchParams.get("cookie")
  if (!cookieHeader) return
  const jar = parseSetCookieToJar(cookieHeader)
  await SecureStore.setItemAsync("kim_cookie", JSON.stringify(jar))
  // Nudge the session atom so subscribers refetch.
  ;(authClient as unknown as { $store?: { notify: (k: string) => void } }).$store?.notify(
    "$sessionSignal",
  )
}

interface CookieJarEntry {
  value: string
  expires: string | null
}

// Minimal Set-Cookie header parser. Splits on commas that separate cookies
// (naive but matches what better-auth returns in callback URL), then pulls
// name=value and a max-age/expires hint. Enough for session + oauth cookies.
function parseSetCookieToJar(header: string): Record<string, CookieJarEntry> {
  const jar: Record<string, CookieJarEntry> = {}
  // Better-auth joins cookies with ", " — but a cookie's `Expires=` attribute
  // can contain a comma. Split on ", " preceded by a word+`=` to be safer.
  const cookies = header.split(/,(?=\s*[A-Za-z0-9_\-.]+=)/)
  for (const raw of cookies) {
    const parts = raw.split(";").map((s) => s.trim())
    if (parts.length === 0 || !parts[0]) continue
    const firstEq = parts[0].indexOf("=")
    if (firstEq <= 0) continue
    const name = parts[0].slice(0, firstEq)
    const value = parts[0].slice(firstEq + 1)
    let expiresISO: string | null = null
    for (let i = 1; i < parts.length; i++) {
      const attr = parts[i]
      const [k, v] = attr.split("=")
      if (!k) continue
      if (k.toLowerCase() === "max-age" && v) {
        const ms = Date.now() + Number(v) * 1000
        if (Number.isFinite(ms)) expiresISO = new Date(ms).toISOString()
        break
      }
      if (k.toLowerCase() === "expires" && v) {
        const d = new Date(v)
        if (!Number.isNaN(d.getTime())) expiresISO = d.toISOString()
      }
    }
    jar[name] = { value, expires: expiresISO }
  }
  return jar
}
