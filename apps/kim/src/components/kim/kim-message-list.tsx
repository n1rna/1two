"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import type { KimMessage } from "./types";
import { MessageBubble } from "./message-bubble";
import { ToolCallDisplay } from "./tool-call-display";
import { StreamingThinkingIndicator, TypingIndicator } from "./thinking-indicator";
import { toolMeta } from "./tool-labels";
import { useKim } from "./kim-provider";
import { respondToActionable } from "@/lib/life";

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

  return (
    <div className="flex flex-col">
      {messages.map((msg) => (
        <div key={msg.id}>
          <MessageBubble msg={msg}>
            {msg.role === "assistant" &&
              msg.effects?.map((eff, i) => (
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
          </MessageBubble>
        </div>
      ))}

      {showInitialTyping && <TypingIndicator />}

      <AnimatePresence>
        {showStreamingTools && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-2 max-w-[90%] space-y-0.5"
          >
            {/* Completed tools */}
            <AnimatePresence>
              {streamingHistory
                .filter((t) => t !== streamingTool)
                .map((toolName, i) => {
                  const m = toolMeta(toolName);
                  return (
                    <motion.div
                      key={`${toolName}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 text-xs py-0.5"
                      style={{ color: "var(--kim-ink-dim)" }}
                    >
                      <div
                        className="flex items-center justify-center size-4 rounded-full"
                        style={{ background: "var(--kim-amber-soft)", color: "var(--kim-amber)" }}
                      >
                        <Check className="size-2.5" />
                      </div>
                      <span>{m.label}</span>
                    </motion.div>
                  );
                })}
            </AnimatePresence>

            {/* Active tool */}
            <AnimatePresence mode="wait">
              {streamingTool && (
                <motion.div
                  key={streamingTool}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 text-xs py-0.5"
                  style={{ color: "var(--kim-ink)" }}
                >
                  <div className="flex items-center justify-center size-4">
                    <Loader2 className="size-3.5 animate-spin" style={{ color: "var(--kim-amber)" }} />
                  </div>
                  <span>{toolMeta(streamingTool).activeLabel}…</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Thinking after tools ran but before text */}
            {!streamingTool && sending && streamingText === "" && (
              <StreamingThinkingIndicator />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
