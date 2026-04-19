"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { KimMessage } from "./types";
import { MessageBubble } from "./message-bubble";
import { ToolTraceBlock } from "./tool-call-display";
import { StreamingThinkingIndicator, TypingIndicator } from "./thinking-indicator";
import { useKim } from "./kim-provider";
import { respondToActionable, type ChatEffect } from "@/lib/life";
import { READ_ONLY_TOOLS } from "./tool-labels";
import { ActionableCard } from "@/components/actionables/actionable-card";

interface Props {
  messages: KimMessage[];
  streamingText: string;
  streamingTool: string | null;
  streamingHistory: string[];
  sending: boolean;
}

export function KimMessageList({
  messages,
  streamingText,
  streamingTool,
  streamingHistory,
  sending,
}: Props) {
  const {
    actionables,
    conversationId,
    loadConversation,
    refreshActionable,
    updateActionableStatus,
  } = useKim();

  const showInitialTyping =
    sending &&
    streamingText === "" &&
    streamingTool === null &&
    streamingHistory.length === 0;

  const showStreamingTools = streamingHistory.length > 0 || streamingTool;

  // Build trace entries from the streaming history: completed tools first,
  // then the currently-active tool (if any). Read-only lookups stay visible
  // in the live trace (vs the final message) so users see what Kim checked.
  const streamingEntries = [
    ...streamingHistory
      .filter((t) => t !== streamingTool)
      .map((t, i) => ({
        key: `done-${t}-${i}`,
        toolName: t,
        state: "done" as const,
      })),
    ...(streamingTool
      ? [
          {
            key: `active-${streamingTool}`,
            toolName: streamingTool,
            state: "active" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col">
      {messages.map((msg) => {
        // Partition effects: the trace block shows every non-read-only tool
        // call; actionables render as full interactive ActionableCards below
        // the message (QBL-112). The ID list is the union of what streamed
        // live (msg.actionableIds) and what arrived on the save event
        // (effect.actionable.id) — deduped so we never double-render.
        const effects = msg.effects ?? [];
        const traceEffects: ChatEffect[] = [];
        const embedded: Record<string, ChatEffect> = {};
        for (const eff of effects) {
          if (eff.tool === "create_actionable") {
            if (eff.actionable) embedded[eff.actionable.id] = eff;
          } else if (!READ_ONLY_TOOLS.has(eff.tool)) {
            traceEffects.push(eff);
          }
        }
        const cardIds: string[] = [];
        const seenIds = new Set<string>();
        for (const id of msg.actionableIds ?? []) {
          if (!seenIds.has(id)) {
            seenIds.add(id);
            cardIds.push(id);
          }
        }
        for (const id of Object.keys(embedded)) {
          if (!seenIds.has(id)) {
            seenIds.add(id);
            cardIds.push(id);
          }
        }

        return (
          <div key={msg.id}>
            <MessageBubble msg={msg}>
              {msg.role === "assistant" && (
                <>
                  {traceEffects.length > 0 && (
                    <ToolTraceBlock
                      entries={traceEffects.map((eff, i) => ({
                        key: `${msg.id}-${eff.tool}-${eff.id || i}`,
                        effect: eff,
                        toolName: eff.tool,
                        state: "done",
                      }))}
                      streaming={false}
                    />
                  )}
                  {cardIds.map((aid) => {
                    // Prefer the live cache (fresh after response) and fall
                    // back to the effect's embedded record (for messages
                    // loaded from history before the cache is primed).
                    const actionable =
                      actionables[aid] ?? embedded[aid]?.actionable;
                    if (!actionable) {
                      return (
                        <div
                          key={`pending-${aid}`}
                          className="mt-2 h-16 rounded-lg border bg-card/50 animate-pulse"
                        />
                      );
                    }
                    return (
                      <div key={aid} className="mt-2">
                        <ActionableCard
                          actionable={actionable}
                          variant="compact"
                          onRespond={async (id, action, data) => {
                            try {
                              await respondToActionable(id, action, data);
                              // Optimistically flip status so the card
                              // collapses to its resolved look immediately.
                              updateActionableStatus(
                                msg.id,
                                id,
                                action === "dismiss"
                                  ? "dismissed"
                                  : "confirmed",
                              );
                              // Refetch the single actionable — the backend
                              // may have attached follow-up response data or
                              // changed status beyond confirm/dismiss
                              // (e.g. snoozed). Best-effort.
                              void refreshActionable(id);
                              // Backend responding to an actionable may
                              // kick off a follow-up agent turn that
                              // persists new messages (journey flow, etc).
                              // Poll the conversation a couple of seconds
                              // later so those land in the thread without
                              // requiring a manual refresh. Scoped to the
                              // current conversation; no-op during
                              // streaming of a new turn.
                              if (conversationId) {
                                const cid = conversationId;
                                setTimeout(() => {
                                  void loadConversation(cid);
                                }, 2500);
                              }
                            } catch {
                              /* silent — error surfaces in status */
                            }
                          }}
                        />
                      </div>
                    );
                  })}
                </>
              )}
            </MessageBubble>
          </div>
        );
      })}

      {showInitialTyping && <TypingIndicator />}

      <AnimatePresence>
        {showStreamingTools && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="py-2"
          >
            <ToolTraceBlock entries={streamingEntries} streaming={sending} />

            {/* Thinking after tools ran but before text */}
            {!streamingTool && sending && streamingText === "" && (
              <div className="mt-2 px-3">
                <StreamingThinkingIndicator />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
