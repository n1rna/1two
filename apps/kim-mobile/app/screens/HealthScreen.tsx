import { FC, useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native"
import {
  createWeightEntry,
  deleteWeightEntry,
  getHealthProfile,
  listHealthSessions,
  listWeightEntries,
  type HealthProfile,
  type HealthSession,
  type WeightEntry,
} from "@1tt/api-client/health"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { bmiColor, bmiLabel, bmiStatus, calcBmi } from "@/utils/bmi"
import { dietChipColor } from "@/utils/dietColors"
import { relativeTime } from "@/utils/formatSchedule"

interface HealthScreenProps extends MainTabScreenProps<"Health"> {}

type TabKey = "profile" | "weight" | "sessions"
type Window = 7 | 30 | 90

/**
 * Health hub. One screen with a segmented control up top switching between:
 * - Profile: read-only summary of the user's HealthProfile.
 * - Weight: log weight + simple bar trend + entry list.
 * - Sessions: list of active + recent workout sessions.
 *
 * All editing flows are deferred to Chat for v1 (matches Routines/Meals
 * pattern). Chart is drawn with plain <View> bars — no svg/chart lib.
 */
export const HealthScreen: FC<HealthScreenProps> = ({ navigation }) => {
  const { themed, theme } = useAppTheme()
  const [tab, setTab] = useState<TabKey>("profile")

  const [profile, setProfile] = useState<HealthProfile | null>(null)
  const [weights, setWeights] = useState<WeightEntry[]>([])
  const [sessions, setSessions] = useState<HealthSession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const [p, w, s] = await Promise.all([
        getHealthProfile().catch(() => null),
        listWeightEntries().catch(() => [] as WeightEntry[]),
        listHealthSessions().catch(() => [] as HealthSession[]),
      ])
      setProfile(p)
      setWeights(w)
      setSessions(s)
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

  const askKim = useCallback(
    (prefill: string) => {
      navigation.navigate("Main", {
        screen: "Chat",
        params: { prefill },
      })
    },
    [navigation],
  )

  const handleCreateWeight = useCallback(
    async (kg: number, note?: string) => {
      const entry = await createWeightEntry(kg, note, new Date().toISOString())
      setWeights((prev) => [entry, ...prev])
    },
    [],
  )

  const handleDeleteWeight = useCallback(async (id: string) => {
    const prev = weights
    setWeights((cur) => cur.filter((w) => w.id !== id))
    try {
      await deleteWeightEntry(id)
    } catch (e) {
      setWeights(prev)
      Alert.alert("Couldn't delete", e instanceof Error ? e.message : String(e))
    }
  }, [weights])

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($root)}>
      <View style={themed($header)}>
        <Text preset="heading">Health</Text>
      </View>

      <TabSwitcher value={tab} onChange={setTab} />

      {error ? (
        <View style={themed($errorBox)}>
          <Text size="xs" style={themed($errorText)}>
            {error}
          </Text>
          <Button text="Retry" preset="default" onPress={load} />
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={themed($scrollContent)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.tint}
          />
        }
      >
        {loading ? (
          <View style={themed($loadingBox)}>
            <ActivityIndicator color={theme.colors.tint} />
          </View>
        ) : tab === "profile" ? (
          <ProfileTab profile={profile} weights={weights} onAskKim={askKim} />
        ) : tab === "weight" ? (
          <WeightTab
            weights={weights}
            onCreate={handleCreateWeight}
            onDelete={handleDeleteWeight}
          />
        ) : (
          <SessionsTab sessions={sessions} onAskKim={askKim} />
        )}
      </ScrollView>
    </Screen>
  )
}

// ─── Tab switcher ────────────────────────────────────────────────────────────

interface TabSwitcherProps {
  value: TabKey
  onChange: (next: TabKey) => void
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "weight", label: "Weight" },
  { key: "sessions", label: "Sessions" },
]

const TabSwitcher: FC<TabSwitcherProps> = ({ value, onChange }) => {
  const { themed, theme } = useAppTheme()
  return (
    <View style={themed($tabRow)}>
      {TABS.map((t) => {
        const focused = t.key === value
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={themed($tabButton)}
          >
            <Text
              size="xs"
              weight={focused ? "semiBold" : "normal"}
              style={{
                color: focused ? theme.colors.tint : theme.colors.textDim,
                textAlign: "center",
              }}
            >
              {t.label}
            </Text>
            <View
              style={[
                themed($tabUnderline),
                focused
                  ? { backgroundColor: theme.colors.tint }
                  : { backgroundColor: "transparent" },
              ]}
            />
          </Pressable>
        )
      })}
    </View>
  )
}

// ─── Profile tab ─────────────────────────────────────────────────────────────

interface ProfileTabProps {
  profile: HealthProfile | null
  weights: WeightEntry[]
  onAskKim: (prefill: string) => void
}

const ProfileTab: FC<ProfileTabProps> = ({ profile, weights, onAskKim }) => {
  const { themed, theme } = useAppTheme()

  if (!profile) {
    return (
      <View style={themed($emptyBox)}>
        <Text style={themed($emptyText)}>
          No health profile yet. Ask Kim to help set one up.
        </Text>
        <Button
          text="Ask Kim"
          preset="reversed"
          onPress={() => onAskKim("Help me set up my health profile")}
          style={themed($emptyCta)}
        />
      </View>
    )
  }

  // Prefer latest weight entry over the cached profile.weightKg.
  const latestEntry = weights[0]
  const currentWeight = latestEntry?.weightKg ?? profile.weightKg
  const bmi = calcBmi(currentWeight, profile.heightCm)
  const bmiC = bmiColor(bmi, theme)
  const chip = dietChipColor(profile.dietType)

  const goalGap =
    profile.goalWeightKg != null && currentWeight != null
      ? currentWeight - profile.goalWeightKg
      : null

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {/* Stats card */}
      <Card title="Stats">
        <StatRow label="Age" value={profile.age != null ? `${profile.age}` : "—"} />
        <StatRow label="Gender" value={profile.gender ?? "—"} />
        <StatRow
          label="Height"
          value={profile.heightCm != null ? `${profile.heightCm}cm` : "—"}
        />
        <StatRow
          label="Weight"
          value={currentWeight != null ? `${currentWeight.toFixed(1)}kg` : "—"}
        />
        <StatRow
          label="BMI"
          valueNode={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text size="sm" weight="semiBold" style={{ color: bmiC }}>
                {bmi != null ? bmi.toFixed(1) : "—"}
              </Text>
              <Text size="xxs" style={{ color: theme.colors.textDim }}>
                {bmiLabel(bmiStatus(bmi))}
              </Text>
            </View>
          }
        />
      </Card>

      {/* Diet card */}
      <Card title="Diet">
        <View style={themed($chipWrap)}>
          {profile.dietType ? (
            <View style={[themed($chip), { backgroundColor: chip.background }]}>
              <Text size="xxs" style={{ color: chip.foreground, fontWeight: "600" }}>
                {profile.dietType}
              </Text>
            </View>
          ) : null}
          {profile.dietGoal ? (
            <View
              style={[
                themed($chip),
                { backgroundColor: theme.colors.palette.neutral300 },
              ]}
            >
              <Text size="xxs" style={{ color: theme.colors.palette.neutral700 }}>
                goal: {profile.dietGoal}
              </Text>
            </View>
          ) : null}
        </View>
        <StatRow
          label="Target calories"
          value={profile.targetCalories != null ? `${profile.targetCalories} kcal` : "—"}
        />
        <StatRow
          label="Macros"
          value={
            profile.proteinG != null || profile.carbsG != null || profile.fatG != null
              ? `P ${profile.proteinG ?? 0}g · C ${profile.carbsG ?? 0}g · F ${profile.fatG ?? 0}g`
              : "—"
          }
        />
        <MacroBars
          protein={profile.proteinG}
          carbs={profile.carbsG}
          fat={profile.fatG}
        />
        <StatRow
          label="Goal weight"
          value={profile.goalWeightKg != null ? `${profile.goalWeightKg}kg` : "—"}
        />
        {goalGap != null ? (
          <Text size="xxs" style={{ color: theme.colors.textDim }}>
            {goalGap === 0
              ? "At goal"
              : goalGap > 0
                ? `${goalGap.toFixed(1)}kg to lose`
                : `${Math.abs(goalGap).toFixed(1)}kg to gain`}
          </Text>
        ) : null}
        {profile.dietaryRestrictions.length > 0 ? (
          <View style={themed($chipWrap)}>
            {profile.dietaryRestrictions.map((r) => (
              <View
                key={r}
                style={[
                  themed($chip),
                  { backgroundColor: theme.colors.palette.neutral300 },
                ]}
              >
                <Text size="xxs" style={{ color: theme.colors.palette.neutral700 }}>
                  {r}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      {/* Gym card */}
      <Card title="Gym">
        <StatRow label="Level" value={profile.fitnessLevel || "—"} />
        <StatRow label="Goal" value={profile.fitnessGoal || "—"} />
        <StatRow
          label="Days/week"
          value={profile.daysPerWeek > 0 ? `${profile.daysPerWeek}` : "—"}
        />
        <StatRow
          label="Duration"
          value={
            profile.preferredDurationMin > 0
              ? `${profile.preferredDurationMin} min`
              : "—"
          }
        />
        {profile.availableEquipment.length > 0 ? (
          <View style={themed($chipWrap)}>
            {profile.availableEquipment.map((e) => (
              <View
                key={e}
                style={[
                  themed($chip),
                  { backgroundColor: theme.colors.palette.neutral300 },
                ]}
              >
                <Text size="xxs" style={{ color: theme.colors.palette.neutral700 }}>
                  {e}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Button
        text="Ask Kim to update profile"
        preset="reversed"
        onPress={() => onAskKim("Update my health profile")}
      />
    </View>
  )
}

interface StatRowProps {
  label: string
  value?: string
  valueNode?: React.ReactNode
}

const StatRow: FC<StatRowProps> = ({ label, value, valueNode }) => {
  const { themed, theme } = useAppTheme()
  return (
    <View style={themed($statRow)}>
      <Text size="xs" style={{ color: theme.colors.textDim }}>
        {label}
      </Text>
      {valueNode ?? (
        <Text size="sm" weight="medium">
          {value}
        </Text>
      )}
    </View>
  )
}

interface MacroBarsProps {
  protein: number | null
  carbs: number | null
  fat: number | null
}

/** Proportional bar for protein/carbs/fat grams. Pure views. */
const MacroBars: FC<MacroBarsProps> = ({ protein, carbs, fat }) => {
  const { themed, theme } = useAppTheme()
  const p = protein ?? 0
  const c = carbs ?? 0
  const f = fat ?? 0
  const total = p + c + f
  if (total <= 0) return null
  return (
    <View style={themed($macroBarRow)}>
      <View
        style={{
          flex: p / total,
          backgroundColor: theme.colors.palette.primary500,
        }}
      />
      <View
        style={{
          flex: c / total,
          backgroundColor: theme.colors.palette.accent500,
        }}
      />
      <View
        style={{
          flex: f / total,
          backgroundColor: theme.colors.palette.secondary500,
        }}
      />
    </View>
  )
}

// ─── Weight tab ──────────────────────────────────────────────────────────────

interface WeightTabProps {
  weights: WeightEntry[]
  onCreate: (kg: number, note?: string) => Promise<void>
  onDelete: (id: string) => void
}

const WeightTab: FC<WeightTabProps> = ({ weights, onCreate, onDelete }) => {
  const { themed, theme } = useAppTheme()
  const [input, setInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [win, setWin] = useState<Window>(30)

  // Filter by window.
  const cutoff = useMemo(() => Date.now() - win * 24 * 60 * 60 * 1000, [win])
  const windowed = useMemo(
    () => weights.filter((w) => Date.parse(w.recordedAt) >= cutoff),
    [weights, cutoff],
  )

  const save = useCallback(async () => {
    const kg = Number.parseFloat(input.replace(",", "."))
    if (!Number.isFinite(kg) || kg <= 0 || kg > 500) {
      Alert.alert("Invalid weight", "Please enter a number between 1 and 500 kg.")
      return
    }
    setSaving(true)
    try {
      await onCreate(kg)
      setInput("")
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [input, onCreate])

  const confirmDelete = useCallback(
    (entry: WeightEntry) => {
      Alert.alert(
        "Delete entry?",
        `Remove ${entry.weightKg.toFixed(1)}kg on ${relativeTime(entry.recordedAt)}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => onDelete(entry.id),
          },
        ],
      )
    },
    [onDelete],
  )

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Card title="Log weight">
        <View style={themed($logRow)}>
          <TextInput
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
            placeholder="kg"
            placeholderTextColor={theme.colors.textDim}
            style={themed($numberInput)}
          />
          <Button
            text={saving ? "Saving…" : "Save"}
            preset="reversed"
            onPress={save}
            disabled={saving}
            style={{ minWidth: 100 }}
          />
        </View>
      </Card>

      <View style={themed($windowRow)}>
        {([7, 30, 90] as const).map((w) => {
          const focused = w === win
          return (
            <Pressable
              key={w}
              onPress={() => setWin(w)}
              style={[
                themed($windowChip),
                focused
                  ? { backgroundColor: theme.colors.tint }
                  : { backgroundColor: theme.colors.palette.neutral100 },
              ]}
            >
              <Text
                size="xxs"
                weight={focused ? "semiBold" : "normal"}
                style={{
                  color: focused
                    ? theme.colors.palette.neutral100
                    : theme.colors.textDim,
                }}
              >
                {w}d
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Card title="Trend">
        <WeightChart entries={windowed} />
      </Card>

      <Card title="Entries">
        {windowed.length === 0 ? (
          <Text size="xs" style={{ color: theme.colors.textDim, fontStyle: "italic" }}>
            No entries in this window.
          </Text>
        ) : (
          windowed.map((w) => (
            <TouchableOpacity
              key={w.id}
              onLongPress={() => confirmDelete(w)}
              style={themed($entryRow)}
            >
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="semiBold">
                  {w.weightKg.toFixed(1)}kg
                </Text>
                {w.note ? (
                  <Text size="xxs" style={{ color: theme.colors.textDim }}>
                    {w.note}
                  </Text>
                ) : null}
              </View>
              <Text size="xxs" style={{ color: theme.colors.textDim }}>
                {relativeTime(w.recordedAt)}
              </Text>
              <Pressable
                onPress={() => confirmDelete(w)}
                hitSlop={8}
                style={themed($deleteBtn)}
              >
                <Text size="xxs" style={{ color: theme.colors.error }}>
                  Delete
                </Text>
              </Pressable>
            </TouchableOpacity>
          ))
        )}
      </Card>
    </View>
  )
}

interface WeightChartProps {
  entries: WeightEntry[]
}

/**
 * Pure-view bar chart. Bars are sized by the max available width:
 *   - Bar = 8px, gap = 2px. If more bars than fit, subsample evenly.
 *   - Height proportional to (weight - min) / (max - min), min 8% so
 *     even near-flat trends show something.
 *   - Oldest on the left → newest on the right.
 */
const WeightChart: FC<WeightChartProps> = ({ entries }) => {
  const { themed, theme } = useAppTheme()

  if (entries.length < 2) {
    return (
      <Text size="xs" style={{ color: theme.colors.textDim, fontStyle: "italic" }}>
        Log weight to see trend.
      </Text>
    )
  }

  // Oldest → newest.
  const sorted = [...entries].sort(
    (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt),
  )

  // Rough available width: screen minus horizontal padding (16*2 for screen +
  // 12*2 for card). We don't measure layout for v1.
  const screenW = Dimensions.get("window").width
  const availW = Math.max(120, screenW - 32 - 24)
  const BAR = 8
  const GAP = 2
  const maxBars = Math.max(2, Math.floor((availW + GAP) / (BAR + GAP)))

  // Subsample evenly if too many.
  const bars: WeightEntry[] = []
  if (sorted.length <= maxBars) {
    bars.push(...sorted)
  } else {
    for (let i = 0; i < maxBars; i++) {
      const idx = Math.round((i * (sorted.length - 1)) / (maxBars - 1))
      bars.push(sorted[idx]!)
    }
  }

  const values = bars.map((b) => b.weightKg)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const HEIGHT = 80

  return (
    <View>
      <View style={[themed($chartBox), { height: HEIGHT }]}>
        {bars.map((b, i) => {
          const ratio = (b.weightKg - min) / range
          const h = Math.max(HEIGHT * 0.08, ratio * HEIGHT)
          return (
            <View
              key={`${b.id}-${i}`}
              style={{
                width: BAR,
                height: h,
                marginRight: i === bars.length - 1 ? 0 : GAP,
                backgroundColor: theme.colors.tint,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              }}
            />
          )
        })}
      </View>
      <View style={themed($chartLegend)}>
        <Text size="xxs" style={{ color: theme.colors.textDim }}>
          {min.toFixed(1)}kg
        </Text>
        <Text size="xxs" style={{ color: theme.colors.textDim }}>
          {max.toFixed(1)}kg
        </Text>
      </View>
    </View>
  )
}

// ─── Sessions tab ────────────────────────────────────────────────────────────

interface SessionsTabProps {
  sessions: HealthSession[]
  onAskKim: (prefill: string) => void
}

const SessionsTab: FC<SessionsTabProps> = ({ sessions, onAskKim }) => {
  const { themed, theme } = useAppTheme()
  // Active first, then limit to 30.
  const sorted = useMemo(() => {
    const copy = [...sessions]
    copy.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    })
    return copy.slice(0, 30)
  }, [sessions])

  if (sorted.length === 0) {
    return (
      <View style={themed($emptyBox)}>
        <Text style={themed($emptyText)}>
          No sessions yet. Ask Kim to plan a workout.
        </Text>
        <Button
          text="Ask Kim"
          preset="reversed"
          onPress={() => onAskKim("Plan a workout for me")}
          style={themed($emptyCta)}
        />
      </View>
    )
  }

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {sorted.map((s) => {
        const exCount = s.exerciseCount ?? s.exercises?.length ?? 0
        return (
          <TouchableOpacity
            key={s.id}
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert(
                s.title,
                "Session detail coming soon. For now ask Kim in chat.",
              )
            }
            style={[
              themed($sessionRow),
              !s.active ? { opacity: 0.6 } : undefined,
            ]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text size="sm" weight="semiBold">
                {s.title}
              </Text>
              {s.description ? (
                <Text
                  size="xxs"
                  style={{ color: theme.colors.textDim }}
                  numberOfLines={2}
                >
                  {s.description}
                </Text>
              ) : null}
              <Text size="xxs" style={{ color: theme.colors.textDim }}>
                {s.active ? "active" : "completed"}
                {exCount > 0 ? ` · ${exCount} exercise${exCount === 1 ? "" : "s"}` : ""}
              </Text>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─── Card helper ─────────────────────────────────────────────────────────────

interface CardProps {
  title: string
  children: React.ReactNode
}

const Card: FC<CardProps> = ({ title, children }) => {
  const { themed, theme } = useAppTheme()
  return (
    <View style={themed($card)}>
      <Text
        size="xxs"
        weight="semiBold"
        style={{
          color: theme.colors.textDim,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}
      >
        {title}
      </Text>
      <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
        {children}
      </View>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const $root: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.md,
  paddingBottom: spacing.xs,
})

const $tabRow: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flexDirection: "row",
  paddingHorizontal: spacing.lg,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
})

const $tabButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  paddingVertical: spacing.sm,
  alignItems: "center",
})

const $tabUnderline: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  height: 2,
  width: "60%",
  marginTop: spacing.xs,
  borderRadius: 1,
})

const $scrollContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.md,
  paddingBottom: spacing.xxl,
})

const $loadingBox: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingVertical: spacing.xxl,
  alignItems: "center",
})

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.neutral100,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.md,
})

const $statRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: spacing.xxs,
})

const $chipWrap: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $chip: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.xs,
  paddingVertical: 2,
  borderRadius: 999,
})

const $macroBarRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  height: 6,
  marginVertical: spacing.xxs,
  borderRadius: 3,
  overflow: "hidden",
})

const $logRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $numberInput: ThemedStyle<any> = ({ colors, spacing }) => ({
  flex: 1,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 8,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  backgroundColor: colors.background,
  color: colors.text,
  fontSize: 16,
})

const $windowRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
  paddingHorizontal: spacing.xxs,
})

const $windowChip: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: colors.border,
})

const $chartBox: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "flex-end",
  justifyContent: "flex-start",
})

const $chartLegend: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: spacing.xxs,
})

const $entryRow: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  paddingVertical: spacing.xs,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
})

const $deleteBtn: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.xs,
  paddingVertical: spacing.xxs,
})

const $sessionRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
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
