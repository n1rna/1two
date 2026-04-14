"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { OgImageBuilder } from "@/components/tools/og-image-builder";
import type { OgCollection } from "@/lib/og/types";

export function OgCollectionEditor({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const [collection, setCollection] = useState<OgCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/proxy/og/collections/${collectionId}`, {
          credentials: "include",
        });
        if (res.status === 404) {
          setError("Collection not found");
          return;
        }
        if (!res.ok) {
          setError("Failed to load collection");
          return;
        }
        const data = (await res.json()) as OgCollection;
        setCollection(data);
      } catch {
        setError("Failed to load collection");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [collectionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <p className="text-sm text-muted-foreground">{error ?? "Collection not found"}</p>
        <button
          className="text-sm text-primary hover:underline"
          onClick={() => router.push("/tools/og")}
        >
          Back to OG Builder
        </button>
      </div>
    );
  }

  return (
    <OgImageBuilder
      collectionId={collection.id}
      initialState={collection.config}
      initialName={collection.name}
      initialSlug={collection.slug}
      initialPublished={collection.published}
    />
  );
}
