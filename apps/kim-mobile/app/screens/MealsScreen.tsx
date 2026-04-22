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
  listMealPlans,
  updateMealPlan,
  type HealthMealPlan,
} from "@1tt/api-client/health"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { dietChipColor } from "@/utils/dietColors"

interface MealsScreenProps extends MainTabScreenProps<"Meals"> {}

/**
 * Meals tab. v1 scope: list + toggle active + navigate to detail.
 * No create wizard (web's /meals/create is a dedicated multi-step form).
 * Users ask Kim in chat instead — matches the Routines pattern (QBL-176).
 */
export const MealsScreen: FC<MealsScreenProps> = ({ navigation }) => {
  const { themed, theme } = useAppTheme()
  const [plans, setPlans] = useState<HealthMealPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await listMealPlans()
      setPlans(data)
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

  const toggleActive = useCallback(async (id: string, next: boolean) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, active: next } : p)))
    try {
      await updateMealPlan(id, { active: next })
    } catch (e) {
      setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, active: !next } : p)))
      Alert.alert(
        "Couldn't update meal plan",
        e instanceof Error ? e.message : String(e),
      )
    }
  }, [])

  const askKimForNew = () =>
    navigation.navigate("Main", {
      screen: "Chat",
      params: { prefill: "Create a meal plan for me" },
    })

  const activeCount = plans.filter((p) => p.active).length

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($root)}>
      <View style={themed($header)}>
        <View style={{ flex: 1 }}>
          <Text preset="heading">Meal plans</Text>
          <Text size="xs" style={themed($subtitle)}>
            {plans.length > 0
              ? `${activeCount} active · ${plans.length} total`
              : "No meal plans yet"}
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
        data={plans}
        keyExtractor={(p) => p.id}
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
                No meal plans yet. Ask Kim to generate one.
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
          <MealPlanRow
            plan={item}
            onPress={() => navigation.navigate("MealPlanDetail", { id: item.id })}
            onToggle={(next) => toggleActive(item.id, next)}
          />
        )}
      />
    </Screen>
  )
}

interface MealPlanRowProps {
  plan: HealthMealPlan
  onPress: () => void
  onToggle: (next: boolean) => void
}

const MealPlanRow: FC<MealPlanRowProps> = ({ plan, onPress, onToggle }) => {
  const { themed, theme } = useAppTheme()
  const mealCount = plan.content?.meals?.length ?? 0
  const chip = dietChipColor(plan.dietType)

  const metaBits: string[] = []
  metaBits.push(`${mealCount} meal${mealCount === 1 ? "" : "s"}`)
  if (plan.targetCalories) metaBits.push(`~${plan.targetCalories}kcal`)

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[themed($row), !plan.active ? themed($rowInactive) : undefined]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text weight="semiBold" size="sm">
          {plan.title}
        </Text>
        <View style={themed($chipRow)}>
          {plan.dietType ? (
            <View
              style={[
                themed($chip),
                { backgroundColor: chip.background },
              ]}
            >
              <Text size="xxs" style={{ color: chip.foreground, fontWeight: "600" }}>
                {plan.dietType}
              </Text>
            </View>
          ) : null}
          <Text size="xxs" style={themed($rowMeta)} numberOfLines={1}>
            {metaBits.join(" · ")}
          </Text>
        </View>
      </View>
      <Switch
        value={plan.active}
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

const $chipRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  flexWrap: "wrap",
})

const $chip: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.xs,
  paddingVertical: 2,
  borderRadius: 999,
})

const $rowMeta: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flexShrink: 1,
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
