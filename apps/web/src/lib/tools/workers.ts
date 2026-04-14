export interface WorkerRegistration {
  id: string;
  scope: string;
  scriptURL: string;
  state: string;
  type: string;
  updateViaCache: string;
  navigationPreload: boolean;
}

export interface CacheEntry {
  name: string;
  count: number;
  urls: string[];
}

export async function getRegistrations(): Promise<WorkerRegistration[]> {
  if (!("serviceWorker" in navigator)) return [];

  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.map((reg, i) => {
    const worker = reg.active || reg.waiting || reg.installing;
    return {
      id: `sw-${i}`,
      scope: reg.scope,
      scriptURL: worker?.scriptURL || "unknown",
      state: worker?.state || "unknown",
      type: reg.active ? "active" : reg.waiting ? "waiting" : "installing",
      updateViaCache: reg.updateViaCache,
      navigationPreload: "navigationPreload" in reg,
    };
  });
}

export async function unregisterWorker(scope: string): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;

  const regs = await navigator.serviceWorker.getRegistrations();
  const reg = regs.find((r) => r.scope === scope);
  if (reg) {
    return reg.unregister();
  }
  return false;
}

export async function updateWorker(scope: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const regs = await navigator.serviceWorker.getRegistrations();
  const reg = regs.find((r) => r.scope === scope);
  if (reg) {
    await reg.update();
  }
}

export async function getCacheEntries(): Promise<CacheEntry[]> {
  if (!("caches" in window)) return [];

  const names = await caches.keys();
  const entries: CacheEntry[] = [];

  for (const name of names) {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    entries.push({
      name,
      count: requests.length,
      urls: requests.map((r) => r.url),
    });
  }

  return entries;
}

export async function deleteCache(name: string): Promise<boolean> {
  if (!("caches" in window)) return false;
  return caches.delete(name);
}

export function isServiceWorkerSupported(): boolean {
  return "serviceWorker" in navigator;
}

export function isCacheStorageSupported(): boolean {
  return "caches" in window;
}
