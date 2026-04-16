import { describe, it, expect } from "vitest";
import { SUPPORTED_LOCALES, NAMESPACES } from "../config";

const localeModules = import.meta.glob("../locales/**/*.json", { eager: true });

type JsonObject = Record<string, unknown>;

function flatKeys(obj: JsonObject, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      return flatKeys(v as JsonObject, key);
    }
    return [key];
  });
}

function loadBundle(locale: string, ns: string): JsonObject {
  const path = `../locales/${locale}/${ns}.json`;
  const mod = localeModules[path] as { default: JsonObject } | undefined;
  if (!mod) throw new Error(`Missing locale file: ${path}`);
  return mod.default;
}

describe("i18n completeness", () => {
  for (const ns of NAMESPACES) {
    const enBundle = loadBundle("en", ns);
    const enKeys = flatKeys(enBundle).sort();

    for (const locale of SUPPORTED_LOCALES) {
      if (locale === "en") continue;

      it(`${locale}/${ns} has every key from en/${ns}`, () => {
        const localeBundle = loadBundle(locale, ns);
        const localeKeys = new Set(flatKeys(localeBundle));
        const missing = enKeys.filter((k) => !localeKeys.has(k));
        expect(
          missing,
          `Missing keys in ${locale}/${ns}: ${missing.join(", ")}`,
        ).toEqual([]);
      });

      it(`${locale}/${ns} has no extra keys beyond en/${ns}`, () => {
        const localeBundle = loadBundle(locale, ns);
        const enKeySet = new Set(enKeys);
        const localeKeyList = flatKeys(localeBundle);
        const extra = localeKeyList.filter((k) => !enKeySet.has(k));
        expect(
          extra,
          `Extra keys in ${locale}/${ns}: ${extra.join(", ")}`,
        ).toEqual([]);
      });
    }
  }
});
