"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getMarketplaceItemBySource,
  type MarketplaceItem,
  type MarketplaceKind,
} from "@/lib/marketplace";
import { PublishDialog } from "./PublishDialog";
import { PublishedStatsDialog } from "./PublishedStatsDialog";
import { useTranslation } from "react-i18next";

interface Props {
  kind: MarketplaceKind;
  sourceId: string;
  defaultTitle?: string;
  /** Called whenever the published state changes (fresh publish, new version, unpublish). */
  onChange?: (item: MarketplaceItem | null) => void;
}

/**
 * Shows a "Publish" button for items that aren't live yet, and a
 * "Published · v<n>" pill for items that are. Clicking the pill opens the
 * stats dialog where the owner can view counts, push a new version, or
 * unpublish.
 */
export function PublishControl({
  kind,
  sourceId,
  defaultTitle,
  onChange,
}: Props) {
  const { t } = useTranslation("marketplace");
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishOpen, setPublishOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = await getMarketplaceItemBySource(kind, sourceId);
      setItem(found);
      onChange?.(found);
    } catch (e) {
      // Non-fatal — fall through to "not published" UI.
      console.warn("publish-control: lookup failed", e);
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [kind, sourceId, onChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePublished = useCallback(
    async (published: MarketplaceItem) => {
      setItem(published);
      onChange?.(published);
    },
    [onChange],
  );

  const handleUnpublished = useCallback(() => {
    setItem(null);
    onChange?.(null);
  }, [onChange]);

  if (loading) {
    return (
      <Button size="sm" variant="outline" disabled className="gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
      </Button>
    );
  }

  if (item) {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
          onClick={() => setStatsOpen(true)}
          title={t("stats_view_marketplace")}
        >
          <Globe className="h-3 w-3" />
          {t("published_pill", { version: item.current_version })}
        </Button>
        <PublishedStatsDialog
          open={statsOpen}
          onOpenChange={setStatsOpen}
          item={item}
          sourceId={sourceId}
          kind={kind}
          onRepublished={(updated) => {
            if (updated) setItem(updated);
            void load();
          }}
          onUnpublished={handleUnpublished}
        />
      </>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => setPublishOpen(true)}
      >
        <Upload className="h-3 w-3" />
        {t("publish", { ns: "common" })}
      </Button>
      <PublishDialog
        open={publishOpen}
        onOpenChange={(next) => {
          setPublishOpen(next);
          // Refetch only AFTER the dialog closes — otherwise updating `item`
          // here flips this control into the "Published" branch and unmounts
          // the dialog mid-success-screen.
          if (!next) {
            void load();
          }
        }}
        kind={kind}
        sourceId={sourceId}
        defaultTitle={defaultTitle}
      />
    </>
  );
}
