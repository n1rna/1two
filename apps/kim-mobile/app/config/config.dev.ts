/**
 * These are configuration settings for the dev environment.
 *
 * Do not include API secrets in this file or anywhere in your JS.
 *
 * https://reactnative.dev/docs/security#storing-sensitive-info
 */
import type { EnvConfigProps } from "./config.base"

const DevConfig: EnvConfigProps = {
  // Mobile dev points at the production kim1.ai web + API. Local dev against
  // `lvh.me:3001` doesn't work for OAuth because Google's registered callback
  // URL must match what the mobile app opens in the browser, and Google rejects
  // `10.0.2.2` / `lvh.me` variants it hasn't been registered against.
  authBaseUrl: "https://kim1.ai",
  apiBaseUrl: "https://kim1.ai/api/proxy/life",
  healthBaseUrl: "https://kim1.ai/api/proxy/health",
}

export default DevConfig
