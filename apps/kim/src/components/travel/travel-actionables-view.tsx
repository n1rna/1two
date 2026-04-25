"use client";

import { useTranslation } from "react-i18next";
import { ListShell } from "@/components/list-shell";
import { EmptyState } from "@/components/page-shell";

/**
 * Travel-scoped actionables surface. Backend work (travel-tagged
 * actionables stream) is tracked in QBL-166; this screen renders the empty
 * shell so navigation and visual language land ahead of the data.
 */
export function TravelActionablesView() {
  const { t } = useTranslation("travel");
  return (
    <ListShell title={t("actionables_title")} subtitle={t("actionables_subtitle")}>
      <div className="px-4 py-4 sm:px-8 sm:py-6">
        <EmptyState
          title={t("actionables_empty_title")}
          hint={t("actionables_empty_hint")}
        />
      </div>
    </ListShell>
  );
}
