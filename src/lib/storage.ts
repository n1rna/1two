"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────

export interface StorageBucket {
  id: string;
  name: string;
  status: string;
  totalSize: number;
  objectCount: number;
  createdAt: string;
}

export interface StorageObject {
  id: string;
  key: string;
  size: number;
  contentType: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageObjectsResponse {
  objects: StorageObject[];
  prefixes: string[];
  nextContinuationToken?: string;
}

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
  bucketCount: number;
  bucketLimit: number;
}

// ── Hooks ─────────────────────────────────────────────

export function useStorageBuckets() {
  const [data, setData] = useState<StorageBucket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/storage/buckets", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch storage buckets: ${res.status}`);
      }
      const json = (await res.json()) as { buckets: StorageBucket[] };
      setData(json.buckets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// ── API helpers ────────────────────────────────────────

export async function createBucket(name: string): Promise<StorageBucket> {
  const res = await fetch("/api/proxy/storage/buckets", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create bucket: ${res.status}`);
  }
  return (await res.json()) as StorageBucket;
}

export async function deleteBucket(id: string): Promise<void> {
  const res = await fetch(`/api/proxy/storage/buckets/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete bucket: ${res.status}`);
  }
}

export async function listObjects(
  bucketId: string,
  prefix?: string,
  delimiter?: string,
  limit?: number
): Promise<StorageObjectsResponse> {
  const params = new URLSearchParams();
  if (prefix) params.set("prefix", prefix);
  if (delimiter) params.set("delimiter", delimiter);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  const res = await fetch(
    `/api/proxy/storage/buckets/${bucketId}/objects${qs ? `?${qs}` : ""}`,
    { credentials: "include" }
  );
  if (!res.ok) {
    throw new Error(`Failed to list objects: ${res.status}`);
  }
  return (await res.json()) as StorageObjectsResponse;
}

export async function uploadObject(
  bucketId: string,
  file: File,
  key?: string
): Promise<StorageObject> {
  const form = new FormData();
  form.append("file", file);
  if (key) form.append("key", key);
  const res = await fetch(`/api/proxy/storage/buckets/${bucketId}/objects`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Failed to upload object: ${res.status}`);
  }
  return (await res.json()) as StorageObject;
}

export async function deleteObject(
  bucketId: string,
  objectId: string
): Promise<void> {
  const res = await fetch(
    `/api/proxy/storage/buckets/${bucketId}/objects/${objectId}`,
    { method: "DELETE", credentials: "include" }
  );
  if (!res.ok) {
    throw new Error(`Failed to delete object: ${res.status}`);
  }
}

export async function getObjectUrl(
  bucketId: string,
  objectId: string
): Promise<string> {
  const res = await fetch(
    `/api/proxy/storage/buckets/${bucketId}/objects/${objectId}/url`,
    { credentials: "include" }
  );
  if (!res.ok) {
    throw new Error(`Failed to get object URL: ${res.status}`);
  }
  const json = (await res.json()) as { url: string };
  return json.url;
}

export async function getStorageUsage(): Promise<StorageUsage> {
  const res = await fetch("/api/proxy/storage/usage", {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to get storage usage: ${res.status}`);
  }
  return (await res.json()) as StorageUsage;
}
