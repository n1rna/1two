/**
 * These are configuration settings for the production environment.
 *
 * Do not include API secrets in this file or anywhere in your JS.
 *
 * https://reactnative.dev/docs/security#storing-sensitive-info
 */
import type { EnvConfigProps } from "./config.base"

const ProdConfig: EnvConfigProps = {
  authBaseUrl: "https://kim1.ai",
  apiBaseUrl: "https://kim1.ai/api/proxy/life",
}

export default ProdConfig
