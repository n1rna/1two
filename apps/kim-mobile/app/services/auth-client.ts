import { createAuthClient } from "better-auth/react"
import { expoClient } from "@better-auth/expo/client"
import * as SecureStore from "expo-secure-store"

import Config from "@/config"

/**
 * Mobile auth client. Talks to the same better-auth instance that powers
 * kim1.ai (see apps/kim/src/lib/auth.ts). The expo plugin plumbs deep-link
 * OAuth and bearer-token storage on top.
 *
 * The session token is persisted in `expo-secure-store` under the `kim_`
 * prefix. Every request the auth client makes automatically includes
 * `Authorization: Bearer <token>` once signed in — but calls to our Go API
 * don't go through this client, so `AuthProvider` also pushes the token
 * into `configureLifeClient` at startup (see context/AuthContext.tsx).
 */
export const authClient = createAuthClient({
  baseURL: Config.authBaseUrl,
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
