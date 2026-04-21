import { FC, useCallback, useEffect, useMemo, useState } from "react"
import { Alert, RefreshControl, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { useIsFocused } from "@react-navigation/native"
import {
  bulkDismissActionables,
  listLifeActionables,
  respondToActionable,
  type LifeActionable,
} from "@1tt/api-client/life"
import { groupByBucket, type TimeBucket } from "@1tt/api-client/life-group"

import { ActionableCard } from "@/components/ActionableCard"
import { ActivityListModal } from "@/components/ActivityListModal"
import { ActivityPulseDot } from "@/components/ActivityPulseDot"
import { Button } from "@/components/Button"
import { EmptyState } from "@/components/EmptyState"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAgentRunsPulse } from "@/hooks/useAgentRunsPulse"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface ActionablesScreenProps extends MainTabScreenProps<"Actionables"> {}

function bucketLabel(b: TimeBucket): string {
  switch (b) {
    case "tomorrow":
      return "Tomorrow"
    case "today":
      return "Today"
    case "yesterday":
      return "Yesterday"
    case "older":
    default:
      return "Older"
  }
}

export const ActionablesScreen: FC<ActionablesScreenProps> = () => {
  const { themed, theme } = useAppTheme()
  const [items, setItems] = useState<LifeActionable[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showResolved, setShowResolved] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  // Chat and Actionables both mount the pulse hook; the focused screen
  // gets the 5s cadence, the unfocused one idles at 30s.
  const isFocused = useIsFocused()
  const { running, count } = useAgentRunsPulse({ active: isFocused })

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await listLifeActionables()
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const pending = useMemo(() => items.filter((a) => a.status === "pending"), [items])
  const resolved = useMemo(() => items.filter((a) => a.status !== "pending"), [items])

  const sortedPending = useMemo(
    () =>
      [...pending].sort((a, b) => {
        if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
        if (a.dueAt) return -1
        if (b.dueAt) return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }),
    [pending],
  )
  const grouped = useMemo(() => groupByBucket(sortedPending), [sortedPending])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const respond = useCallback(
    async (id: string, action: string, data?: unknown) => {
      await respondToActionable(id, action, data)
      setItems((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: action === "dismiss" ? "dismissed" : "confirmed",
                resolvedAt: new Date().toISOString(),
              }
            : a,
        ),
      )
      load()
    },
    [load],
  )

  const skipSelected = async () => {
    if (selected.size === 0) return
    setBulkBusy(true)
    try {
      await bulkDismissActionables({ ids: Array.from(selected) })
      setSelected(new Set())
      setSelectMode(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBulkBusy(false)
    }
  }

  const skipAll = () => {
    if (pending.length === 0) return
    Alert.alert("Dismiss all?", `Dismiss all ${pending.length} pending actionable(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Dismiss",
        style: "destructive",
        onPress: async () => {
          setBulkBusy(true)
          try {
            await bulkDismissActionables({ allPending: true })
            setSelected(new Set())
            setSelectMode(false)
            await load()
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
          } finally {
            setBulkBusy(false)
          }
        },
      },
    ])
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($root)}>
      <View style={themed($header)}>
        <View style={{ flex: 1 }}>
          <Text preset="heading">Actionables</Text>
          <Text size="xs" style={themed($subtitle)}>
            {pending.length > 0
              ? `${pending.length} pending${resolved.length ? ` · ${resolved.length} resolved` : ""}`
              : "All caught up"}
          </Text>
        </View>
        <ActivityPulseDot
          running={running}
          count={count}
          onPress={() => setActivityOpen(true)}
        />
        {pending.length > 0 ? (
          <Button
            text={selectMode ? "Done" : "Select"}
            preset="default"
            onPress={selectMode ? exitSelectMode : () => setSelectMode(true)}
            style={themed($headerButton)}
          />
        ) : null}
      </View>

      {selectMode ? (
        <View style={themed($bulkBar)}>
          <Text size="xs" style={themed($bulkCount)}>
            {selected.size} selected
          </Text>
          <View style={{ flex: 1 }} />
          <Button
            text="Skip selected"
            preset="reversed"
            disabled={bulkBusy || selected.size === 0}
            onPress={skipSelected}
            style={themed($bulkButton)}
          />
          <Button
            text="Skip all"
            preset="default"
            disabled={bulkBusy || pending.length === 0}
            onPress={skipAll}
            style={themed($bulkButton)}
          />
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={themed($scrollContent)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.tint} />
        }
      >
        {error ? (
          <View style={themed($errorBox)}>
            <Text size="xs" style={themed($errorText)}>
              {error}
            </Text>
            <Button text="Retry" preset="default" onPress={load} />
          </View>
        ) : null}

        {loading && items.length === 0 ? (
          <Text size="xs" style={themed($muted)}>
            Loading…
          </Text>
        ) : null}

        {!loading && pending.length === 0 && !error ? (
          <EmptyState
            preset="generic"
            heading="All caught up"
            content="No items need your attention right now."
            button=""
          />
        ) : null}

        {grouped.map((group) => (
          <View key={group.bucket} style={themed($section)}>
            <Text size="xxs" style={themed($bucketHeader)}>
              {bucketLabel(group.bucket).toUpperCase()} · {group.items.length}
            </Text>
            {group.items.map((a) => (
              <ActionableCard
                key={a.id}
                actionable={a}
                onRespond={respond}
                selectMode={selectMode}
                selected={selected.has(a.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </View>
        ))}

        {resolved.length > 0 ? (
          <View style={themed($section)}>
            <Button
              text={showResolved ? `Hide resolved (${resolved.length})` : `Show resolved (${resolved.length})`}
              preset="default"
              onPress={() => setShowResolved((s) => !s)}
            />
            {showResolved
              ? resolved.slice(0, 20).map((a) => (
                  <View key={a.id} style={themed($resolvedItem)}>
                    <Text size="xs" style={themed($resolvedText)}>
                      {a.status === "confirmed" ? "✓ " : "✗ "} {a.title}
                    </Text>
                  </View>
                ))
              : null}
          </View>
        ) : null}
      </ScrollView>

      <ActivityListModal
        visible={activityOpen}
        onClose={() => setActivityOpen(false)}
        onNavigateActionables={() => setActivityOpen(false)}
      />
    </Screen>
  )
}

const $root: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.md,
  paddingBottom: spacing.sm,
  gap: spacing.sm,
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $headerButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  minHeight: 36,
  paddingHorizontal: spacing.md,
})

const $bulkBar: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
  backgroundColor: colors.palette.neutral200,
  borderBottomColor: colors.border,
  borderBottomWidth: 1,
})

const $bulkCount: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontWeight: "600",
})

const $bulkButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  minHeight: 36,
  paddingHorizontal: spacing.sm,
})

const $scrollContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
  paddingTop: spacing.sm,
})

const $section: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

const $bucketHeader: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  letterSpacing: 1,
  fontWeight: "700",
  marginBottom: spacing.xs,
})

const $resolvedItem: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  paddingVertical: spacing.xxs,
  borderBottomColor: colors.border,
  borderBottomWidth: 1,
})

const $resolvedText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  textDecorationLine: "line-through",
})

const $errorBox: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.errorBackground,
  padding: spacing.md,
  borderRadius: 10,
  marginBottom: spacing.sm,
  gap: spacing.xs,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})

const $muted: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  padding: spacing.md,
})
