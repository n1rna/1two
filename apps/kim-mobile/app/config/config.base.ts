export interface ConfigBaseProps {
  persistNavigation: "always" | "dev" | "prod" | "never"
  catchErrors: "always" | "dev" | "prod" | "never"
  exitRoutes: string[]
  // Env-specific URLs get merged in from config.dev.ts / config.prod.ts.
  // Typed as optional here so the base object compiles, but the merged
  // Config used by the app always has them populated.
  authBaseUrl?: string
  apiBaseUrl?: string
  healthBaseUrl?: string
}

export interface EnvConfigProps {
  authBaseUrl: string
  apiBaseUrl: string
  healthBaseUrl: string
}

export type PersistNavigationConfig = ConfigBaseProps["persistNavigation"]

const BaseConfig: ConfigBaseProps = {
  // This feature is particularly useful in development mode, but
  // can be used in production as well if you prefer.
  persistNavigation: "dev",

  /**
   * Only enable if we're catching errors in the right environment
   */
  catchErrors: "always",

  /**
   * This is a list of all the route names that will exit the app if the back button
   * is pressed while in that screen. Only affects Android.
   */
  exitRoutes: ["Chat", "SignIn"],
}

export default BaseConfig
