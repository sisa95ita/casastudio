import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { casaI18n } from "./i18n";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(casaI18n.t("geometry-playground:errors.rootElementMissing"));
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
