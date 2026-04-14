"use client";

import { useEffect, useRef } from "react";
import { useKim, type KimFormKind } from "./kim-provider";

/**
 * Registers the current page as an "active form" in Kim's context and
 * subscribes to `draft_form` tool effects for that form kind.
 *
 * - `form`: which form kind (routine / meal_plan / session).
 * - `title`: short label shown in the agent system prompt.
 * - `values`: current form state — re-passed on every render so Kim always
 *    sees the latest values; the provider stores them via a ref so they don't
 *    re-trigger the send closure.
 * - `onDraft`: called with the subset of fields the agent wants updated.
 */
export function useKimForm(
  form: KimFormKind,
  title: string,
  values: Record<string, unknown>,
  onDraft: (values: Record<string, unknown>) => void,
) {
  const { setActiveForm, registerFormDraft } = useKim();
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;

  // Push the active form + its latest values every render so the system
  // prompt gets fresh data.
  useEffect(() => {
    setActiveForm({ form, title, values });
    return () => setActiveForm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, title, JSON.stringify(values)]);

  // Register once — the handler ref lets us always dispatch to the latest
  // onDraft without re-registering.
  useEffect(() => {
    const cleanup = registerFormDraft(form, (v) => onDraftRef.current(v));
    return cleanup;
  }, [form, registerFormDraft]);
}
