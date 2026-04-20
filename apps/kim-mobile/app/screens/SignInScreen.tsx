import { FC } from "react"
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
 * Placeholder sign-in. Real Google OAuth via `expo-auth-session` +
 * `expo-secure-store` lands in QBL-69. For now a single "Continue" button
 * mints a fake token so we can exercise the authed side of the nav tree.
 */
export const SignInScreen: FC<SignInScreenProps> = () => {
  const { setAuthToken } = useAuth()
  const { themed } = useAppTheme()

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
        testID="continue-button"
        text="Continue (placeholder)"
        preset="reversed"
        onPress={() => setAuthToken(String(Date.now()))}
        style={themed($button)}
      />
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
  minWidth: 220,
  marginTop: spacing.md,
})
