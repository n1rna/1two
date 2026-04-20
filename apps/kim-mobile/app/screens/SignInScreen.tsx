import { FC, useState } from "react"
import { TextStyle, ViewStyle } from "react-native"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import type { ThemedStyle } from "@/theme/types"
import { useAppTheme } from "@/theme/context"

interface SignInScreenProps extends AppStackScreenProps<"SignIn"> {}

/**
 * Sign-in screen. Taps open the system browser via better-auth's expo plugin,
 * complete OAuth on kim1.ai, and deep-link back to `kim://auth/callback` with
 * the session token which gets persisted in SecureStore.
 */
export const SignInScreen: FC<SignInScreenProps> = () => {
  const { signIn } = useAuth()
  const { themed } = useAppTheme()
  const [busy, setBusy] = useState<"google" | "github" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async (provider: "google" | "github") => {
    setError(null)
    setBusy(provider)
    try {
      await signIn(provider)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Screen
      preset="auto"
      contentContainerStyle={themed($container)}
      safeAreaEdges={["top", "bottom"]}
    >
      <Text preset="heading" style={themed($title)}>
        kim
      </Text>
      <Text preset="subheading" style={themed($subtitle)}>
        Your life planner. Sign in to continue.
      </Text>

      <Button
        testID="google-signin-button"
        text={busy === "google" ? "Opening browser…" : "Continue with Google"}
        preset="reversed"
        onPress={() => handleSignIn("google")}
        disabled={busy !== null}
        style={themed($button)}
      />
      <Button
        testID="github-signin-button"
        text={busy === "github" ? "Opening browser…" : "Continue with GitHub"}
        preset="default"
        onPress={() => handleSignIn("github")}
        disabled={busy !== null}
        style={themed($button)}
      />

      {error ? <Text style={themed($error)}>{error}</Text> : null}
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: spacing.xl,
})

const $title: ThemedStyle<TextStyle> = ({ spacing }) => ({
  fontSize: 56,
  marginBottom: spacing.sm,
})

const $subtitle: ThemedStyle<TextStyle> = ({ spacing, colors }) => ({
  color: colors.textDim,
  textAlign: "center",
  marginBottom: spacing.xxl,
})

const $button: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  minWidth: 260,
  marginTop: spacing.sm,
})

const $error: ThemedStyle<TextStyle> = ({ spacing, colors }) => ({
  marginTop: spacing.lg,
  color: colors.error,
  textAlign: "center",
})
