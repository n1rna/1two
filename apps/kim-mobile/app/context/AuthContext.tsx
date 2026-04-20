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
import { authClient, signInSocialMobile } from "@/services/auth-client"

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
  // Track session token in a ref so the life-client callback reads the
  // latest value without re-registering on every render. Mirrored from
  // useSession — same raw DB token the web proxy forwards as X-Session-Token.
  const tokenRef = useRef<string | null>(null)
  tokenRef.current = session.data?.session?.token ?? null

  useEffect(() => {
    configureLifeClient({
      baseUrl: Config.apiBaseUrl,
      credentials: "omit",
      getAuthToken: () => tokenRef.current,
    })
    // One-tick delay so useSession has a chance to hydrate from storage.
    const id = setTimeout(() => setLoading(false), 50)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = useCallback(async (provider: "google" | "github") => {
    await signInSocialMobile(provider)
  }, [])

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
