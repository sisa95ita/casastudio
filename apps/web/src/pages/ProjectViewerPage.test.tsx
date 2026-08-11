import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GeometryEngine } from "@casastudio/geometry";
import { readFileSync } from "node:fs";
import { QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { useMemo, useState } from "react";
import { Link, MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiProvider } from "../api/ApiProvider";
import { CasaStudioApiClient } from "../api/CasaStudioApiClient";
import { AuthProvider } from "../auth/AuthProvider";
import type { AuthClient } from "../auth/auth-client";
import {
  AppShellContentContext,
  defaultAppShellContent,
  type AppShellContent
} from "../app-shell/AppShellContext";
import { createAppQueryClient } from "../queries/query-client";
import { createAppStore } from "../state/store";
import { demoProjectFixture } from "../test/demo-project-fixture";
import { createGeometrySnapshotFixture } from "../test/geometry-snapshot-fixture";
import { ProjectViewerPage } from "./ProjectViewerPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const geometryResponse = createGeometrySnapshotFixture(
  demoProjectFixture.id,
  demoProjectFixture.revision
);

function createAuthClient(): AuthClient {
  return {
    initialize: vi.fn().mockResolvedValue({ authenticated: true }),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn().mockResolvedValue("access-token")
  };
}

function createApiClient(fetchImplementation: typeof fetch) {
  return new CasaStudioApiClient({
    baseUrl: "http://localhost:3000",
    getAccessToken: vi.fn().mockResolvedValue("access-token"),
    fetchImplementation
  });
}

function renderConnectedRoute(client: CasaStudioApiClient, initialProjectId = demoProjectFixture.id) {
  const queryClient = createAppQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });

  return render(
    <Provider store={createAppStore()}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={createAuthClient()}>
          <ApiProvider client={client}>
            <MemoryRouter initialEntries={[`/app/projects/${initialProjectId}`]}>
              <Routes>
                <Route element={<NavigationHarness />}>
                  <Route path="/app/projects/:projectId" element={<ProjectViewerPage />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </ApiProvider>
        </AuthProvider>
      </QueryClientProvider>
    </Provider>
  );
}

function NavigationHarness() {
  const [content, setContent] = useState<AppShellContent>(defaultAppShellContent);
  const controller = useMemo(
    () => ({
      setContent,
      resetContent: () => setContent(defaultAppShellContent)
    }),
    []
  );

  return (
    <AppShellContentContext.Provider value={controller}>
      <Link to="/app/projects/project-two">Open project two</Link>
      <aside aria-label="Test inspector">{content.inspector}</aside>
      <Outlet />
    </AppShellContentContext.Provider>
  );
}

function successFetch(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    return Response.json(
      url.endsWith("/geometry")
        ? geometryResponse
        : {
            project: demoProjectFixture,
            sourceRevision: demoProjectFixture.revision
          }
    );
  }) as typeof fetch;
}

function problemFetch(status: number): typeof fetch {
  const title = status === 403 ? "Forbidden" : "Not found";
  return vi.fn().mockResolvedValue(
    Response.json(
      {
        type: `/problems/${title.toLowerCase().replace(" ", "-")}`,
        title,
        status,
        detail: `${title} detail`,
        code: status === 403 ? "PROJECT_ACCESS_FORBIDDEN" : "PROJECT_NOT_FOUND"
      },
      { status }
    )
  ) as typeof fetch;
}

describe("ProjectViewerPage", () => {
  it("renders the explicit loading state", async () => {
    const pendingFetch = vi.fn(() => new Promise<Response>(() => undefined)) as typeof fetch;

    renderConnectedRoute(createApiClient(pendingFetch));

    expect(await screen.findByText("Loading Project and Geometry data…")).toBeTruthy();
  });

  it("renders authoritative Project geometry on success", async () => {
    renderConnectedRoute(createApiClient(successFetch()));

    expect(await screen.findByRole("heading", { name: demoProjectFixture.name })).toBeTruthy();
    expect(screen.getByText(`Revision ${demoProjectFixture.revision}`)).toBeTruthy();
    expect(screen.getByRole("img", { name: /interactive 2d geometry viewer/i })).toBeTruthy();
    expect(screen.getAllByTestId("geometry-polygon")).toHaveLength(1);
    expect(screen.getByText("Reduced project view")).toBeTruthy();
  });

  it("switches authoritative geometry levels from the level selector", async () => {
    const firstLevel = geometryResponse.geometry.levels[0]!;
    const multiLevelGeometry = {
      ...geometryResponse,
      geometry: {
        ...geometryResponse.geometry,
        levels: [
          firstLevel,
          {
            ...firstLevel,
            id: "geometry-level-upper",
            sourceLevelId: "level-upper",
            elevation: 300
          }
        ]
      }
    };
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) =>
      Response.json(
        String(input).endsWith("/geometry")
          ? multiLevelGeometry
          : { project: demoProjectFixture, sourceRevision: demoProjectFixture.revision }
      )
    ) as typeof fetch;

    renderConnectedRoute(createApiClient(fetchImplementation));

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "Level" }));
    fireEvent.click(screen.getByRole("option", { name: "level-upper" }));

    expect(await screen.findByText("level-upper", { selector: ".MuiSelect-select" })).toBeTruthy();
  });

  it("does not invoke GeometryEngine.build for authoritative route data", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");

    renderConnectedRoute(createApiClient(successFetch()));

    expect(await screen.findByTestId("geometry-polygon")).toBeTruthy();
    expect(buildSpy).not.toHaveBeenCalled();
  });

  it("does not import the local Geometry Playground fixture in the production route", () => {
    const source = readFileSync("src/pages/ProjectViewerPage.tsx", "utf8");

    expect(source).not.toContain("geometry-playground-fixture");
    expect(source).not.toContain("GeometryEngine");
  });

  it("blocks rendering when the Geometry source Project ID does not agree", async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) =>
      Response.json(
        String(input).endsWith("/geometry")
          ? { ...geometryResponse, sourceProjectId: "another-project" }
          : {
              project: demoProjectFixture,
              sourceRevision: demoProjectFixture.revision
            }
      )
    ) as typeof fetch;

    renderConnectedRoute(createApiClient(fetchImplementation));

    expect(
      await screen.findByRole("heading", { name: "Project geometry is inconsistent" })
    ).toBeTruthy();
    expect(screen.getByText(/belongs to a different Project/)).toBeTruthy();
    expect(screen.queryByTestId("geometry-polygon")).toBeNull();
  });

  it("blocks rendering when Project and Geometry revisions do not agree", async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) =>
      Response.json(
        String(input).endsWith("/geometry")
          ? { ...geometryResponse, sourceRevision: geometryResponse.sourceRevision + 1 }
          : {
              project: demoProjectFixture,
              sourceRevision: demoProjectFixture.revision
            }
      )
    ) as typeof fetch;

    renderConnectedRoute(createApiClient(fetchImplementation));

    expect(
      await screen.findByRole("heading", { name: "Project geometry is inconsistent" })
    ).toBeTruthy();
    expect(screen.getByText(/refer to different revisions/)).toBeTruthy();
    expect(screen.queryByTestId("geometry-polygon")).toBeNull();
  });

  it("keeps selection, hover, and inspector state on the local interaction boundary", async () => {
    renderConnectedRoute(createApiClient(successFetch()));
    const polygon = await screen.findByTestId("geometry-polygon");

    fireEvent.mouseEnter(polygon);
    expect(polygon.getAttribute("class")).toContain("geometry-entity-hovered");

    fireEvent.click(polygon);
    expect(polygon.getAttribute("class")).toContain("geometry-entity-selected");
    expect(screen.getByRole("complementary", { name: "Test inspector" }).textContent).toContain(
      "room-one"
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(polygon.getAttribute("class")).not.toContain("geometry-entity-selected");
  });

  it("fits and resets the authoritative viewport from keyboard shortcuts", async () => {
    renderConnectedRoute(createApiClient(successFetch()));
    const polygon = await screen.findByTestId("geometry-polygon");
    const fittedPoints = polygon.getAttribute("points");

    fireEvent.keyDown(window, { key: "r" });
    expect(polygon.getAttribute("points")).not.toBe(fittedPoints);

    fireEvent.keyDown(window, { key: "f" });
    expect(polygon.getAttribute("points")).toBe(fittedPoints);
  });

  it("fits and resets the authoritative viewport from canvas controls", async () => {
    renderConnectedRoute(createApiClient(successFetch()));
    const polygon = await screen.findByTestId("geometry-polygon");
    const fittedPoints = polygon.getAttribute("points");

    fireEvent.click(screen.getByRole("button", { name: "Reset viewport" }));
    expect(polygon.getAttribute("points")).not.toBe(fittedPoints);

    fireEvent.click(screen.getByRole("button", { name: "Fit to view" }));
    expect(polygon.getAttribute("points")).toBe(fittedPoints);
  });

  it("renders a dedicated 403 state", async () => {
    renderConnectedRoute(createApiClient(problemFetch(403)));

    expect(await screen.findByRole("heading", { name: "Project access forbidden" })).toBeTruthy();
  });

  it("renders authentication unavailable when the token boundary has no session", async () => {
    const client = new CasaStudioApiClient({
      baseUrl: "http://localhost:3000",
      getAccessToken: vi.fn().mockResolvedValue(null),
      fetchImplementation: vi.fn()
    });

    renderConnectedRoute(client);

    expect(await screen.findByRole("heading", { name: "Authentication unavailable" })).toBeTruthy();
  });

  it("renders a dedicated 404 state", async () => {
    renderConnectedRoute(createApiClient(problemFetch(404)));

    expect(await screen.findByRole("heading", { name: "Project not found" })).toBeTruthy();
  });

  it("renders a meaningful generic API Problem Details failure", async () => {
    const client = createApiClient(
      vi.fn().mockResolvedValue(
        Response.json(
          {
            type: "/problems/project-read-failed",
            title: "Project read failed",
            status: 500,
            detail: "The Project could not be read.",
            code: "PROJECT_READ_FAILED",
            requestId: "request-safe-id"
          },
          { status: 500 }
        )
      ) as typeof fetch
    );

    renderConnectedRoute(client);

    expect(await screen.findByRole("heading", { name: "Project read failed" })).toBeTruthy();
    expect(screen.getByText("The Project could not be read.")).toBeTruthy();
    expect(screen.getByText("Request ID: request-safe-id")).toBeTruthy();
  });

  it("renders a dedicated network failure without technical details", async () => {
    renderConnectedRoute(
      createApiClient(vi.fn().mockRejectedValue(new TypeError("connection refused")) as typeof fetch)
    );

    expect(await screen.findByRole("heading", { name: "API unavailable" })).toBeTruthy();
    expect(screen.queryByText("connection refused")).toBeNull();
  });

  it("renders an invalid API response as a safe Project data failure", async () => {
    const invalidGeometry = {
      ...geometryResponse,
      geometry: {
        ...geometryResponse.geometry,
        levels: [{ ...geometryResponse.geometry.levels[0], polygons: [{ id: "invalid" }] }]
      }
    };
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) =>
      Response.json(
        String(input).endsWith("/geometry")
          ? invalidGeometry
          : {
              project: demoProjectFixture,
              sourceRevision: demoProjectFixture.revision
            }
      )
    ) as typeof fetch;

    renderConnectedRoute(createApiClient(fetchImplementation));

    expect(await screen.findByRole("heading", { name: "Project data unavailable" })).toBeTruthy();
    expect(screen.queryByTestId("geometry-polygon")).toBeNull();
  });

  it("clears selection when the active Project route changes", async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const projectId = url.includes("project-two") ? "project-two" : demoProjectFixture.id;
      const project = {
        ...demoProjectFixture,
        id: projectId,
        name: projectId === "project-two" ? "Project Two" : demoProjectFixture.name
      };

      return Response.json(
        url.endsWith("/geometry")
          ? createGeometrySnapshotFixture(projectId, project.revision)
          : { project, sourceRevision: project.revision }
      );
    }) as typeof fetch;

    renderConnectedRoute(createApiClient(fetchImplementation));
    const firstPolygon = await screen.findByTestId("geometry-polygon");
    fireEvent.click(firstPolygon);
    expect(firstPolygon.getAttribute("class")).toContain("geometry-entity-selected");

    fireEvent.click(screen.getByRole("link", { name: "Open project two" }));
    expect(await screen.findByRole("heading", { name: "Project Two" })).toBeTruthy();
    expect((await screen.findByTestId("geometry-polygon")).getAttribute("class")).not.toContain(
      "geometry-entity-selected"
    );
  });

  it("keeps late data from an old project ID out of the new route", async () => {
    let resolveFirstProject: ((response: Response) => void) | undefined;
    const fetchImplementation = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes(`/${demoProjectFixture.id}`) && !url.endsWith("/geometry")) {
        return new Promise<Response>((resolve) => {
          resolveFirstProject = resolve;
        });
      }

      const projectId = url.includes("project-two") ? "project-two" : demoProjectFixture.id;
      const project = { ...demoProjectFixture, id: projectId, name: projectId === "project-two" ? "Project Two" : demoProjectFixture.name };

      return Promise.resolve(
        Response.json(
          url.endsWith("/geometry")
            ? { ...geometryResponse, sourceProjectId: projectId }
            : { project, sourceRevision: project.revision }
        )
      );
    }) as typeof fetch;

    renderConnectedRoute(createApiClient(fetchImplementation));
    fireEvent.click(await screen.findByRole("link", { name: "Open project two" }));

    expect(await screen.findByRole("heading", { name: "Project Two" })).toBeTruthy();

    await act(async () => {
      resolveFirstProject?.(
        Response.json({
          project: demoProjectFixture,
          sourceRevision: demoProjectFixture.revision
        })
      );
    });

    expect(screen.getByRole("heading", { name: "Project Two" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: demoProjectFixture.name })).toBeNull();
  });
});
