import { FC, useCallback, useEffect, useState } from "react"
import {
  Alert,
  FlatList,
  RefreshControl,
  Switch,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native"
import {
  listLifeRoutines,
  updateLifeRoutine,
  type LifeRoutine,
} from "@1tt/api-client/life"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatSchedule, relativeTime } from "@/utils/formatSchedule"

interface RoutinesScreenProps extends MainTabScreenProps<"Routines"> {}

/**
 * Routines tab. v1 scope: list + toggle active + navigate to detail.
 * Create/edit intentionally deferred (see QBL-176); users ask Kim in chat.
 */
export const RoutinesScreen: FC<RoutinesScreenProps> = ({ navigation }) => {
  const { themed, theme } = useAppTheme()
  const [routines, setRoutines] = useState<LifeRoutine[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await listLifeRoutines()
      setRoutines(data)
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

  // Optimistic toggle: flip locally, call API, revert on error.
  const toggleActive = useCallback(async (id: string, next: boolean) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: next } : r)),
    )
    try {
      await updateLifeRoutine(id, { active: next })
    } catch (e) {
      setRoutines((prev) =>
        prev.map((r) => (r.id === id ? { ...r, active: !next } : r)),
      )
      Alert.alert("Couldn't update routine", e instanceof Error ? e.message : String(e))
    }
  }, [])

  const askKimForNew = () =>
    navigation.navigate("Main", {
      screen: "Chat",
      params: { prefill: "Help me create a new routine" },
    })

  const activeCount = routines.filter((r) => r.active).length

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($root)}>
      <View style={themed($header)}>
        <View style={{ flex: 1 }}>
          <Text preset="heading">Routines</Text>
          <Text size="xs" style={themed($subtitle)}>
            {routines.length > 0
              ? `${activeCount} active · ${routines.length} total`
              : "Nothing scheduled yet"}
          </Text>
        </View>
      </View>

      {error ? (
        <View style={themed($errorBox)}>
          <Text size="xs" style={themed($errorText)}>
            {error}
          </Text>
          <Button text="Retry" preset="default" onPress={load} />
        </View>
      ) : null}

      <FlatList
        data={routines}
        keyExtractor={(r) => r.id}
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
            <View style={themed($emptyBox)}>
              <Text style={themed($emptyText)}>
                No routines yet. Ask Kim to create one.
              </Text>
              <Button
                text="Ask Kim"
                preset="reversed"
                onPress={askKimForNew}
                style={themed($emptyCta)}
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <RoutineRow
            routine={item}
            onPress={() => navigation.navigate("RoutineDetail", { id: item.id })}
            onToggle={(next) => toggleActive(item.id, next)}
          />
        )}
      />
    </Screen>
  )
}

interface RoutineRowProps {
  routine: LifeRoutine
  onPress: () => void
  onToggle: (next: boolean) => void
}

const RoutineRow: FC<RoutineRowProps> = ({ routine, onPress, onToggle }) => {
  const { themed, theme } = useAppTheme()
  const lastLabel = routine.lastTriggered
    ? `last ran ${relativeTime(routine.lastTriggered)}`
    : "never run"

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        themed($row),
        !routine.active ? themed($rowInactive) : undefined,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text weight="semiBold" size="sm">
          {routine.name}
        </Text>
        <Text size="xs" style={themed($rowMeta)} numberOfLines={1}>
          {formatSchedule(routine.schedule)}
        </Text>
        <Text size="xxs" style={themed($rowSubMeta)}>
          {lastLabel}
        </Text>
      </View>
      <Switch
        value={routine.active}
        onValueChange={onToggle}
        trackColor={{ false: theme.colors.palette.neutral300, true: theme.colors.tint }}
        thumbColor={theme.colors.palette.neutral100}
      />
    </TouchableOpacity>
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

const $listContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  paddingBottom: spacing.lg,
  gap: spacing.xs,
})

const $row: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
  backgroundColor: colors.palette.neutral100,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.border,
})

const $rowInactive: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.55,
})

const $rowMeta: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginTop: spacing.xxxs,
})

const $rowSubMeta: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginTop: spacing.xxxs,
})

const $emptyBox: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingVertical: spacing.xxl,
  paddingHorizontal: spacing.lg,
  alignItems: "center",
  gap: spacing.md,
})

const $emptyText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontStyle: "italic",
  textAlign: "center",
})

const $emptyCta: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  minWidth: 160,
  paddingHorizontal: spacing.lg,
})

const $errorBox: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.errorBackground,
  padding: spacing.md,
  marginHorizontal: spacing.lg,
  marginBottom: spacing.sm,
  borderRadius: 10,
  gap: spacing.xs,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})
