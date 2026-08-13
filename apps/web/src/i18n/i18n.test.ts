import { describe, expect, it } from "vitest";

import { casaI18n, DEFAULT_LOCALE, I18N_NAMESPACES } from "./index";

describe("CasaStudio i18n", () => {
  it("initializes English namespaces", () => {
    expect(casaI18n.isInitialized).toBe(true);
    expect(casaI18n.language).toBe(DEFAULT_LOCALE);
    expect(casaI18n.options.ns).toEqual(I18N_NAMESPACES);
  });

  it("looks up translations across UI namespaces", () => {
    expect(casaI18n.t("common:brand.name")).toBe("CasaStudio");
    expect(casaI18n.t("navigation:items.projects")).toBe("Projects");
    expect(casaI18n.t("landing:hero.heading")).toBe("Design spaces with confidence");
    expect(casaI18n.t("inspector:layers.showPolygons")).toBe("Show polygons");
  });

  it("falls back to English resources for unsupported locales", () => {
    const unsupportedLocaleTranslator = casaI18n.getFixedT("it");

    expect(unsupportedLocaleTranslator("common:routes.home.title")).toBe("Projects");
  });
});
