import { FC, useEffect } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export interface ActivityPulseDotProps {
  /** When true, renders the animated teal dot; otherwise nothing. */
  running: boolean
  /** Count of recent+active runs, shown as "· N" when provided and > 0. */
  count?: number
  onPress: () => void
}

/**
 * Header-sized teal pulsing dot matching the web kim drawer trigger.
 * Reuses the Reanimated scale 1 → 1.3 → 1, 1400ms withRepeat pattern from
 * ToolTraceBlock's active bullet. Renders nothing when `running` is false,
 * so callers can hang it in any row unconditionally.
 */
export const ActivityPulseDot: FC<ActivityPulseDotProps> = ({
  running,
  count,
  onPress,
}) => {
  const { themed, theme } = useAppTheme()
  const scale = useSharedValue(1)

  useEffect(() => {
    if (running) {
      scale.value = withRepeat(
        withTiming(1.3, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      )
    } else {
      scale.value = 1
    }
  }, [running, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  if (!running) return null

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={
        count && count > 0
          ? `Agent activity, ${count} recent run${count === 1 ? "" : "s"}`
          : "Agent activity"
      }
      style={themed($wrap)}
    >
      <View style={themed($dotBase)}>
        <Animated.View
          style={[
            themed($dot),
            { backgroundColor: theme.colors.palette.primary400 },
            animatedStyle,
          ]}
        />
      </View>
      {count && count > 0 ? (
        <Text style={themed($countText)}>· {count}</Text>
      ) : null}
    </Pressable>
  )
}

const $wrap: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  paddingHorizontal: spacing.xs,
  minHeight: 36,
})

const $dotBase: ThemedStyle<ViewStyle> = () => ({
  width: 10,
  height: 10,
  alignItems: "center",
  justifyContent: "center",
})

const $dot: ThemedStyle<ViewStyle> = () => ({
  width: 8,
  height: 8,
  borderRadius: 4,
})

const $countText: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 10,
  letterSpacing: 1,
  color: colors.textDim,
  fontVariant: ["tabular-nums"],
})
