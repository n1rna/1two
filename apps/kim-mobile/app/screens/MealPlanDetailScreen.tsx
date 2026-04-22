import { FC, useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native"
import {
  deleteMealPlan,
  getMealPlan,
  updateMealPlan,
  type HealthMealPlan,
  type MealItem,
} from "@1tt/api-client/health"

import { Button } from "@/components/Button"
import { relativeTime } from "@/components/actionable-domain-previews"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { dietChipColor } from "@/utils/dietColors"
import { shortDate } from "@/utils/formatSchedule"

interface MealPlanDetailScreenProps extends AppStackScreenProps<"MealPlanDetail"> {}

// Preserve the canonical meal-type order when grouping.
const MEAL_TYPE_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const

function groupMealsByType(meals: MealItem[]): Array<{ type: string; meals: MealItem[] }> {
  const buckets = new Map<string, MealItem[]>()
  const seenOrder: string[] = []
  for (const m of meals) {
    const key = (m.meal_type || "other").toLowerCase()
    if (!buckets.has(key)) {
      buckets.set(key, [])
      seenOrder.push(key)
    }
    buckets.get(key)!.push(m)
  }
  // Sort canonical types first in MEAL_TYPE_ORDER, then append any extras in
  // insertion order (so unusual meal_types like "pre-workout" still appear).
  const ordered: string[] = []
  for (const t of MEAL_TYPE_ORDER) {
    if (buckets.has(t)) ordered.push(t)
  }
  for (const t of seenOrder) {
    if (!ordered.includes(t)) ordered.push(t)
  }
  return ordered.map((type) => ({ type, meals: buckets.get(type)! }))
}

export const MealPlanDetailScreen: FC<MealPlanDetailScreenProps> = ({ route, navigation }) => {
  const { id } = route.params
  const { themed, theme } = useAppTheme()
  const [plan, setPlan] = useState<HealthMealPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      setError(null)
      const p = await getMealPlan(id)
      setPlan(p)
      navigation.setOptions({ title: p.title })
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
      if (!plan) return
      const prev = plan.active
      setPlan({ ...plan, active: next })
      try {
        const updated = await updateMealPlan(plan.id, { active: next })
        setPlan(updated)
      } catch (e) {
        setPlan({ ...plan, active: prev })
        Alert.alert(
          "Couldn't update meal plan",
          e instanceof Error ? e.message : String(e),
        )
      }
    },
    [plan],
  )

  const askKimEdit = () => {
    if (!plan) return
    navigation.navigate("Main", {
      screen: "Chat",
      params: { prefill: `Edit meal plan "${plan.title}"` },
    })
  }

  const confirmDelete = () => {
    if (!plan) return
    Alert.alert(
      "Delete meal plan?",
      `"${plan.title}" will be removed permanently.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true)
            try {
              await deleteMealPlan(plan.id)
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

  const sections = useMemo(() => {
    if (!plan) return []
    return groupMealsByType(plan.content?.meals ?? [])
  }, [plan])

  const grocery = plan?.content?.grocery
  const groceryCount = grocery?.items?.length ?? 0

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) {
    return (
      <Screen preset="fixed" safeAreaEdges={[]} contentContainerStyle={themed($loadingRoot)}>
        <ActivityIndicator color={theme.colors.tint} />
      </Screen>
    )
  }

  if (error || !plan) {
    return (
      <Screen preset="scroll" safeAreaEdges={[]} contentContainerStyle={themed($errorRoot)}>
        <Text style={themed($errorText)}>{error ?? "Meal plan not found"}</Text>
        <Button text="Retry" preset="reversed" onPress={load} />
      </Screen>
    )
  }

  const chip = dietChipColor(plan.dietType)

  return (
    <Screen preset="fixed" safeAreaEdges={[]} contentContainerStyle={themed($root)}>
      <ScrollView contentContainerStyle={themed($scrollContent)}>
        {/* Header card */}
        <View style={themed($section)}>
          <Text weight="semiBold" size="md">
            {plan.title}
          </Text>
          <View style={themed($chipRow)}>
            {plan.dietType ? (
              <View style={[themed($chip), { backgroundColor: chip.background }]}>
                <Text size="xxs" style={{ color: chip.foreground, fontWeight: "600" }}>
                  {plan.dietType}
                </Text>
              </View>
            ) : null}
            {plan.planType ? (
              <View style={[themed($chip), themed($chipNeutral)]}>
                <Text size="xxs" style={themed($chipNeutralText)}>
                  {plan.planType}
                </Text>
              </View>
            ) : null}
            {plan.targetCalories ? (
              <Text size="xs" style={themed($muted)}>
                ~{plan.targetCalories} kcal/day
              </Text>
            ) : null}
          </View>
          <View style={themed($activeRow)}>
            <View style={{ flex: 1 }}>
              <Text weight="semiBold" size="sm">
                {plan.active ? "Active" : "Paused"}
              </Text>
              <Text size="xs" style={themed($muted)}>
                {plan.active
                  ? "Kim uses this plan for suggestions and groceries."
                  : "This plan is currently paused."}
              </Text>
            </View>
            <Switch
              value={plan.active}
              onValueChange={toggleActive}
              trackColor={{ false: theme.colors.palette.neutral300, true: theme.colors.tint }}
              thumbColor={theme.colors.palette.neutral100}
            />
          </View>
        </View>

        {/* Meals */}
        {sections.length === 0 ? (
          <View style={themed($section)}>
            <Text size="xxs" style={themed($sectionLabel)}>
              MEALS
            </Text>
            <Text size="sm" style={themed($mutedItalic)}>
              No meals in this plan yet.
            </Text>
          </View>
        ) : (
          sections.map(({ type, meals }) => (
            <View key={type} style={themed($section)}>
              <Text size="xxs" style={themed($sectionLabel)}>
                {type.toUpperCase()}
              </Text>
              <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.xxs }}>
                {meals.map((m, idx) => {
                  const key = `${type}-${idx}-${m.name}`
                  const isOpen = expanded.has(key)
                  const macros: string[] = [`${m.calories}kcal`]
                  if (m.protein_g != null) macros.push(`${m.protein_g}g P`)
                  if (m.carbs_g != null) macros.push(`${m.carbs_g}g C`)
                  if (m.fat_g != null) macros.push(`${m.fat_g}g F`)
                  const hasExpand =
                    !!m.description ||
                    (m.ingredients && m.ingredients.length > 0) ||
                    !!m.prep_notes ||
                    (m.tags && m.tags.length > 0)
                  return (
                    <TouchableOpacity
                      key={key}
                      activeOpacity={hasExpand ? 0.7 : 1}
                      onPress={() => hasExpand && toggleExpand(key)}
                      style={themed($mealRow)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text weight="semiBold" size="sm">
                          {m.name}
                          {m.day ? ` · ${m.day}` : ""}
                        </Text>
                        <Text size="xxs" style={themed($muted)}>
                          {macros.join(" · ")}
                        </Text>
                        {isOpen ? (
                          <View style={themed($mealExpanded)}>
                            {m.description ? (
                              <Text size="xs" style={themed($muted)}>
                                {m.description}
                              </Text>
                            ) : null}
                            {m.ingredients && m.ingredients.length > 0 ? (
                              <View>
                                <Text size="xxs" style={themed($fieldLabel)}>
                                  INGREDIENTS
                                </Text>
                                {m.ingredients.map((ing, i) => (
                                  <Text key={`${key}-ing-${i}`} size="xs">
                                    {ing.name}
                                    {ing.quantity ? ` — ${ing.quantity}` : ""}
                                  </Text>
                                ))}
                              </View>
                            ) : null}
                            {m.prep_notes ? (
                              <View>
                                <Text size="xxs" style={themed($fieldLabel)}>
                                  PREP
                                </Text>
                                <Text size="xs">{m.prep_notes}</Text>
                              </View>
                            ) : null}
                            {m.tags && m.tags.length > 0 ? (
                              <View style={themed($tagRow)}>
                                {m.tags.map((t, i) => (
                                  <View key={`${key}-tag-${i}`} style={themed($tagChip)}>
                                    <Text size="xxs" style={themed($tagText)}>
                                      {t}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          ))
        )}

        {/* Grocery summary */}
        {groceryCount > 0 ? (
          <View style={themed($section)}>
            <Text size="xxs" style={themed($sectionLabel)}>
              GROCERY LIST
            </Text>
            <Text size="sm">
              {groceryCount} item{groceryCount === 1 ? "" : "s"}
            </Text>
            {grocery?.generatedAt ? (
              <Text size="xxs" style={themed($muted)}>
                updated {relativeTime(grocery.generatedAt)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Meta */}
        <View style={themed($section)}>
          <Text size="xxs" style={themed($sectionLabel)}>
            META
          </Text>
          <MetaLine k="Created" v={shortDate(plan.createdAt)} />
          <MetaLine k="Updated" v={relativeTime(plan.updatedAt)} />
        </View>

        {/* Actions */}
        <View style={themed($actions)}>
          <Button
            text="Ask Kim to edit"
            preset="reversed"
            onPress={askKimEdit}
            style={themed($actionButton)}
          />
          <Button
            text={deleting ? "Deleting…" : "Delete meal plan"}
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

const $activeRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.md,
  paddingTop: spacing.sm,
  borderTopWidth: 1,
  borderTopColor: colors.border,
  marginTop: spacing.xs,
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

const $chipNeutral: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.neutral200,
  borderWidth: 1,
  borderColor: colors.border,
})

const $chipNeutralText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontWeight: "600",
})

const $mealRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  backgroundColor: colors.palette.neutral200,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: colors.border,
})

const $mealExpanded: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  marginTop: spacing.xs,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $mutedItalic: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontStyle: "italic",
})

const $fieldLabel: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  letterSpacing: 1,
  fontWeight: "600",
  marginBottom: spacing.xxxs,
})

const $tagRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xxs,
})

const $tagChip: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  paddingHorizontal: spacing.xs,
  paddingVertical: 2,
  borderRadius: 999,
  backgroundColor: colors.palette.neutral300,
})

const $tagText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.neutral700,
  fontWeight: "500",
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
