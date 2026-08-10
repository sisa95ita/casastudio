import i18next from "i18next";
import type { i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import authEn from "./locales/en/auth.json";
import commonEn from "./locales/en/common.json";
import connectedProjectEn from "./locales/en/connected-project.json";
import geometryPlaygroundEn from "./locales/en/geometry-playground.json";
import inspectorEn from "./locales/en/inspector.json";
import navigationEn from "./locales/en/navigation.json";

/**
 * Default and fallback locale for the CasaStudio frontend.
 *
 * Components consume namespace keys through i18next so locale resources remain
 * isolated from route and shell component code.
 */
export const DEFAULT_LOCALE = "en";

/**
 * Translation namespaces grouped by UI and domain context.
 */
export const I18N_NAMESPACES = [
  "auth",
  "common",
  "connected-project",
  "navigation",
  "geometry-playground",
  "inspector"
] as const;

/**
 * Supported namespace identifier for CasaStudio translations.
 */
export type CasaI18nNamespace = (typeof I18N_NAMESPACES)[number];

/**
 * Static translation resources bundled with the web application.
 */
export const casaI18nResources = {
  en: {
    auth: authEn,
    common: commonEn,
    "connected-project": connectedProjectEn,
    navigation: navigationEn,
    "geometry-playground": geometryPlaygroundEn,
    inspector: inspectorEn
  }
} as const;

/**
 * Shared i18next instance configured for React components and tests.
 */
export const casaI18n: I18nInstance = i18next.createInstance();

casaI18n.use(initReactI18next).init({
  defaultNS: "common",
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false
  },
  lng: DEFAULT_LOCALE,
  ns: I18N_NAMESPACES,
  resources: casaI18nResources,
  supportedLngs: [DEFAULT_LOCALE]
});

export default casaI18n;
