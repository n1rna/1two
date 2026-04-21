import { FC, useState } from "react"
import {
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"
import { AntDesign, FontAwesome } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"

interface SignInScreenProps extends AppStackScreenProps<"SignIn"> {}

// Web login is always dark — force these colors regardless of system theme.
const DARK_BG = "#0A0A0B"
const CARD_BG = "#141416"
const BORDER = "#26262A"
const BORDER_HOVER = "#3F3F46"
const TEAL_ACCENT = "#5F9598"
const ZINC_50 = "#F3F4F4"
const ZINC_200 = "#E4E4E7"
const ZINC_500 = "#71717A"
const ZINC_600 = "#52525B"
const CARD_PRESSED = "#1A1A1D"
const GLOW = "rgba(95,149,152,0.12)"
const EMERALD = "#34D399"
const ERROR = "#DC2626"

// Prefer a serif display face that ships with each platform for the italic wordmark.
const SERIF_DISPLAY = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia",
})

/**
 * Sign-in screen. Taps open the system browser via better-auth's expo plugin,
 * complete OAuth on kim1.ai, and deep-link back to `kim://auth/callback` with
 * the session token which gets persisted in SecureStore.
 *
 * Visual language mirrors apps/kim/src/app/login/login-content.tsx —
 * always-dark surface, italic serif wordmark, mono/uppercase tagline,
 * dark provider cards with teal arrow affordance. Layout is adapted for
 * mobile (single column, no typed-transcript showcase).
 */
export const SignInScreen: FC<SignInScreenProps> = () => {
  const { signIn } = useAuth()
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

  const disabled = busy !== null

  return (
    <View style={styles.root}>
      {/* Subtle teal glow in the top-right corner — a flat-opacity stand-in
          for the web's radial gradient since expo-linear-gradient isn't bundled. */}
      <View pointerEvents="none" style={styles.ambientGlow} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          {/* Status row — mono uppercase, mirrors the web "agent online" chip */}
          <View style={styles.statusRow}>
            <View style={styles.statusDotWrap}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>AGENT ONLINE</Text>
            </View>
            <Text style={styles.statusText}>v0.0.1</Text>
          </View>

          <View style={styles.hero}>
            <Text style={styles.wordmark}>kim</Text>
            <Text style={styles.tagline}>YOUR LIFE PLANNER — ONE CONVERSATION AWAY</Text>
          </View>

          <View style={styles.buttons}>
            <ProviderButton
              testID="google-signin-button"
              label="Continue with Google"
              icon={<AntDesign name="google" size={16} color={ZINC_200} />}
              loading={busy === "google"}
              disabled={disabled}
              onPress={() => handleSignIn("google")}
            />
            <ProviderButton
              testID="github-signin-button"
              label="Continue with GitHub"
              icon={<FontAwesome name="github" size={16} color={ZINC_200} />}
              loading={busy === "github"}
              disabled={disabled}
              onPress={() => handleSignIn("github")}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.footer}>
            <Text style={styles.footerText}>v1.0 · KIM AGENT</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}

interface ProviderButtonProps {
  label: string
  icon: React.ReactNode
  loading: boolean
  disabled: boolean
  onPress: () => void
  testID?: string
}

const ProviderButton: FC<ProviderButtonProps> = ({
  label,
  icon,
  loading,
  disabled,
  onPress,
  testID,
}) => {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View style={styles.buttonIcon}>{icon}</View>
      <Text style={styles.buttonLabel}>{loading ? "Opening browser…" : label}</Text>
      <Text style={styles.buttonArrow}>{loading ? "…" : "→"}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  ambientGlow: {
    backgroundColor: GLOW,
    borderRadius: 300,
    height: 420,
    position: "absolute",
    right: -180,
    top: -180,
    width: 420,
  },
  button: {
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  buttonArrow: {
    color: TEAL_ACCENT,
    fontFamily: Platform.select({ ios: "Courier", android: "monospace" }),
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonIcon: {
    alignItems: "center",
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  buttonLabel: {
    color: ZINC_200,
    flex: 1,
    fontSize: 14,
  } as TextStyle,
  buttonPressed: {
    backgroundColor: CARD_PRESSED,
    borderColor: BORDER_HOVER,
  },
  buttons: {
    gap: 12,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 24,
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  error: {
    color: ERROR,
    marginTop: 16,
    textAlign: "center",
  } as TextStyle,
  footer: {
    alignItems: "center",
    marginTop: 32,
  },
  footerText: {
    color: ZINC_600,
    fontFamily: Platform.select({ ios: "Courier", android: "monospace" }),
    fontSize: 10,
    letterSpacing: 2,
  } as TextStyle,
  hero: {
    marginTop: 40,
  },
  root: {
    backgroundColor: DARK_BG,
    flex: 1,
  } as ViewStyle,
  safe: {
    flex: 1,
  },
  statusDot: {
    backgroundColor: EMERALD,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  statusDotWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusText: {
    color: ZINC_500,
    fontFamily: Platform.select({ ios: "Courier", android: "monospace" }),
    fontSize: 10,
    letterSpacing: 2,
  } as TextStyle,
  tagline: {
    color: ZINC_500,
    fontFamily: Platform.select({ ios: "Courier", android: "monospace" }),
    fontSize: 11,
    letterSpacing: 1.6,
    marginTop: 12,
  } as TextStyle,
  wordmark: {
    color: ZINC_50,
    fontFamily: SERIF_DISPLAY,
    fontSize: 72,
    fontStyle: "italic",
    lineHeight: 76,
  } as TextStyle,
})
