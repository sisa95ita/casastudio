import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { Link, MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiProvider } from "../api/ApiProvider";
import { CasaStudioApiClient } from "../api/CasaStudioApiClient";
import { AuthProvider } from "../auth/AuthProvider";
import type { AuthClient } from "../auth/auth-client";
import { geometryPlaygroundProject } from "../geometry-playground/geometry-playground-fixture";
import { createAppQueryClient } from "../queries/query-client";
import { createAppStore } from "../state/store";
import { ConnectedProjectPage } from "./ConnectedProjectPage";

afterEach(() => cleanup());

const geometryResponse = {
  sourceProjectId: geometryPlaygroundProject.id,
  sourceRevision: geometryPlaygroundProject.revision,
  geometry: {
    id: "geometry-demo",
    units: { length: "cm", angle: "deg" },
    levels: [
      {
        id: "geometry-level-ground",
        sourceLevelId: geometryPlaygroundProject.building.levels[0]?.id ?? "level-ground",
        elevation: 0,
        vertices: [],
        boundaryEdges: [{ id: "wall-one" }, { id: "wall-two" }],
        boundaryEdgeUses: [],
        loops: [],
        polygons: [{ id: "room-one" }]
      }
    ]
  }
};

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

function renderConnectedRoute(client: CasaStudioApiClient, initialProjectId = geometryPlaygroundProject.id) {
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
                  <Route path="/app/projects/:projectId" element={<ConnectedProjectPage />} />
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
  return (
    <>
      <Link to="/app/projects/project-two">Open project two</Link>
      <Outlet />
    </>
  );
}

function successFetch(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    return Response.json(
      url.endsWith("/geometry")
        ? geometryResponse
        : {
            project: geometryPlaygroundProject,
            sourceRevision: geometryPlaygroundProject.revision
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

describe("ConnectedProjectPage", () => {
  it("renders the explicit loading state", async () => {
    const pendingFetch = vi.fn(() => new Promise<Response>(() => undefined)) as typeof fetch;

    renderConnectedRoute(createApiClient(pendingFetch));

    expect(await screen.findByText("Loading Project and Geometry data…")).toBeTruthy();
  });

  it("renders Project identity, revisions, and geometry counts on success", async () => {
    renderConnectedRoute(createApiClient(successFetch()));

    expect(await screen.findByRole("heading", { name: geometryPlaygroundProject.name })).toBeTruthy();
    expect(screen.getByText("Project and Geometry responses refer to the same authoritative revision.")).toBeTruthy();
    expect(screen.getByText("Room polygons").parentElement?.textContent).toContain("1");
    expect(screen.getByText("Boundary walls").parentElement?.textContent).toContain("2");
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

  it("keeps late data from an old project ID out of the new route", async () => {
    let resolveFirstProject: ((response: Response) => void) | undefined;
    const fetchImplementation = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes(`/${geometryPlaygroundProject.id}`) && !url.endsWith("/geometry")) {
        return new Promise<Response>((resolve) => {
          resolveFirstProject = resolve;
        });
      }

      const projectId = url.includes("project-two") ? "project-two" : geometryPlaygroundProject.id;
      const project = { ...geometryPlaygroundProject, id: projectId, name: projectId === "project-two" ? "Project Two" : geometryPlaygroundProject.name };

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
          project: geometryPlaygroundProject,
          sourceRevision: geometryPlaygroundProject.revision
        })
      );
    });

    expect(screen.getByRole("heading", { name: "Project Two" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: geometryPlaygroundProject.name })).toBeNull();
  });
});
