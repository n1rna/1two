"use client";

import { useTranslation } from "react-i18next";
import { ListShell } from "@/components/list-shell";
import { EmptyState } from "@/components/page-shell";

/**
 * Travel-tagged memories surface. Memories service lacks travel tags yet
 * (QBL-167); screen renders placeholder so navigation wires through.
 */
export function TravelMemoriesView() {
  const { t } = useTranslation("travel");
  return (
    <ListShell title={t("memories_title")} subtitle={t("memories_subtitle")}>
      <div className="px-4 py-4 sm:px-8 sm:py-6">
        <EmptyState
          title={t("memories_empty_title")}
          hint={t("memories_empty_hint")}
        />
      </div>
    </ListShell>
  );
}
