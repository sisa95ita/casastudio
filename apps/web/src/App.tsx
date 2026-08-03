import { CssBaseline, ThemeProvider } from "@mui/material";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "./app-shell/AppShell";
import { GeometryPlaygroundPage } from "./geometry-playground/GeometryPlaygroundPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import "./styles.css";
import { casaStudioTheme } from "./theme/casaStudioTheme";

/**
 * Props for bootstrapping the CasaStudio web application.
 */
export type AppProps = {
  readonly initialEntries?: readonly string[];
};

/**
 * Renders the themed React Router application.
 *
 * BrowserRouter is used in production, while tests can pass `initialEntries`
 * to exercise the same nested route tree with MemoryRouter.
 */
export function App({ initialEntries }: AppProps) {
  const routes = <AppRoutes />;

  return (
    <ThemeProvider theme={casaStudioTheme}>
      <CssBaseline />
      {initialEntries ? (
        <MemoryRouter initialEntries={[...initialEntries]}>{routes}</MemoryRouter>
      ) : (
        <BrowserRouter>{routes}</BrowserRouter>
      )}
    </ThemeProvider>
  );
}

/**
 * Declarative nested route tree for the CasaStudio SPA.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="geometry-playground" element={<GeometryPlaygroundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
