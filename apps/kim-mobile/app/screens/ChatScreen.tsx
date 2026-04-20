import { FC } from "react"
import { TextStyle, ViewStyle } from "react-native"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import type { ThemedStyle } from "@/theme/types"
import { useAppTheme } from "@/theme/context"

interface ChatScreenProps extends MainTabScreenProps<"Chat"> {}

export const ChatScreen: FC<ChatScreenProps> = () => {
  const { themed } = useAppTheme()
  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <Text preset="heading" style={themed($title)}>
        Chat
      </Text>
      <Text style={themed($body)}>Streaming chat with Kim — coming in QBL-71.</Text>
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

const $body: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})
