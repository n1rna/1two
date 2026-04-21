import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import {
  listLifeAgentRuns,
  type LifeAgentRun,
} from "@1tt/api-client/life"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"]

export interface ActivityListModalProps {
  visible: boolean
  onClose: () => void
  /** Called when the user taps an "N actionables" link on a run row. */
  onNavigateActionables?: () => void
}

/**
 * Full-screen slide-up modal listing the last 50 background agent runs.
 * Mobile port of the web ActivitySection (full mode). Unlike web, we poll
 * listLifeAgentRuns every 5s while the modal is open instead of consuming
 * the SSE stream — simpler, and good enough at this scale.
 */
export const ActivityListModal: FC<ActivityListModalProps> = ({
  visible,
  onClose,
  onNavigateActionables,
}) => {
  const { themed, theme } = useAppTheme()
  const [runs, setRuns] = useState<LifeAgentRun[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const fetchRuns = useCallback(async () => {
    try {
      const res = await listLifeAgentRuns({ limit: 50 })
      if (!mounted.current) return
      setRuns(res.runs)
    } catch {
      // swallow; empty state is fine.
    }
  }, [])

  // Poll every 5s while the modal is open. Pause polling entirely when
  // closed — no stale timers in the background.
  useEffect(() => {
    if (!visible) return
    setLoading(runs.length === 0)
    void fetchRuns().finally(() => {
      if (mounted.current) setLoading(false)
    })
    const h = setInterval(() => void fetchRuns(), 5000)
    return () => clearInterval(h)
    // Intentionally omitting `runs.length` — we only want the timer tied
    // to `visible`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fetchRuns])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchRuns()
    if (mounted.current) setRefreshing(false)
  }, [fetchRuns])

  const hasActive = useMemo(
    () => runs.some((r) => r.status === "running"),
    [runs],
  )

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "overFullScreen"}
      transparent={Platform.OS === "android"}
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={["top", "bottom"]}
        style={themed($container)}
      >
        <View style={themed($header)}>
          <View style={themed($headerLeft)}>
            {hasActive ? <HeaderPulse /> : null}
            <Text preset="heading" style={themed($title)}>
              Activity
            </Text>
            <Text style={themed($countText)}>· {runs.length}</Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close activity"
            style={themed($closeBtn)}
          >
            <Ionicons name="close" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        {loading && runs.length === 0 ? (
          <View style={themed($loadingBox)}>
            <ActivityIndicator color={theme.colors.tint} />
          </View>
        ) : runs.length === 0 ? (
          <View style={themed($emptyBox)}>
            <Text style={themed($emptyText)}>No recent activity.</Text>
          </View>
        ) : (
          <FlatList
            data={runs}
            keyExtractor={(r) => r.id}
            contentContainerStyle={themed($listContent)}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.tint}
              />
            }
            renderItem={({ item }) => (
              <ActivityRunRow
                run={item}
                expanded={expandedId === item.id}
                onToggle={() =>
                  setExpandedId((cur) => (cur === item.id ? null : item.id))
                }
                onNavigateActionables={onNavigateActionables}
                onClose={onClose}
              />
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

// ─── Header pulse ────────────────────────────────────────────────────────────

const HeaderPulse: FC = () => {
  const { themed, theme } = useAppTheme()
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.3, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
  }, [scale])
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  return (
    <View style={themed($headerDotWrap)}>
      <Animated.View
        style={[
          themed($headerDot),
          { backgroundColor: theme.colors.palette.primary400 },
          animatedStyle,
        ]}
      />
    </View>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

const ActivityRunRow: FC<{
  run: LifeAgentRun
  expanded: boolean
  onToggle: () => void
  onNavigateActionables?: () => void
  onClose: () => void
}> = ({ run, expanded, onToggle, onNavigateActionables, onClose }) => {
  const { themed, theme } = useAppTheme()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (run.status !== "running") return
    const h = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(h)
  }, [run.status])

  const kindIcon: IoniconsName =
    run.kind === "journey" ? "git-branch-outline" : "ellipse-outline"
  const startedMs = new Date(run.startedAt).getTime()
  const elapsedSec =
    run.status === "running"
      ? Math.max(0, Math.round((now - startedMs) / 1000))
      : run.durationMs != null
        ? Math.round(run.durationMs / 1000)
        : null
  const producedCount = run.producedActionableIds.length

  return (
    <View style={themed($card)}>
      <Pressable
        onPress={onToggle}
        style={themed($cardBody)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Ionicons
          name={kindIcon}
          size={14}
          color={theme.colors.palette.primary400}
          style={themed($kindIcon)}
        />
        <View style={themed($cardText)}>
          <Text size="xs" numberOfLines={1} style={themed($cardTitle)}>
            {run.title || run.kind}
          </Text>
          {run.subtitle ? (
            <Text size="xxs" numberOfLines={1} style={themed($cardSubtitle)}>
              {run.subtitle}
            </Text>
          ) : null}
        </View>
        <StatusPill run={run} elapsedSec={elapsedSec} />
      </Pressable>

      {expanded ? (
        <View style={themed($expanded)}>
          {run.resultSummary ? (
            <Text size="xxs" style={themed($summaryText)}>
              {run.resultSummary}
            </Text>
          ) : null}
          {run.error ? (
            <View style={themed($errorRow)}>
              <Ionicons
                name="alert-circle"
                size={12}
                color={theme.colors.error}
                style={themed($errorIcon)}
              />
              <Text size="xxs" style={themed($errorText)}>
                {truncate(run.error, 240)}
              </Text>
            </View>
          ) : null}
          {run.toolCalls.length > 0 ? (
            <View style={themed($toolList)}>
              {run.toolCalls.slice(0, 8).map((tc, idx) => (
                <View key={idx} style={themed($toolRow)}>
                  <Text style={themed($toolBullet)}>·</Text>
                  <Text size="xxs" style={themed($toolName)} numberOfLines={1}>
                    {tc.tool}
                  </Text>
                  {tc.error ? (
                    <Text size="xxs" style={themed($toolError)}>
                      · failed
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          {producedCount > 0 && onNavigateActionables ? (
            <Pressable
              onPress={() => {
                onClose()
                onNavigateActionables()
              }}
              style={themed($actionablesLink)}
              hitSlop={6}
            >
              <Text style={themed($actionablesLinkText)}>
                {producedCount} actionable{producedCount === 1 ? "" : "s"}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={12}
                color={theme.colors.palette.primary400}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

// ─── Status pill ─────────────────────────────────────────────────────────────

const StatusPill: FC<{ run: LifeAgentRun; elapsedSec: number | null }> = ({
  run,
  elapsedSec,
}) => {
  const { themed, theme } = useAppTheme()

  if (run.status === "running") {
    return (
      <View
        style={[
          themed($pill),
          { borderColor: theme.colors.palette.primary400 },
        ]}
      >
        <SpinningSync color={theme.colors.palette.primary400} />
        <Text
          style={[themed($pillText), { color: theme.colors.palette.primary400 }]}
        >
          {elapsedSec != null ? `${elapsedSec}s` : "running"}
        </Text>
      </View>
    )
  }
  if (run.status === "completed") {
    return (
      <View style={[themed($pill), { borderColor: theme.colors.border }]}>
        <Ionicons name="checkmark" size={10} color={theme.colors.textDim} />
        <Text style={[themed($pillText), { color: theme.colors.textDim }]}>
          {elapsedSec != null ? `${elapsedSec}s` : "done"}
        </Text>
      </View>
    )
  }
  return (
    <View style={[themed($pill), { borderColor: theme.colors.error }]}>
      <Ionicons name="alert-circle" size={10} color={theme.colors.error} />
      <Text style={[themed($pillText), { color: theme.colors.error }]}>
        failed
      </Text>
    </View>
  )
}

const SpinningSync: FC<{ color: string }> = ({ color }) => {
  const rot = useSharedValue(0)
  useEffect(() => {
    rot.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    )
  }, [rot])
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value * 360}deg` }],
  }))
  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name="sync-outline" size={10} color={color} />
    </Animated.View>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 3) + "..." : s
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const $container: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  backgroundColor: colors.background,
})

const $header: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
  borderBottomColor: colors.border,
  borderBottomWidth: 1,
  gap: spacing.sm,
})

const $headerLeft: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $title: ThemedStyle<TextStyle> = () => ({
  fontSize: 20,
})

const $countText: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 12,
  color: colors.textDim,
  letterSpacing: 1,
  fontVariant: ["tabular-nums"],
})

const $closeBtn: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.xs,
})

const $loadingBox: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
})

const $emptyBox: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  padding: spacing.xl,
})

const $emptyText: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontStyle: "italic",
  color: colors.textDim,
  fontSize: 13,
})

const $listContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.md,
  gap: spacing.xs,
})

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderRadius: 8,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.palette.neutral100,
  marginBottom: spacing.xs,
  overflow: "hidden",
})

const $cardBody: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: spacing.sm,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
})

const $kindIcon: ThemedStyle<ViewStyle> = () => ({
  marginTop: 2,
})

const $cardText: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  minWidth: 0,
})

const $cardTitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontWeight: "500",
})

const $cardSubtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  marginTop: 2,
})

const $pill: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  borderWidth: 1,
  borderRadius: 4,
  paddingHorizontal: spacing.xs,
  paddingVertical: 2,
})

const $pillText: ThemedStyle<TextStyle> = () => ({
  fontSize: 10,
  letterSpacing: 0.8,
  fontVariant: ["tabular-nums"],
})

const $expanded: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  paddingHorizontal: spacing.sm,
  paddingBottom: spacing.sm,
  paddingTop: spacing.xs,
  borderTopColor: colors.border,
  borderTopWidth: 1,
  gap: spacing.xs,
})

const $summaryText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  lineHeight: 16,
})

const $errorRow: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 6,
})

const $errorIcon: ThemedStyle<ViewStyle> = () => ({
  marginTop: 2,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
  flex: 1,
  fontSize: 11,
})

const $toolList: ThemedStyle<ViewStyle> = () => ({
  gap: 2,
})

const $toolRow: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
})

const $toolBullet: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.primary400,
  fontSize: 11,
})

const $toolName: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 11,
  flexShrink: 1,
})

const $toolError: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
  fontSize: 11,
})

const $actionablesLink: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  marginTop: spacing.xs,
  alignSelf: "flex-start",
})

const $actionablesLinkText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.primary400,
  fontSize: 11,
  letterSpacing: 0.5,
  textTransform: "uppercase",
})

const $headerDotWrap: ThemedStyle<ViewStyle> = () => ({
  width: 10,
  height: 10,
  alignItems: "center",
  justifyContent: "center",
  marginRight: 4,
})

const $headerDot: ThemedStyle<ViewStyle> = () => ({
  width: 8,
  height: 8,
  borderRadius: 4,
})
