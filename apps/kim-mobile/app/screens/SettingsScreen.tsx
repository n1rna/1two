import { FC } from "react"
import { Alert, Image, ImageStyle, TextStyle, View, ViewStyle } from "react-native"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface SettingsScreenProps extends MainTabScreenProps<"Settings"> {}

const APP_VERSION = "v0.0.1"

export const SettingsScreen: FC<SettingsScreenProps> = () => {
  const { user, logout } = useAuth()
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  const displayName = user?.name?.trim() || user?.email || "Signed-in user"
  const avatarLetter = (user?.name?.trim()?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()

  const confirmSignOut = () => {
    Alert.alert(
      "Sign out of Kim?",
      "You'll need to sign in again to access your chats.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => {
            void logout()
          },
        },
      ],
      { cancelable: true },
    )
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <Text preset="heading" style={themed($title)}>
        Settings
      </Text>

      <Card
        style={themed($accountCard)}
        verticalAlignment="center"
        LeftComponent={
          <View style={themed($avatarWrap)}>
            {user?.image ? (
              <Image source={{ uri: user.image }} style={themed($avatarImage)} />
            ) : (
              <View style={themed($avatarFallback)}>
                <Text style={themed($avatarLetter)}>{avatarLetter}</Text>
              </View>
            )}
          </View>
        }
        ContentComponent={
          <View>
            <Text weight="bold" style={themed($accountName)}>
              {displayName}
            </Text>
            {user?.email && user.name ? (
              <Text style={themed($accountEmail)}>{user.email}</Text>
            ) : null}
          </View>
        }
      />

      <Button
        testID="sign-out-button"
        text="Sign out"
        preset="default"
        onPress={confirmSignOut}
        style={themed($signOutButton)}
        textStyle={{ color: colors.error }}
      />

      <View style={themed($footer)}>
        <Text style={themed($footerText)}>{APP_VERSION} · Kim agent</Text>
      </View>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  padding: spacing.lg,
})

const $title: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
})

const $accountCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.xl,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
})

const $avatarWrap: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  height: 48,
  justifyContent: "center",
  width: 48,
})

const $avatarImage: ThemedStyle<ImageStyle> = () => ({
  borderRadius: 24,
  height: 48,
  width: 48,
})

const $avatarFallback: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.secondary100,
  borderRadius: 24,
  height: 48,
  justifyContent: "center",
  width: 48,
})

const $avatarLetter: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.neutral100,
  fontSize: 20,
  fontWeight: "700",
})

const $accountName: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontSize: 16,
})

const $accountEmail: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  fontSize: 13,
  marginTop: spacing.xxxs,
})

const $signOutButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderColor: colors.error,
  marginTop: spacing.sm,
})

const $footer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  marginTop: "auto",
  paddingBottom: spacing.md,
})

const $footerText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 11,
  letterSpacing: 1.4,
})
