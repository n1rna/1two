import { FC, useState } from "react"
import { ActivityIndicator, TextStyle, View, ViewStyle } from "react-native"
import { domainOf, type ActionableDomain } from "@1tt/api-client/life-group"
import type { LifeActionable } from "@1tt/api-client/life"

import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface ActionableCardProps {
  actionable: LifeActionable
  onRespond: (id: string, action: string, data?: unknown) => Promise<void>
  selected?: boolean
  onToggleSelect?: (id: string) => void
  selectMode?: boolean
}

// Short-form tag for each domain. Mirrors web's color accents from
// apps/kim/src/components/actionables/actionable-card.tsx.
function domainLabel(d: ActionableDomain): string {
  switch (d) {
    case "calendar":
      return "Calendar"
    case "task":
      return "Task"
    case "routine":
      return "Routine"
    case "meal":
      return "Meal"
    case "memory":
      return "Memory"
    case "suggestion":
      return "Suggestion"
    case "other":
    default:
      return "Other"
  }
}

function relativeTime(iso: string): string {
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

export const ActionableCard: FC<ActionableCardProps> = ({
  actionable,
  onRespond,
  selected,
  onToggleSelect,
  selectMode,
}) => {
  const { themed, theme } = useAppTheme()
  const { colors } = theme
  const [busy, setBusy] = useState(false)
  const [inputValue, setInputValue] = useState("")

  const domain = domainOf(actionable)
  const journey =
    actionable.source?.kind === "journey" ? actionable.source : null

  const handle = async (action: string, data?: unknown) => {
    setBusy(true)
    try {
      await onRespond(actionable.id, action, data)
    } finally {
      setBusy(false)
    }
  }

  const containerStyle = themed([
    $card,
    selected ? { borderColor: colors.tint, borderWidth: 1.5 } : null,
  ])

  const CardInner = (
    <View style={containerStyle}>
      <View style={themed($chipRow)}>
        <View style={themed($domainChip)}>
          <Text size="xxs" style={themed($chipText)}>
            {domainLabel(domain)}
          </Text>
        </View>
        {journey?.trigger ? (
          <View style={themed($journeyChip)}>
            <Text size="xxs" style={themed($journeyChipText)}>
              {String(journey.trigger).replace(/_/g, " ")}
            </Text>
          </View>
        ) : null}
      </View>

      <Text preset="bold" style={themed($title)}>
        {actionable.title}
      </Text>
      {actionable.description ? (
        <Text size="xs" style={themed($description)}>
          {actionable.description}
        </Text>
      ) : null}

      <Text size="xxs" style={themed($timestamp)}>
        {relativeTime(actionable.createdAt)}
        {actionable.dueAt ? ` · due ${relativeTime(actionable.dueAt)}` : ""}
      </Text>

      {!selectMode ? (
        <ActionRow
          actionable={actionable}
          busy={busy}
          inputValue={inputValue}
          setInputValue={setInputValue}
          onAction={handle}
        />
      ) : null}
    </View>
  )

  if (selectMode && onToggleSelect) {
    return (
      <View style={themed($selectRow)}>
        <Button
          text={selected ? "✓" : " "}
          preset={selected ? "reversed" : "default"}
          onPress={() => onToggleSelect(actionable.id)}
          style={themed($checkbox)}
          textStyle={themed($checkboxText)}
        />
        <View style={{ flex: 1 }}>{CardInner}</View>
      </View>
    )
  }
  return CardInner
}

interface ActionRowProps {
  actionable: LifeActionable
  busy: boolean
  inputValue: string
  setInputValue: (v: string) => void
  onAction: (action: string, data?: unknown) => Promise<void>
}

const ActionRow: FC<ActionRowProps> = ({
  actionable,
  busy,
  inputValue,
  setInputValue,
  onAction,
}) => {
  const { themed, theme } = useAppTheme()
  const type = actionable.type

  if (type === "confirm") {
    return (
      <View style={themed($actionRow)}>
        <Button
          text={busy ? "" : "Approve"}
          preset="reversed"
          onPress={() => onAction("confirm")}
          disabled={busy}
          style={themed($primaryButton)}
          RightAccessory={busy ? () => <ActivityIndicator color={theme.colors.background} /> : undefined}
        />
        <Button
          text="Skip"
          preset="default"
          onPress={() => onAction("dismiss")}
          disabled={busy}
          style={themed($secondaryButton)}
        />
      </View>
    )
  }

  if (type === "choose") {
    const options =
      actionable.options ?? actionable.actionPayload?.data?.options ?? []
    return (
      <View style={themed($choiceList)}>
        {options.map((opt) => (
          <Button
            key={opt.id}
            text={opt.label}
            preset="default"
            disabled={busy}
            onPress={() => onAction("choose", { optionId: opt.id })}
            style={themed($choiceButton)}
          />
        ))}
        <Button
          text="Skip"
          preset="default"
          disabled={busy}
          onPress={() => onAction("dismiss")}
          style={themed($secondaryButton)}
        />
      </View>
    )
  }

  if (type === "input") {
    return (
      <View style={themed($actionRow)}>
        <TextField
          value={inputValue}
          onChangeText={setInputValue}
          placeholder={
            actionable.actionPayload?.data?.placeholder ?? "Type your answer…"
          }
          containerStyle={{ flex: 1 }}
          editable={!busy}
        />
        <Button
          text="Send"
          preset="reversed"
          disabled={busy || !inputValue.trim()}
          onPress={() => onAction("input", { value: inputValue.trim() })}
          style={themed($primaryButton)}
        />
      </View>
    )
  }

  // info / default
  return (
    <View style={themed($actionRow)}>
      <Button
        text="Acknowledge"
        preset="default"
        disabled={busy}
        onPress={() => onAction("confirm")}
        style={themed($primaryButton)}
      />
    </View>
  )
}

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.neutral100,
  borderRadius: 14,
  borderColor: colors.border,
  borderWidth: 1,
  padding: spacing.md,
  marginBottom: spacing.sm,
})

const $chipRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
  marginBottom: spacing.xs,
})

const $domainChip: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.secondary200,
  paddingHorizontal: spacing.xs,
  paddingVertical: 2,
  borderRadius: 10,
})

const $chipText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontWeight: "600",
})

const $journeyChip: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.primary200,
  paddingHorizontal: spacing.xs,
  paddingVertical: 2,
  borderRadius: 10,
})

const $journeyChipText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.primary500,
  fontWeight: "600",
})

const $title: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.xxs,
})

const $description: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginBottom: spacing.xs,
})

const $timestamp: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginBottom: spacing.sm,
})

const $actionRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
  alignItems: "center",
})

const $choiceList: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $primaryButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  minHeight: 40,
})

const $secondaryButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 0,
  minHeight: 40,
  paddingHorizontal: spacing.md,
})

const $choiceButton: ThemedStyle<ViewStyle> = () => ({
  minHeight: 40,
})

const $selectRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: spacing.xs,
})

const $checkbox: ThemedStyle<ViewStyle> = () => ({
  width: 32,
  minHeight: 32,
  marginTop: 12,
})

const $checkboxText: ThemedStyle<TextStyle> = () => ({
  fontSize: 16,
})
