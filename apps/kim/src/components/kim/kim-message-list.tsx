"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { KimMessage } from "./types";
import { MessageBubble } from "./message-bubble";
import { ToolCallDisplay, ToolTraceBlock } from "./tool-call-display";
import { StreamingThinkingIndicator, TypingIndicator } from "./thinking-indicator";
import { useKim } from "./kim-provider";
import { respondToActionable, type ChatEffect } from "@/lib/life";
import { READ_ONLY_TOOLS } from "./tool-labels";

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
  const { updateActionableStatus } = useKim();

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
        // Partition effects: actionables render inline separately; the rest
        // collapse into a single trace block.
        const effects = msg.effects ?? [];
        const actionableEffects: ChatEffect[] = [];
        const traceEffects: ChatEffect[] = [];
        for (const eff of effects) {
          if (eff.tool === "create_actionable" && eff.actionable) {
            actionableEffects.push(eff);
          } else if (!READ_ONLY_TOOLS.has(eff.tool)) {
            traceEffects.push(eff);
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
                  {actionableEffects.map((eff, i) => (
                    <ToolCallDisplay
                      key={`${eff.tool}-${eff.id || i}`}
                      effect={eff}
                      msgId={msg.id}
                      onActionableRespond={async (actionableId, action, data) => {
                        try {
                          await respondToActionable(actionableId, action, data);
                        } catch {
                          /* silent */
                        }
                      }}
                      onActionableStatusChange={updateActionableStatus}
                    />
                  ))}
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
