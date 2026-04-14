/**
 * One-time migration: rename localStorage keys from "1two" prefix to "1tt" prefix.
 * Runs once on first load; sets a flag so it doesn't repeat.
 */
export function migrateStorageKeys() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem("1tt:migrated")) return;

    const renames: [string, string][] = [
      ["1two:bookmarks", "1tt:bookmarks"],
      ["1two:tool-order", "1tt:tool-order"],
      ["1two:calendar-markers", "1tt:calendar-markers"],
      ["1two:es-connections", "1tt:es-connections"],
      ["1two:es-state", "1tt:es-state"],
      ["1two-saved-logos", "1tt-saved-logos"],
      ["1two-saved-colors", "1tt-saved-colors"],
      ["1two-saved-themes", "1tt-saved-themes"],
      ["1two-saved-invoices", "1tt-saved-invoices"],
    ];

    for (const [oldKey, newKey] of renames) {
      const value = localStorage.getItem(oldKey);
      if (value != null && localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, value);
      }
    }

    localStorage.setItem("1tt:migrated", "1");
  } catch {
    // localStorage unavailable — skip silently
  }
}
