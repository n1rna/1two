import { FC } from "react"
import { TextStyle, ViewStyle } from "react-native"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import type { ThemedStyle } from "@/theme/types"
import { useAppTheme } from "@/theme/context"

interface SettingsScreenProps extends MainTabScreenProps<"Settings"> {}

export const SettingsScreen: FC<SettingsScreenProps> = () => {
  const { logout } = useAuth()
  const { themed } = useAppTheme()
  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <Text preset="heading" style={themed($title)}>
        Settings
      </Text>
      <Text style={themed($body)}>Account + notification preferences — coming in QBL-76.</Text>

      <Button
        testID="sign-out-button"
        text="Sign out"
        preset="default"
        onPress={logout}
        style={themed($button)}
      />
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  padding: spacing.lg,
})

const $title: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.sm,
})

const $body: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginBottom: spacing.xl,
})

const $button: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.md,
})
