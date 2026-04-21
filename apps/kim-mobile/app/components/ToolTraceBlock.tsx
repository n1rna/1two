import { FC, useEffect, useRef, useState } from "react"
import {
  Alert,
  Linking,
  Pressable,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import { Ionicons } from "@expo/vector-icons"
import type { ChatEffect } from "@1tt/api-client/life"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { toolMeta } from "./tool-labels"

// ─── Types ────────────────────────────────────────────────────────────────────

export type TraceState = "queued" | "active" | "done"

export interface TraceEntry {
  key: string
  effect?: ChatEffect
  toolName: string
  state: TraceState
}

export interface ToolTraceBlockProps {
  entries: TraceEntry[]
  streaming: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null
}

/**
 * Derives a short, right-aligned summary for a tool row. Mirrors the web's
 * detail picker in apps/kim/src/components/kim/tool-call-display.tsx.
 */
function deriveDetail(effect?: ChatEffect): string | null {
  if (!effect?.data) return null
  const data = effect.data
  if (effect.tool === "draft_form") {
    const form = pickString(data.form)
    const values = data.values as Record<string, unknown> | undefined
    const fields = values ? Object.keys(values).slice(0, 4).join(", ") : ""
    return form ? (fields ? `${form}: ${fields}` : form) : null
  }
  return (
    pickString(data.content) ??
    pickString(data.name) ??
    pickString(data.title) ??
    pickString(data.summary) ??
    (data.deleted ? "Deleted" : null) ??
    (data.forgotten ? "Removed" : null)
  )
}

// ─── Trace block ──────────────────────────────────────────────────────────────

/**
 * Mobile port of the web ToolTraceBlock. Renders a rounded panel with a
 * mono-ish header ("Working · Ns" / "Done · N steps") and one row per tool
 * call. Each row shows a state-colored bullet, tool icon, label, an
 * optional right-aligned detail summary, and an optional link chevron.
 */
export const ToolTraceBlock: FC<ToolTraceBlockProps> = ({ entries, streaming }) => {
  const { themed, theme } = useAppTheme()
  const startRef = useRef<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  // Tick wall time while streaming. Reset when the turn settles so the
  // next turn starts clean.
  useEffect(() => {
    if (!streaming) {
      startRef.current = null
      setElapsed(0)
      return
    }
    if (startRef.current == null) startRef.current = Date.now()
    const id = setInterval(() => {
      if (startRef.current != null) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      }
    }, 250)
    return () => clearInterval(id)
  }, [streaming])

  if (entries.length === 0) return null

  const steps = entries.length
  const headText = streaming
    ? `Working · ${elapsed}s`
    : `Done · ${steps} step${steps === 1 ? "" : "s"}`

  const headColor = streaming ? theme.colors.palette.primary500 : theme.colors.textDim

  return (
    <Animated.View
      entering={FadeInDown.duration(200).springify().damping(18)}
      style={themed($container)}
    >
      <View style={themed($headerRow)}>
        <Text size="xxs" style={[themed($headerText), { color: headColor }]}>
          {headText.toUpperCase()}
        </Text>
      </View>
      <View style={themed($body)}>
        {entries.map((entry) => (
          <TraceRow
            key={entry.key}
            effect={entry.effect}
            toolName={entry.toolName}
            state={entry.state}
          />
        ))}
      </View>
    </Animated.View>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

const TraceRow: FC<{
  effect?: ChatEffect
  toolName: string
  state: TraceState
}> = ({ effect, toolName, state }) => {
  const { themed, theme } = useAppTheme()
  const tool = effect?.tool ?? toolName ?? ""
  const meta = toolMeta(tool)
  const failed = effect?.success === false
  const detail = failed ? null : deriveDetail(effect)

  // Link affordance: routine / memory tools get a placeholder Alert (no
  // dedicated screens yet), calendar events open the htmlLink in the
  // system browser.
  const data = effect?.data
  const routineId =
    (effect?.tool === "create_routine" || effect?.tool === "update_routine") &&
    data?.routine_id != null
      ? String(data.routine_id)
      : null
  const calendarLink =
    effect?.tool === "create_calendar_event" && data?.htmlLink != null
      ? String(data.htmlLink)
      : null
  const memoryLink = effect?.tool === "remember" && data ? true : false

  const onLinkPress = () => {
    if (routineId) {
      Alert.alert("Routine", "Routine details aren't available on mobile yet.")
      return
    }
    if (memoryLink) {
      Alert.alert("Memory", "Memories screen is coming soon on mobile.")
      return
    }
    if (calendarLink) {
      Linking.openURL(calendarLink).catch(() => {
        Alert.alert("Calendar", "Couldn't open the calendar event link.")
      })
    }
  }

  const showLink = !failed && (routineId || memoryLink || calendarLink)
  const accent = theme.colors.palette.primary500

  const labelText = failed
    ? "Failed"
    : state === "active"
      ? `${meta.activeLabel}…`
      : meta.label
  const labelColor = failed ? theme.colors.error : theme.colors.text

  return (
    <View style={themed($row)}>
      <TraceBullet state={state} failed={failed} />
      <View style={themed($iconAndLabel)}>
        {failed ? (
          <Ionicons name="alert-circle" size={13} color={theme.colors.error} />
        ) : (
          <Ionicons name={meta.icon} size={13} color={accent} />
        )}
        <Text size="xxs" style={[themed($label), { color: labelColor }]} numberOfLines={1}>
          {labelText}
        </Text>
      </View>
      {failed && effect?.error ? (
        <Text size="xxs" style={themed($errorDetail)} numberOfLines={1}>
          {effect.error}
        </Text>
      ) : null}
      {!failed && detail ? (
        <Text size="xxs" style={themed($detail)} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
      {showLink ? (
        <Pressable onPress={onLinkPress} hitSlop={8} style={themed($linkWrap)}>
          <Ionicons name="open-outline" size={13} color={accent} />
        </Pressable>
      ) : null}
    </View>
  )
}

// ─── Bullet ───────────────────────────────────────────────────────────────────

const TraceBullet: FC<{ state: TraceState; failed?: boolean }> = ({ state, failed }) => {
  const { theme } = useAppTheme()
  const scale = useSharedValue(1)

  useEffect(() => {
    if (state === "active" && !failed) {
      scale.value = withRepeat(
        withTiming(1.3, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      )
    } else {
      scale.value = 1
    }
  }, [state, failed, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const size = 8
  const base: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    flexShrink: 0,
  }

  if (failed) {
    return <View style={[base, { backgroundColor: theme.colors.error }]} />
  }
  if (state === "queued") {
    return (
      <View
        style={[
          base,
          { borderWidth: 1, borderColor: theme.colors.textDim, backgroundColor: "transparent" },
        ]}
      />
    )
  }
  if (state === "active") {
    return (
      <Animated.View
        style={[base, { backgroundColor: theme.colors.palette.primary500 }, animatedStyle]}
      />
    )
  }
  // done
  return <View style={[base, { backgroundColor: theme.colors.palette.primary400 }]} />
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const $container: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  marginTop: spacing.xs,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.palette.neutral200,
  overflow: "hidden",
})

const $headerRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  paddingHorizontal: spacing.sm,
  paddingVertical: 6,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
})

const $headerText: ThemedStyle<TextStyle> = () => ({
  fontSize: 10,
  letterSpacing: 1.8,
  fontWeight: "600",
})

const $body: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.sm,
  paddingVertical: 6,
})

const $row: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingVertical: 2,
})

const $iconAndLabel: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
})

const $label: ThemedStyle<TextStyle> = () => ({
  fontSize: 11,
})

const $detail: ThemedStyle<TextStyle> = ({ colors }) => ({
  marginLeft: "auto",
  fontSize: 10,
  color: colors.textDim,
  maxWidth: 200,
  textAlign: "right",
})

const $errorDetail: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 10,
  color: colors.error,
  opacity: 0.8,
  flexShrink: 1,
})

const $linkWrap: ThemedStyle<ViewStyle> = () => ({
  marginLeft: 4,
  opacity: 0.7,
})
