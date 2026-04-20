import { FC, useCallback, useEffect, useState } from "react"
import { FlatList, RefreshControl, TextStyle, View, ViewStyle } from "react-native"
import {
  listLifeConversations,
  type LifeConversation,
} from "@1tt/api-client/life"

import { ListItem } from "@/components/ListItem"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface ConversationsScreenProps extends AppStackScreenProps<"Conversations"> {}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

/**
 * Past conversations list. Tapping an item pops this screen so the Chat
 * tab below can pick the selection up — v1 keeps this simple: Chat
 * always reopens the most recent conversation on mount, so navigating
 * back here is sufficient to switch context. A dedicated selection
 * callback can land later if needed.
 */
export const ConversationsScreen: FC<ConversationsScreenProps> = ({ navigation }) => {
  const { themed, theme } = useAppTheme()
  const [items, setItems] = useState<LifeConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await listLifeConversations()
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <Screen preset="fixed" safeAreaEdges={[]} contentContainerStyle={themed($root)}>
      {error ? (
        <View style={themed($errorBox)}>
          <Text size="xs" style={themed($errorText)}>
            {error}
          </Text>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={themed($listContent)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.tint}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <Text size="xs" style={themed($empty)}>
              No past conversations yet.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <ListItem
            text={item.title || "Untitled"}
            bottomSeparator
            rightIcon="caretRight"
            onPress={() => navigation.goBack()}
          >
            <Text size="xxs" style={themed($meta)}>
              {item.channel} · {relative(item.updatedAt)}
            </Text>
          </ListItem>
        )}
      />
    </Screen>
  )
}

const $root: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $listContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingVertical: spacing.xs,
})

const $empty: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  textAlign: "center",
  padding: spacing.xl,
})

const $meta: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  textTransform: "uppercase",
  letterSpacing: 1,
})

const $errorBox: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.errorBackground,
  padding: spacing.md,
  margin: spacing.md,
  borderRadius: 10,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})
