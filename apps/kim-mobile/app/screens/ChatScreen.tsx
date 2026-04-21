import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"
import {
  listLifeConversations,
  getLifeConversationMessages,
  streamLifeChat,
  type ChatEffect,
  type LifeMessage,
} from "@1tt/api-client/life"

import { Button } from "@/components/Button"
import { PressableIcon } from "@/components/Icon"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { ToolTraceBlock, type TraceState } from "@/components/ToolTraceBlock"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface ChatScreenProps extends MainTabScreenProps<"Chat"> {}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  toolCalls?: ChatEffect[]
  /** True while the assistant is streaming tokens into this message. */
  streaming?: boolean
}

function toChatMessage(m: LifeMessage): ChatMessage {
  return {
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    toolCalls: m.toolCalls,
  }
}

/**
 * Map a tool call's position in the list + overall streaming state onto
 * the trace row visual state. Last row is "active" while streaming; all
 * prior rows are "done"; once the turn finishes, every row is "done".
 * A failed tool short-circuits to "done" + red bullet inside the block.
 */
function deriveTraceState(
  effect: ChatEffect,
  index: number,
  total: number,
  streaming: boolean,
): TraceState {
  if (effect.success === false) return "done"
  if (!streaming) return "done"
  return index === total - 1 ? "active" : "done"
}

/**
 * Chat screen. Streams Kim's replies token-by-token using the shared
 * `streamLifeChat` helper. On mount we try to reopen the most recent
 * conversation so context carries across sessions; if there isn't one,
 * we start fresh and let the first message define the conversationId.
 *
 * v1 scope: category `auto`, no slash commands, no routine context, no
 * form drafting — those stay web-only per QBL-67.
 */
export const ChatScreen: FC<ChatScreenProps> = ({ navigation }) => {
  const { themed, theme } = useAppTheme()
  const { colors } = theme

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const conversationIdRef = useRef<string | null>(null)

  // On first render pick up the most recent conversation so the user
  // continues where they left off. If the list is empty we stay at an
  // empty state and let send() mint a new conversationId.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const convs = await listLifeConversations()
        if (cancelled) return
        if (convs.length === 0) {
          setLoading(false)
          return
        }
        const latest = convs[0]
        conversationIdRef.current = latest.id
        const msgs = await getLifeConversationMessages(latest.id)
        if (cancelled) return
        setMessages(msgs.map(toChatMessage))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    setError(null)
    setSending(true)

    const userMsg: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: text,
    }
    const assistantId = `local-assistant-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    }
    setMessages((prev) => [...prev, userMsg, assistantMsg])

    const updateAssistant = (patch: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
      )
    }

    try {
      await streamLifeChat(
        text,
        {
          onToken: (tok) =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + tok } : m,
              ),
            ),
          onToolCall: (toolName) =>
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m
                const calls = m.toolCalls ?? []
                return {
                  ...m,
                  toolCalls: [
                    ...calls,
                    { tool: toolName, id: `call-${Date.now()}-${calls.length}` } as ChatEffect,
                  ],
                }
              }),
            ),
          onToolResult: () => {
            /* result lands in onComplete; nothing to do mid-stream */
          },
          onComplete: (data) => {
            conversationIdRef.current = data.conversationId
            updateAssistant({
              id: data.message.id,
              content: data.message.content,
              toolCalls: data.effects ?? data.message.toolCalls,
              streaming: false,
            })
          },
          onError: (e) => {
            setError(e)
            updateAssistant({ streaming: false })
          },
        },
        conversationIdRef.current ?? undefined,
        undefined,
        undefined,
        undefined,
        "auto",
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      updateAssistant({ streaming: false })
    } finally {
      setSending(false)
    }
  }, [input, sending])

  const reversed = useMemo(() => [...messages].reverse(), [messages])

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($root)}>
      <View style={themed($header)}>
        <View style={{ flex: 1 }}>
          <Text preset="heading">Chat</Text>
          <Text size="xs" style={themed($subtitle)}>
            {conversationIdRef.current ? "Continuing conversation" : "New conversation"}
          </Text>
        </View>
        <Button
          text="New"
          preset="default"
          onPress={() => {
            conversationIdRef.current = null
            setMessages([])
            setError(null)
          }}
          style={themed($headerButton)}
        />
        <Button
          text="Past"
          preset="default"
          onPress={() => navigation.navigate("Conversations")}
          style={themed($headerButton)}
        />
      </View>

      {error ? (
        <View style={themed($errorBox)}>
          <Text size="xs" style={themed($errorText)}>
            {error}
          </Text>
          <Button text="Dismiss" preset="default" onPress={() => setError(null)} />
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        {loading ? (
          <View style={themed($loadingBox)}>
            <ActivityIndicator color={colors.tint} />
          </View>
        ) : (
          <FlatList
            data={reversed}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={themed($listContent)}
            renderItem={({ item }) => <MessageBubble message={item} />}
            ListFooterComponent={
              messages.length === 0 ? (
                <View style={themed($emptyBox)}>
                  <Text size="xs" style={themed($subtitle)}>
                    Say hi to Kim to get started.
                  </Text>
                </View>
              ) : null
            }
          />
        )}

        <View style={themed($composerRow)}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message Kim…"
            placeholderTextColor={colors.textDim}
            editable={!sending}
            multiline
            style={themed($input)}
          />
          <PressableIcon
            icon="check"
            size={22}
            color={sending || !input.trim() ? colors.textDim : colors.tint}
            onPress={send}
            disabled={sending || !input.trim()}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const MessageBubble: FC<{ message: ChatMessage }> = ({ message }) => {
  const { themed, theme } = useAppTheme()
  const isUser = message.role === "user"
  return (
    <View style={themed(isUser ? $userBubbleRow : $assistantBubbleRow)}>
      <View
        style={[
          themed($bubble),
          isUser ? themed($userBubble) : themed($assistantBubble),
        ]}
      >
        <Text
          style={isUser ? themed($userText) : themed($assistantText)}
          size="sm"
        >
          {message.content || (message.streaming ? "…" : "")}
        </Text>
        {message.toolCalls && message.toolCalls.length > 0 ? (
          <ToolTraceBlock
            entries={message.toolCalls.map((tc, i) => ({
              key: `${tc.id ?? tc.tool}-${i}`,
              effect: tc,
              toolName: tc.tool,
              state: deriveTraceState(
                tc,
                i,
                message.toolCalls!.length,
                message.streaming ?? false,
              ),
            }))}
            streaming={message.streaming ?? false}
          />
        ) : null}
        {message.streaming ? (
          <ActivityIndicator
            size="small"
            color={theme.colors.textDim}
            style={{ marginTop: 6 }}
          />
        ) : null}
      </View>
    </View>
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

const $loadingBox: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
})

const $emptyBox: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.xl,
  alignItems: "center",
})

const $listContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  paddingBottom: spacing.md,
})

const $userBubbleRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "flex-end",
  marginTop: spacing.xs,
})

const $assistantBubbleRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "flex-start",
  marginTop: spacing.xs,
})

const $bubble: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  maxWidth: "82%",
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderRadius: 16,
})

const $userBubble: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderBottomRightRadius: 4,
})

const $assistantBubble: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.neutral200,
  borderBottomLeftRadius: 4,
})

const $userText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.neutral100,
})

const $assistantText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $composerRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-end",
  gap: spacing.sm,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
  borderTopColor: colors.border,
  borderTopWidth: 1,
  backgroundColor: colors.background,
})

const $input: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flex: 1,
  minHeight: 40,
  maxHeight: 140,
  borderRadius: 12,
  backgroundColor: colors.palette.neutral200,
  color: colors.text,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.xs,
})

const $errorBox: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  marginHorizontal: spacing.lg,
  marginTop: spacing.xs,
  padding: spacing.sm,
  backgroundColor: colors.errorBackground,
  borderRadius: 10,
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
  flex: 1,
})
