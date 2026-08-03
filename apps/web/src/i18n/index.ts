import { useTranslation } from "react-i18next";

import casaI18n, { type CasaI18nNamespace } from "./i18n";

export {
  casaI18n,
  casaI18nResources,
  DEFAULT_LOCALE,
  I18N_NAMESPACES,
  type CasaI18nNamespace
} from "./i18n";

/**
 * Project translation hook bound to the initialized CasaStudio i18n instance.
 *
 * Components import this wrapper instead of `react-i18next` directly so direct
 * component tests and route-level renders share the same synchronous English
 * resources.
 */
export const useCasaTranslation = (namespace?: CasaI18nNamespace) =>
  useTranslation(namespace, { i18n: casaI18n });
