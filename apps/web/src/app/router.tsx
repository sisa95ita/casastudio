import { lazy } from "react";
import {
  createBrowserRouter,
  createMemoryRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  Routes
} from "react-router-dom";

import { RequireAuth } from "../core/auth/RequireAuth";
import { AppShell } from "../shell/AppShell";
import { NotFoundPage } from "./NotFoundPage";

/** Lazily loaded public route that owns the product imagery bundle. */
const PublicLandingPage = lazy(() =>
  import("../features/landing/PublicLandingPage").then((module) => ({ default: module.PublicLandingPage }))
);
/** Lazily loaded authenticated Projects entry route. */
const ProjectsPage = lazy(() =>
  import("../features/projects/list/ProjectsPage").then((module) => ({ default: module.ProjectsPage }))
);
/** Lazily loaded authoritative Project workspace route. */
const ProjectWorkspacePage = lazy(() =>
  import("../features/projects/workspace/ProjectWorkspacePage").then((module) => ({ default: module.ProjectWorkspacePage }))
);
/** Lazily loaded technical geometry route kept outside primary navigation. */
const GeometryPlaygroundPage = lazy(() =>
  import("../features/geometry-playground/GeometryPlaygroundPage").then((module) => ({
    default: module.GeometryPlaygroundPage
  }))
);

/** Declarative nested route tree for the CasaStudio SPA. */
export function AppRoutes() {
  return <Routes>{createAppRouteElements()}</Routes>;
}

/** Creates a data router so Project editing can use supported navigation blockers. */
export function createAppRouter(initialEntries?: readonly string[]) {
  const routes = createRoutesFromElements(createAppRouteElements());

  return initialEntries
    ? createMemoryRouter(routes, { initialEntries: [...initialEntries] })
    : createBrowserRouter(routes);
}

function createAppRouteElements() {
  return (
    <>
      <Route path="/" element={<PublicLandingPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<ProjectsPage />} />
          <Route path="geometry-playground" element={<GeometryPlaygroundPage />} />
          <Route path="projects/:projectId" element={<ProjectWorkspacePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  );
}
