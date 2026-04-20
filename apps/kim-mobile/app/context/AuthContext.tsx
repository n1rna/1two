import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { configureLifeClient } from "@1tt/api-client/life"

import Config from "@/config"
import { authClient, getStoredSessionToken } from "@/services/auth-client"

export type AuthContextType = {
  /** True once we have a non-expired session cached in SecureStore. */
  isAuthenticated: boolean
  /** The current better-auth user, or null when signed out. */
  user: AuthUser | null
  /** Initial bootstrap flag — true until SecureStore has been read once. */
  loading: boolean
  /** Kick off the OAuth flow for `provider` ("google" | "github"). */
  signIn: (provider: "google" | "github") => Promise<void>
  /** Clear the session on both the server and SecureStore. */
  logout: () => Promise<void>
}

export interface AuthUser {
  id: string
  email: string
  name?: string
  image?: string | null
}

export const AuthContext = createContext<AuthContextType | null>(null)

export interface AuthProviderProps {}

/**
 * Auth provider for kim-mobile. Wraps better-auth's `useSession` hook and
 * mirrors the current token into `configureLifeClient` so every api-client
 * call picks up `Authorization: Bearer <token>` automatically.
 */
export const AuthProvider: FC<PropsWithChildren<AuthProviderProps>> = ({ children }) => {
  const session = authClient.useSession()
  const [loading, setLoading] = useState(true)
  const tokenRef = useRef<string | null>(null)

  // Push the current bearer token into the shared api-client. We read from
  // SecureStore because better-auth's session hook returns user data but the
  // raw token lives in the expoClient storage.
  const refreshApiToken = useCallback(async () => {
    const t = await getStoredSessionToken()
    tokenRef.current = t
  }, [])

  useEffect(() => {
    configureLifeClient({
      baseUrl: Config.apiBaseUrl,
      credentials: "omit",
      getAuthToken: () => tokenRef.current,
    })
    refreshApiToken().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Whenever the better-auth session changes (sign-in/out), resync the token.
  useEffect(() => {
    if (session.isPending) return
    refreshApiToken()
  }, [session.data?.user?.id, session.isPending, refreshApiToken])

  const signIn = useCallback(async (provider: "google" | "github") => {
    await authClient.signIn.social({
      provider,
      callbackURL: "kim://auth/callback",
    })
    await refreshApiToken()
  }, [refreshApiToken])

  const logout = useCallback(async () => {
    await authClient.signOut()
    tokenRef.current = null
  }, [])

  const user = session.data?.user
    ? {
        id: session.data.user.id,
        email: session.data.user.email ?? "",
        name: session.data.user.name ?? undefined,
        image: session.data.user.image ?? null,
      }
    : null

  const value: AuthContextType = useMemo(
    () => ({
      isAuthenticated: !!user,
      user,
      loading: loading || session.isPending,
      signIn,
      logout,
    }),
    [user, loading, session.isPending, signIn, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}
