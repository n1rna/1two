"use client";

import { useMemo } from "react";
import { useKim } from "../kim-provider";
import type { KimSelection } from "../types";

/**
 * Stable identifiers for every Smart-UI action. Exposed as i18n keys
 * (see `smart_actions.json`) and used in analytics/telemetry.
 */
export const SMART_ACTION_KEYS = [
  "meal.swap",
  "meal.scale_portions",
  "meal.pantry_subs",
  "meal.mark_eaten",
  "meal.details",
  "exercise.alternatives",
  "exercise.change_reps",
  "exercise.change_sets",
  "exercise.mark_skipped",
  "exercise.explain",
  "event.reschedule",
  "event.draft_message",
  "event.cancel_with_note",
  "event.find_commute",
  "task.complete",
  "task.break_down",
  "task.schedule_block",
  "task.snooze",
  "task.delegate",
  "metric.explain_trend",
  "metric.suggest_interventions",
  "metric.compare_last_month",
  "metric.correlate",
  "metric.set_target",
] as const;

export type SmartActionKey = (typeof SMART_ACTION_KEYS)[number];

/**
 * Bundle of kim functions a Smart-UI action needs. `useSmartActions()`
 * produces bound helpers so modules can just call `smartQuick({...})`
 * without threading this context by hand.
 */
export interface KimContext {
  addSelection: ReturnType<typeof useKim>["addSelection"];
  isSelected: ReturnType<typeof useKim>["isSelected"];
  send: ReturnType<typeof useKim>["send"];
  setInput: ReturnType<typeof useKim>["setInput"];
  focusComposer: ReturnType<typeof useKim>["focusComposer"];
  postSilent: ReturnType<typeof useKim>["postSilent"];
  setOpen: ReturnType<typeof useKim>["setOpen"];
  collapseSmartUi: ReturnType<typeof useKim>["collapseSmartUi"];
}

export interface SmartQuickOpts {
  /** Shown in the thread as "→ {label}" silent marker. */
  label: string;
  /** Item being mutated — surfaced in the marker for traceability. */
  item: KimSelection;
  /** Performs the backend mutation. Resolves on success, throws on failure. */
  apiCall: () => Promise<void>;
  /** Ack note shown under the marker on success. Defaults to "Done.". */
  successAck?: string;
  /** Ack note shown on failure. Defaults to "Failed.". */
  errorAck?: string;
}

/**
 * Silent quick action: post a "→ {label}" marker, run the API call, then
 * render a small ack underneath. Never calls the LLM.
 */
export async function smartQuick(
  opts: SmartQuickOpts,
  kim: KimContext,
): Promise<void> {
  const { label, apiCall, successAck = "Done.", errorAck = "Failed." } = opts;
  // Post optimistic marker.
  kim.postSilent(label);
  // Collapse the Smart-UI module so the silent marker + ack have room to
  // breathe. Auto re-expands when the user picks a different item. (QBL-113)
  kim.collapseSmartUi();
  try {
    await apiCall();
    // Re-post a finished marker with ack. A second silent message keeps the
    // flow chronological without needing to rewrite the previous one.
    kim.postSilent(label, successAck);
  } catch (err) {
    kim.postSilent(label, errorAck);
    throw err;
  }
}

export interface SmartAgentOpts {
  /** Stable identifier like 'meal.swap'. */
  actionKey: SmartActionKey;
  /** Human-readable label shown as "→ {label}" in the user bubble. */
  label: string;
  /** Item to attach to selection; merged if not already selected. */
  item: KimSelection;
  /** Optional extra context appended to the outgoing system context. */
  systemContext?: string;
}

/**
 * Agent-backed action: attaches the item to the selection, then sends a
 * concise "→ {label}" user message so the agent picks it up. The actionKey
 * is included in the message text so the backend can trace intent.
 */
export function smartAgent(opts: SmartAgentOpts, kim: KimContext): void {
  const { actionKey, label, item, systemContext } = opts;
  if (!kim.isSelected(item.kind, item.id)) {
    kim.addSelection(item);
  }
  kim.setOpen(true);
  const extra = systemContext ? `\n\n(${systemContext})` : "";
  const message = `→ ${label} [action=${actionKey}]${extra}`;
  void kim.send(message);
  // Collapse immediately so the streaming agent response has the drawer's
  // vertical space. (QBL-113)
  kim.collapseSmartUi();
}

export interface SmartPromptOpts {
  /** Text to pre-fill into the composer. */
  prefill: string;
  /** Optional item to also attach to selection. */
  item?: KimSelection;
}

/**
 * Prefill-only action: attach optional item, populate composer, focus.
 * The user reviews/edits the prompt and hits Enter to send.
 */
export function smartPrompt(opts: SmartPromptOpts, kim: KimContext): void {
  const { prefill, item } = opts;
  if (item && !kim.isSelected(item.kind, item.id)) {
    kim.addSelection(item);
  }
  kim.setInput(prefill);
  kim.focusComposer();
  // Free up drawer height for the composer / agent response. (QBL-113)
  kim.collapseSmartUi();
}

/**
 * Hook that binds the three smart-action helpers with the current kim
 * context, so modules can call them without passing kim around.
 */
export function useSmartActions() {
  const kim = useKim();
  return useMemo(() => {
    const ctx: KimContext = {
      addSelection: kim.addSelection,
      isSelected: kim.isSelected,
      send: kim.send,
      setInput: kim.setInput,
      focusComposer: kim.focusComposer,
      postSilent: kim.postSilent,
      setOpen: kim.setOpen,
      collapseSmartUi: kim.collapseSmartUi,
    };
    return {
      smartQuick: (opts: SmartQuickOpts) => smartQuick(opts, ctx),
      smartAgent: (opts: SmartAgentOpts) => smartAgent(opts, ctx),
      smartPrompt: (opts: SmartPromptOpts) => smartPrompt(opts, ctx),
    };
  }, [
    kim.addSelection,
    kim.isSelected,
    kim.send,
    kim.setInput,
    kim.focusComposer,
    kim.postSilent,
    kim.setOpen,
    kim.collapseSmartUi,
  ]);
}
