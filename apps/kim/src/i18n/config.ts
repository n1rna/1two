import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enToday from "./locales/en/today.json";
import enHealth from "./locales/en/health.json";
import enChannels from "./locales/en/channels.json";
import enSettings from "./locales/en/settings.json";
import enRoutines from "./locales/en/routines.json";
import enMeals from "./locales/en/meals.json";
import enSessions from "./locales/en/sessions.json";
import enCalendar from "./locales/en/calendar.json";
import enActionables from "./locales/en/actionables.json";
import enMemories from "./locales/en/memories.json";
import enMarketplace from "./locales/en/marketplace.json";
import enOnboarding from "./locales/en/onboarding.json";
import enLanding from "./locales/en/landing.json";
import enLogin from "./locales/en/login.json";
import enKim from "./locales/en/kim.json";

import frCommon from "./locales/fr/common.json";
import frToday from "./locales/fr/today.json";
import frHealth from "./locales/fr/health.json";
import frChannels from "./locales/fr/channels.json";
import frSettings from "./locales/fr/settings.json";
import frRoutines from "./locales/fr/routines.json";
import frMeals from "./locales/fr/meals.json";
import frSessions from "./locales/fr/sessions.json";
import frCalendar from "./locales/fr/calendar.json";
import frActionables from "./locales/fr/actionables.json";
import frMemories from "./locales/fr/memories.json";
import frMarketplace from "./locales/fr/marketplace.json";
import frOnboarding from "./locales/fr/onboarding.json";
import frLanding from "./locales/fr/landing.json";
import frLogin from "./locales/fr/login.json";
import frKim from "./locales/fr/kim.json";

import nlCommon from "./locales/nl/common.json";
import nlToday from "./locales/nl/today.json";
import nlHealth from "./locales/nl/health.json";
import nlChannels from "./locales/nl/channels.json";
import nlSettings from "./locales/nl/settings.json";
import nlRoutines from "./locales/nl/routines.json";
import nlMeals from "./locales/nl/meals.json";
import nlSessions from "./locales/nl/sessions.json";
import nlCalendar from "./locales/nl/calendar.json";
import nlActionables from "./locales/nl/actionables.json";
import nlMemories from "./locales/nl/memories.json";
import nlMarketplace from "./locales/nl/marketplace.json";
import nlOnboarding from "./locales/nl/onboarding.json";
import nlLanding from "./locales/nl/landing.json";
import nlLogin from "./locales/nl/login.json";
import nlKim from "./locales/nl/kim.json";

import deCommon from "./locales/de/common.json";
import deToday from "./locales/de/today.json";
import deHealth from "./locales/de/health.json";
import deChannels from "./locales/de/channels.json";
import deSettings from "./locales/de/settings.json";
import deRoutines from "./locales/de/routines.json";
import deMeals from "./locales/de/meals.json";
import deSessions from "./locales/de/sessions.json";
import deCalendar from "./locales/de/calendar.json";
import deActionables from "./locales/de/actionables.json";
import deMemories from "./locales/de/memories.json";
import deMarketplace from "./locales/de/marketplace.json";
import deOnboarding from "./locales/de/onboarding.json";
import deLanding from "./locales/de/landing.json";
import deLogin from "./locales/de/login.json";
import deKim from "./locales/de/kim.json";

import esCommon from "./locales/es/common.json";
import esToday from "./locales/es/today.json";
import esHealth from "./locales/es/health.json";
import esChannels from "./locales/es/channels.json";
import esSettings from "./locales/es/settings.json";
import esRoutines from "./locales/es/routines.json";
import esMeals from "./locales/es/meals.json";
import esSessions from "./locales/es/sessions.json";
import esCalendar from "./locales/es/calendar.json";
import esActionables from "./locales/es/actionables.json";
import esMemories from "./locales/es/memories.json";
import esMarketplace from "./locales/es/marketplace.json";
import esOnboarding from "./locales/es/onboarding.json";
import esLanding from "./locales/es/landing.json";
import esLogin from "./locales/es/login.json";
import esKim from "./locales/es/kim.json";

import itCommon from "./locales/it/common.json";
import itToday from "./locales/it/today.json";
import itHealth from "./locales/it/health.json";
import itChannels from "./locales/it/channels.json";
import itSettings from "./locales/it/settings.json";
import itRoutines from "./locales/it/routines.json";
import itMeals from "./locales/it/meals.json";
import itSessions from "./locales/it/sessions.json";
import itCalendar from "./locales/it/calendar.json";
import itActionables from "./locales/it/actionables.json";
import itMemories from "./locales/it/memories.json";
import itMarketplace from "./locales/it/marketplace.json";
import itOnboarding from "./locales/it/onboarding.json";
import itLanding from "./locales/it/landing.json";
import itLogin from "./locales/it/login.json";
import itKim from "./locales/it/kim.json";

import plCommon from "./locales/pl/common.json";
import plToday from "./locales/pl/today.json";
import plHealth from "./locales/pl/health.json";
import plChannels from "./locales/pl/channels.json";
import plSettings from "./locales/pl/settings.json";
import plRoutines from "./locales/pl/routines.json";
import plMeals from "./locales/pl/meals.json";
import plSessions from "./locales/pl/sessions.json";
import plCalendar from "./locales/pl/calendar.json";
import plActionables from "./locales/pl/actionables.json";
import plMemories from "./locales/pl/memories.json";
import plMarketplace from "./locales/pl/marketplace.json";
import plOnboarding from "./locales/pl/onboarding.json";
import plLanding from "./locales/pl/landing.json";
import plLogin from "./locales/pl/login.json";
import plKim from "./locales/pl/kim.json";

export const SUPPORTED_LOCALES = [
  "en",
  "fr",
  "nl",
  "de",
  "es",
  "it",
  "pl",
] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  nl: "Nederlands",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  pl: "Polski",
};

export const NAMESPACES = [
  "common",
  "today",
  "health",
  "channels",
  "settings",
  "routines",
  "meals",
  "sessions",
  "calendar",
  "actionables",
  "memories",
  "marketplace",
  "onboarding",
  "landing",
  "login",
  "kim",
] as const;

const ns = (
  common: object,
  today: object,
  health: object,
  channels: object,
  settings: object,
  routines: object,
  meals: object,
  sessions: object,
  calendar: object,
  actionables: object,
  memories: object,
  marketplace: object,
  onboarding: object,
  landing: object,
  login: object,
  kim: object,
) => ({
  common,
  today,
  health,
  channels,
  settings,
  routines,
  meals,
  sessions,
  calendar,
  actionables,
  memories,
  marketplace,
  onboarding,
  landing,
  login,
  kim,
});

const resources = {
  en: ns(enCommon, enToday, enHealth, enChannels, enSettings, enRoutines, enMeals, enSessions, enCalendar, enActionables, enMemories, enMarketplace, enOnboarding, enLanding, enLogin, enKim),
  fr: ns(frCommon, frToday, frHealth, frChannels, frSettings, frRoutines, frMeals, frSessions, frCalendar, frActionables, frMemories, frMarketplace, frOnboarding, frLanding, frLogin, frKim),
  nl: ns(nlCommon, nlToday, nlHealth, nlChannels, nlSettings, nlRoutines, nlMeals, nlSessions, nlCalendar, nlActionables, nlMemories, nlMarketplace, nlOnboarding, nlLanding, nlLogin, nlKim),
  de: ns(deCommon, deToday, deHealth, deChannels, deSettings, deRoutines, deMeals, deSessions, deCalendar, deActionables, deMemories, deMarketplace, deOnboarding, deLanding, deLogin, deKim),
  es: ns(esCommon, esToday, esHealth, esChannels, esSettings, esRoutines, esMeals, esSessions, esCalendar, esActionables, esMemories, esMarketplace, esOnboarding, esLanding, esLogin, esKim),
  it: ns(itCommon, itToday, itHealth, itChannels, itSettings, itRoutines, itMeals, itSessions, itCalendar, itActionables, itMemories, itMarketplace, itOnboarding, itLanding, itLogin, itKim),
  pl: ns(plCommon, plToday, plHealth, plChannels, plSettings, plRoutines, plMeals, plSessions, plCalendar, plActionables, plMemories, plMarketplace, plOnboarding, plLanding, plLogin, plKim),
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LOCALES],
    ns: [...NAMESPACES],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "kim-locale",
      caches: ["localStorage"],
    },
  });

export default i18n;
