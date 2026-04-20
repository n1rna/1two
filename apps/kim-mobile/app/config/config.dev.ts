/**
 * These are configuration settings for the dev environment.
 *
 * Do not include API secrets in this file or anywhere in your JS.
 *
 * https://reactnative.dev/docs/security#storing-sensitive-info
 */
import type { EnvConfigProps } from "./config.base"

const DevConfig: EnvConfigProps = {
  // Kim web app hosts better-auth. The mobile app opens `authBaseUrl/api/auth/sign-in/...`
  // in the system browser, completes OAuth, and deep-links back via `kim://`.
  authBaseUrl: "http://lvh.me:3001",
  // Go backend for /life/* endpoints. In dev we hit the same host the API
  // server runs on (see `just api`). Swap to an absolute URL when testing
  // the mobile build against a remote deployment.
  apiBaseUrl: "http://lvh.me:3001/api/proxy/life",
}

export default DevConfig
