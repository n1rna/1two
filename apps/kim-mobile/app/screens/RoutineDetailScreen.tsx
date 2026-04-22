import { FC, useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"
import {
  deleteLifeRoutine,
  getLifeRoutine,
  updateLifeRoutine,
  type LifeRoutine,
} from "@1tt/api-client/life"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import {
  formatSchedule,
  relativeTime,
  shortDate,
  type ScheduleShape,
} from "@/utils/formatSchedule"

interface RoutineDetailScreenProps extends AppStackScreenProps<"RoutineDetail"> {}

/**
 * Flatten an arbitrary value into a human string. Nested objects/arrays
 * fall through to JSON.stringify so we never throw on unknown shapes —
 * v1 keeps this dumb on purpose. When we learn more about common schemas
 * we can upgrade with schema-driven rendering (see web's RoutineConfigReadonly).
 */
function stringifyValue(v: unknown): string {
  if (v == null) return "—"
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (Array.isArray(v)) {
    if (v.length === 0) return "—"
    const allPrim = v.every((x) => typeof x === "string" || typeof x === "number")
    if (allPrim) return v.join(", ")
    return JSON.stringify(v)
  }
  if (typeof v === "object") {
    try {
      return JSON.stringify(v, null, 2)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

function configEntries(config: unknown): Array<{ key: string; value: unknown }> {
  if (!config || typeof config !== "object" || Array.isArray(config)) return []
  return Object.entries(config as Record<string, unknown>).map(([key, value]) => ({
    key,
    value,
  }))
}

function scheduleDetails(raw: unknown): ScheduleShape | null {
  if (!raw || typeof raw !== "object") return null
  const s = raw as Record<string, unknown>
  const result: ScheduleShape = {}
  if (typeof s.frequency === "string") result.frequency = s.frequency
  if (typeof s.interval === "number") result.interval = s.interval
  if (Array.isArray(s.days)) result.days = s.days as Array<number | string>
  if (typeof s.time === "string") result.time = s.time
  if (typeof s.flexible === "boolean") result.flexible = s.flexible
  return result
}

export const RoutineDetailScreen: FC<RoutineDetailScreenProps> = ({ route, navigation }) => {
  const { id } = route.params
  const { themed, theme } = useAppTheme()
  const [routine, setRoutine] = useState<LifeRoutine | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const r = await getLifeRoutine(id)
      setRoutine(r)
      navigation.setOptions({ title: r.name })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [id, navigation])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  const toggleActive = useCallback(
    async (next: boolean) => {
      if (!routine) return
      const prev = routine.active
      setRoutine({ ...routine, active: next })
      try {
        const updated = await updateLifeRoutine(routine.id, { active: next })
        setRoutine(updated)
      } catch (e) {
        setRoutine({ ...routine, active: prev })
        Alert.alert(
          "Couldn't update routine",
          e instanceof Error ? e.message : String(e),
        )
      }
    },
    [routine],
  )

  const askKimEdit = () => {
    if (!routine) return
    navigation.navigate("Main", {
      screen: "Chat",
      params: {
        prefill: `Help me edit my routine "${routine.name}". I'd like to change…`,
      },
    })
  }

  const confirmDelete = () => {
    if (!routine) return
    Alert.alert(
      "Delete routine?",
      `"${routine.name}" will be removed permanently.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true)
            try {
              await deleteLifeRoutine(routine.id)
              navigation.goBack()
            } catch (e) {
              setDeleting(false)
              Alert.alert(
                "Couldn't delete",
                e instanceof Error ? e.message : String(e),
              )
            }
          },
        },
      ],
    )
  }

  const schedule = useMemo(
    () => (routine ? scheduleDetails(routine.schedule) : null),
    [routine],
  )
  const cfg = useMemo(() => (routine ? configEntries(routine.config) : []), [routine])

  if (loading) {
    return (
      <Screen preset="fixed" safeAreaEdges={[]} contentContainerStyle={themed($loadingRoot)}>
        <ActivityIndicator color={theme.colors.tint} />
      </Screen>
    )
  }

  if (error || !routine) {
    return (
      <Screen preset="scroll" safeAreaEdges={[]} contentContainerStyle={themed($errorRoot)}>
        <Text style={themed($errorText)}>{error ?? "Routine not found"}</Text>
        <Button text="Retry" preset="reversed" onPress={load} />
      </Screen>
    )
  }

  return (
    <Screen preset="fixed" safeAreaEdges={[]} contentContainerStyle={themed($root)}>
      <ScrollView contentContainerStyle={themed($scrollContent)}>
        {/* Active toggle */}
        <View style={themed($activeRow)}>
          <View style={{ flex: 1 }}>
            <Text weight="semiBold" size="sm">
              {routine.active ? "Active" : "Paused"}
            </Text>
            <Text size="xs" style={themed($muted)}>
              {routine.active
                ? "Kim will run this on schedule."
                : "This routine is currently paused."}
            </Text>
          </View>
          <Switch
            value={routine.active}
            onValueChange={toggleActive}
            trackColor={{ false: theme.colors.palette.neutral300, true: theme.colors.tint }}
            thumbColor={theme.colors.palette.neutral100}
          />
        </View>

        {/* Schedule */}
        <Section label="Schedule">
          <Text size="sm">{formatSchedule(routine.schedule)}</Text>
          {schedule ? (
            <View style={themed($metaGrid)}>
              {schedule.frequency ? (
                <MetaLine k="Frequency" v={schedule.frequency} />
              ) : null}
              {schedule.interval != null ? (
                <MetaLine k="Interval" v={String(schedule.interval)} />
              ) : null}
              {schedule.time ? <MetaLine k="Time" v={schedule.time} /> : null}
              {schedule.days && schedule.days.length > 0 ? (
                <MetaLine k="Days" v={schedule.days.join(", ")} />
              ) : null}
              {schedule.flexible != null ? (
                <MetaLine k="Flexible" v={schedule.flexible ? "Yes" : "No"} />
              ) : null}
            </View>
          ) : null}
        </Section>

        {/* Description */}
        <Section label="Description">
          {routine.description ? (
            <Text size="sm">{routine.description}</Text>
          ) : (
            <Text size="sm" style={themed($mutedItalic)}>
              No description.
            </Text>
          )}
        </Section>

        {/* Config */}
        <Section label="Configuration">
          {cfg.length === 0 ? (
            <Text size="sm" style={themed($mutedItalic)}>
              No configuration for this routine.
            </Text>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {cfg.map(({ key, value }) => (
                <View key={key}>
                  <Text size="xxs" style={themed($fieldLabel)}>
                    {key.toUpperCase()}
                  </Text>
                  <Text size="sm" style={themed($fieldValue)}>
                    {stringifyValue(value)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Meta */}
        <Section label="Activity">
          <MetaLine
            k="Last triggered"
            v={
              routine.lastTriggered
                ? relativeTime(routine.lastTriggered)
                : "never"
            }
          />
          <MetaLine k="Created" v={shortDate(routine.createdAt)} />
          <MetaLine k="Updated" v={relativeTime(routine.updatedAt)} />
        </Section>

        {/* Actions */}
        <View style={themed($actions)}>
          <Button
            text="Ask Kim to edit"
            preset="reversed"
            onPress={askKimEdit}
            style={themed($actionButton)}
          />
          <Button
            text={deleting ? "Deleting…" : "Delete routine"}
            preset="default"
            onPress={confirmDelete}
            disabled={deleting}
            style={themed($deleteButton)}
            textStyle={themed($deleteButtonText)}
          />
        </View>
      </ScrollView>
    </Screen>
  )
}

const Section: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const { themed } = useAppTheme()
  return (
    <View style={themed($section)}>
      <Text size="xxs" style={themed($sectionLabel)}>
        {label.toUpperCase()}
      </Text>
      <View style={themed($sectionBody)}>{children}</View>
    </View>
  )
}

const MetaLine: FC<{ k: string; v: string }> = ({ k, v }) => {
  const { themed } = useAppTheme()
  return (
    <View style={themed($metaRow)}>
      <Text size="xs" style={themed($metaKey)}>
        {k}
      </Text>
      <Text size="xs" style={themed($metaValue)}>
        {v}
      </Text>
    </View>
  )
}

const $root: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $loadingRoot: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
})

const $errorRoot: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
  gap: spacing.md,
  alignItems: "center",
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
  textAlign: "center",
})

const $scrollContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
  gap: spacing.md,
})

const $activeRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.md,
  padding: spacing.md,
  backgroundColor: colors.palette.neutral100,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.border,
})

const $section: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  padding: spacing.md,
  backgroundColor: colors.palette.neutral100,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.border,
  gap: spacing.xs,
})

const $sectionLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  letterSpacing: 1,
  fontWeight: "700",
})

const $sectionBody: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.xxs,
  gap: spacing.xxs,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $mutedItalic: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontStyle: "italic",
})

const $fieldLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  letterSpacing: 1,
  fontWeight: "600",
})

const $fieldValue: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.text,
  marginTop: spacing.xxxs,
})

const $metaGrid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.xs,
  gap: spacing.xxxs,
})

const $metaRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $metaKey: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $metaValue: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  flexShrink: 1,
  textAlign: "right",
})

const $actions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  marginTop: spacing.sm,
})

const $actionButton: ThemedStyle<ViewStyle> = () => ({
  minHeight: 48,
})

const $deleteButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  minHeight: 48,
  backgroundColor: colors.errorBackground,
  borderColor: colors.error,
})

const $deleteButtonText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})
