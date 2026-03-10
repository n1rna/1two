// Cloud sync for bookmarks and tool-order is managed via useSyncedState in the settings UI.
// These functions remain as the localStorage interface used by components.

const BOOKMARKS_KEY = "1two:bookmarks";
const ORDER_KEY = "1two:tool-order";

export function loadBookmarks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(slugs: string[]): void {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(slugs));
  } catch {}
}

export function loadToolOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToolOrder(slugs: string[]): void {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(slugs));
  } catch {}
}
