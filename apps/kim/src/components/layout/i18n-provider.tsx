"use client";

import { useEffect } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n from "@/i18n/config";

function HtmlLangSync() {
  const { i18n: instance } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = instance.language;
    const handler = (lng: string) => {
      document.documentElement.lang = lng;
    };
    instance.on("languageChanged", handler);
    return () => {
      instance.off("languageChanged", handler);
    };
  }, [instance]);
  return null;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <HtmlLangSync />
      {children}
    </I18nextProvider>
  );
}
