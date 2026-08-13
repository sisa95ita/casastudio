import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { GeometryEngine } from "@casastudio/geometry";
import { QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { useMemo, useState } from "react";
import {
  createMemoryRouter,
  Link,
  Outlet,
  RouterProvider
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import {
  editingDraftReplaced,
  editingSessionMarkedDirty
} from "../state/project-editor-slice";
import { demoProjectFixture } from "../test/demo-project-fixture";
import { createGeometrySnapshotFixture } from "../test/geometry-snapshot-fixture";
import { ProjectViewerPage } from "./ProjectViewerPage";

beforeEach(() => setViewportWidth(1440));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const geometryResponse = createGeometrySnapshotFixture(
  demoProjectFixture.id,
  demoProjectFixture.revision
);

function setViewportWidth(width: number) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => {
      const minimum = /min-width:\s*([\d.]+)px/.exec(query)?.[1];
      const maximum = /max-width:\s*([\d.]+)px/.exec(query)?.[1];
      const matches =
        (minimum === undefined || width >= Number(minimum)) &&
        (maximum === undefined || width <= Number(maximum));

      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      } satisfies MediaQueryList;
    })
  );
}

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

function renderConnectedRoute(
  client: CasaStudioApiClient,
  initialProjectId = demoProjectFixture.id
) {
  const queryClient = createAppQueryClient();
  const store = createAppStore();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const router = createMemoryRouter(
    [
      {
        element: <NavigationHarness />,
        children: [
          { path: "/app/projects/:projectId", element: <ProjectViewerPage /> }
        ]
      }
    ],
    { initialEntries: [`/app/projects/${initialProjectId}`] }
  );

  const result = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={createAuthClient()}>
          <ApiProvider client={client}>
            <RouterProvider router={router} />
          </ApiProvider>
        </AuthProvider>
      </QueryClientProvider>
    </Provider>
  );

  return { ...result, store, router };
}

function NavigationHarness() {
  const [content, setContent] = useState<AppShellContent>(
    defaultAppShellContent
  );
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
      <header aria-label="Test header">{content.headerAccessory}</header>
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
    const pendingFetch = vi.fn(
      () => new Promise<Response>(() => undefined)
    ) as typeof fetch;

    renderConnectedRoute(createApiClient(pendingFetch));

    expect(
      await screen.findByText("Loading Project and Geometry data…")
    ).toBeTruthy();
  });

  it("renders authoritative Project geometry on success", async () => {
    renderConnectedRoute(createApiClient(successFetch()));

    expect(
      await screen.findByRole("heading", { name: demoProjectFixture.name })
    ).toBeTruthy();
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: /interactive 2d geometry viewer/i })
    ).toBeTruthy();
    expect(screen.getAllByTestId("geometry-polygon")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "View" }).getAttribute("aria-pressed")
    ).toBe("true");
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
          : {
              project: demoProjectFixture,
              sourceRevision: demoProjectFixture.revision
            }
      )
    ) as typeof fetch;

    renderConnectedRoute(createApiClient(fetchImplementation));

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "Level" }));
    fireEvent.click(screen.getByRole("option", { name: "level-upper" }));

    expect(
      await screen.findByText("level-upper", { selector: ".MuiSelect-select" })
    ).toBeTruthy();
  });

  it("does not invoke GeometryEngine.build for authoritative route data", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");

    renderConnectedRoute(createApiClient(successFetch()));

    expect(await screen.findByTestId("geometry-polygon")).toBeTruthy();
    expect(buildSpy).not.toHaveBeenCalled();
  });

  it("enters Edit through the Redux draft and runtime Geometry Engine pipeline", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");
    const { store } = renderConnectedRoute(createApiClient(successFetch()));

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(
      await screen.findByRole("toolbar", { name: "Editing tools" })
    ).toBeTruthy();
    expect(buildSpy).toHaveBeenCalledWith(store.getState().projectEditor.draft);
    expect(store.getState().projectEditor.draft).not.toBe(demoProjectFixture);
    expect(screen.getAllByText("Editing").length).toBeGreaterThan(0);
  });

  it("toggles enabled editor tools through a neutral active state", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    const select = screen.getByRole("button", { name: "Select" });
    const pan = screen.getByRole("button", { name: "Pan" });
    const drawWall = screen.getByRole("button", {
      name: "Draw Wall — coming soon"
    });

    expect(store.getState().projectEditor.activeTool).toBeNull();
    expect(select.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(select);
    expect(store.getState().projectEditor.activeTool).toBe("select");
    expect(select.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(select);
    expect(store.getState().projectEditor.activeTool).toBeNull();
    expect(select.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(pan);
    expect(store.getState().projectEditor.activeTool).toBe("pan");
    expect(pan.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(pan);
    expect(store.getState().projectEditor.activeTool).toBeNull();
    expect(pan.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(drawWall);
    expect(drawWall.hasAttribute("disabled")).toBe(true);
    expect(store.getState().projectEditor.activeTool).toBeNull();
  });

  it("describes editor tool outcomes with accessible tooltips", async () => {
    renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    const select = screen.getByRole("button", { name: "Select" });
    fireEvent.mouseOver(select);
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Select elements in the plan."
    );
    fireEvent.mouseLeave(select);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());

    const drawWall = screen.getByRole("button", {
      name: "Draw Wall — coming soon"
    });
    fireEvent.mouseOver(drawWall.parentElement!);
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Draw walls by placing start and end points. Not available yet."
    );
  });

  it("renders Edit geometry from the draft instead of a stale authoritative snapshot", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(
      (await screen.findAllByTestId("geometry-polygon")).length
    ).toBeGreaterThan(0);

    const draft = store.getState().projectEditor.draft!;
    const emptyDraft = {
      ...draft,
      building: {
        ...draft.building,
        levels: draft.building.levels.map((level) => ({
          ...level,
          rooms: [],
          walls: [],
          staircases: []
        }))
      }
    };
    act(() => store.dispatch(editingDraftReplaced(emptyDraft)));

    await waitFor(() =>
      expect(screen.queryByTestId("geometry-polygon")).toBeNull()
    );
    expect(
      screen.getByText("No runtime geometry to display for this level.")
    ).toBeTruthy();
  });

  it("does not rebuild draft geometry for selection-only changes", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");
    renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await screen.findAllByTestId("geometry-polygon");
    const buildCount = buildSpy.mock.calls.length;

    fireEvent.click(screen.getAllByTestId("geometry-polygon")[0]!);

    expect(buildSpy).toHaveBeenCalledTimes(buildCount);
  });

  it("preserves the local draft when edit geometry cannot be built", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const draft = store.getState().projectEditor.draft!;
    const firstLevel = draft.building.levels[0]!;
    const firstWall = firstLevel.walls[0]!;
    const invalidDraft = {
      ...draft,
      building: {
        ...draft.building,
        levels: [
          {
            ...firstLevel,
            walls: [
              { ...firstWall, end: { ...firstWall.start } },
              ...firstLevel.walls.slice(1)
            ]
          },
          ...draft.building.levels.slice(1)
        ]
      }
    };

    act(() => store.dispatch(editingDraftReplaced(invalidDraft)));

    expect(
      await screen.findByRole("heading", {
        name: "The local draft cannot be displayed"
      })
    ).toBeTruthy();
    expect(store.getState().projectEditor.draft).toEqual(invalidDraft);
    expect(store.getState().projectEditor.dirty).toBe(true);
  });

  it("returns clean Edit sessions to View and keeps future controls disabled", async () => {
    renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(
      (
        await screen.findByRole("button", { name: "Draw Wall — coming soon" })
      ).hasAttribute("disabled")
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Undo — coming soon" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Redo — coming soon" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(screen.queryByText(/AI Assistant/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(screen.queryByRole("toolbar", { name: "Editing tools" })).toBeNull();
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("does not silently discard a dirty session when returning to View", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "draft remains intact"
    );
    expect(store.getState().projectEditor.mode).toBe("edit");
    expect(store.getState().projectEditor.dirty).toBe(true);
  });

  it("blocks in-app navigation while the editing session is dirty", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));

    fireEvent.click(screen.getByRole("link", { name: "Open project two" }));

    expect(await screen.findByText(/Navigation is blocked/)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: demoProjectFixture.name })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() =>
      expect(screen.queryByText(/Navigation is blocked/)).toBeNull()
    );
  });

  it("protects browser unload only while a matching session is dirty", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    const cleanEvent = new Event("beforeunload", { cancelable: true });
    expect(window.dispatchEvent(cleanEvent)).toBe(true);

    act(() => store.dispatch(editingSessionMarkedDirty()));
    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    expect(window.dispatchEvent(dirtyEvent)).toBe(false);
    expect(dirtyEvent.defaultPrevented).toBe(true);
  });

  it("keeps editing available on tablet and places the inspector below the canvas", async () => {
    setViewportWidth(900);
    renderConnectedRoute(createApiClient(successFetch()));

    expect(await screen.findByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Shortcuts" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      await screen.findByRole("tablist", { name: "Project inspector sections" })
    ).toBeTruthy();
  });

  it("keeps phone Projects read-only while preserving geometry access", async () => {
    setViewportWidth(390);
    renderConnectedRoute(createApiClient(successFetch()));

    expect(
      await screen.findByRole("img", {
        name: /interactive 2d geometry viewer/i
      })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Shortcuts" })).toBeNull();
    expect(
      screen.getByText("Advanced editing is available on larger screens.")
    ).toBeTruthy();
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
      await screen.findByRole("heading", {
        name: "Project geometry is inconsistent"
      })
    ).toBeTruthy();
    expect(screen.getByText(/belongs to a different Project/)).toBeTruthy();
    expect(screen.queryByTestId("geometry-polygon")).toBeNull();
  });

  it("blocks rendering when Project and Geometry revisions do not agree", async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) =>
      Response.json(
        String(input).endsWith("/geometry")
          ? {
              ...geometryResponse,
              sourceRevision: geometryResponse.sourceRevision + 1
            }
          : {
              project: demoProjectFixture,
              sourceRevision: demoProjectFixture.revision
            }
      )
    ) as typeof fetch;

    renderConnectedRoute(createApiClient(fetchImplementation));

    expect(
      await screen.findByRole("heading", {
        name: "Project geometry is inconsistent"
      })
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
    fireEvent.click(screen.getByRole("tab", { name: "Selection" }));
    expect(
      screen.getByRole("complementary", { name: "Test inspector" }).textContent
    ).toContain("room-one");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(polygon.getAttribute("class")).not.toContain(
      "geometry-entity-selected"
    );
  });

  it("deselects geometry when the selected entity is clicked again", async () => {
    renderConnectedRoute(createApiClient(successFetch()));
    const polygon = await screen.findByTestId("geometry-polygon");

    fireEvent.click(polygon);
    expect(polygon.getAttribute("class")).toContain("geometry-entity-selected");

    fireEvent.click(polygon);
    expect(polygon.getAttribute("class")).not.toContain(
      "geometry-entity-selected"
    );
  });

  it("moves supported shortcuts out of Properties and into workspace help", async () => {
    renderConnectedRoute(createApiClient(successFetch()));
    const polygon = await screen.findByTestId("geometry-polygon");
    const inspector = screen.getByRole("complementary", {
      name: "Test inspector"
    });

    fireEvent.click(within(inspector).getByRole("tab", { name: "Properties" }));
    expect(within(inspector).queryByText("Shortcuts")).toBeNull();

    fireEvent.click(polygon);
    fireEvent.click(screen.getByRole("button", { name: "Shortcuts" }));

    const dialog = await screen.findByRole("dialog", { name: "Shortcuts" });
    expect(within(dialog).getByText("Clear selection")).toBeTruthy();
    expect(within(dialog).getByText("Escape")).toBeTruthy();
    expect(within(dialog).getByText("Fit viewport")).toBeTruthy();
    expect(within(dialog).getByText("F")).toBeTruthy();
    expect(within(dialog).getByText("Reset viewport")).toBeTruthy();
    expect(within(dialog).getByText("R")).toBeTruthy();
    expect(
      within(dialog).queryByText(/Delete|Backspace|Draw Wall|Zoom/i)
    ).toBeNull();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Shortcuts" })).toBeNull()
    );
    expect(polygon.getAttribute("class")).toContain("geometry-entity-selected");
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

    expect(
      await screen.findByRole("heading", { name: "Project access forbidden" })
    ).toBeTruthy();
  });

  it("renders authentication unavailable when the token boundary has no session", async () => {
    const client = new CasaStudioApiClient({
      baseUrl: "http://localhost:3000",
      getAccessToken: vi.fn().mockResolvedValue(null),
      fetchImplementation: vi.fn()
    });

    renderConnectedRoute(client);

    expect(
      await screen.findByRole("heading", { name: "Authentication unavailable" })
    ).toBeTruthy();
  });

  it("renders a dedicated 404 state", async () => {
    renderConnectedRoute(createApiClient(problemFetch(404)));

    expect(
      await screen.findByRole("heading", { name: "Project not found" })
    ).toBeTruthy();
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

    expect(
      await screen.findByRole("heading", { name: "Project read failed" })
    ).toBeTruthy();
    expect(screen.getByText("The Project could not be read.")).toBeTruthy();
    expect(screen.getByText("Request ID: request-safe-id")).toBeTruthy();
  });

  it("renders a dedicated network failure without technical details", async () => {
    renderConnectedRoute(
      createApiClient(
        vi
          .fn()
          .mockRejectedValue(
            new TypeError("connection refused")
          ) as typeof fetch
      )
    );

    expect(
      await screen.findByRole("heading", { name: "API unavailable" })
    ).toBeTruthy();
    expect(screen.queryByText("connection refused")).toBeNull();
  });

  it("renders an invalid API response as a safe Project data failure", async () => {
    const invalidGeometry = {
      ...geometryResponse,
      geometry: {
        ...geometryResponse.geometry,
        levels: [
          {
            ...geometryResponse.geometry.levels[0],
            polygons: [{ id: "invalid" }]
          }
        ]
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

    expect(
      await screen.findByRole("heading", { name: "Project data unavailable" })
    ).toBeTruthy();
    expect(screen.queryByTestId("geometry-polygon")).toBeNull();
  });

  it("clears selection when the active Project route changes", async () => {
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const projectId = url.includes("project-two")
        ? "project-two"
        : demoProjectFixture.id;
      const project = {
        ...demoProjectFixture,
        id: projectId,
        name:
          projectId === "project-two" ? "Project Two" : demoProjectFixture.name
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
    expect(firstPolygon.getAttribute("class")).toContain(
      "geometry-entity-selected"
    );

    fireEvent.click(screen.getByRole("link", { name: "Open project two" }));
    expect(
      await screen.findByRole("heading", { name: "Project Two" })
    ).toBeTruthy();
    expect(
      (await screen.findByTestId("geometry-polygon")).getAttribute("class")
    ).not.toContain("geometry-entity-selected");
  });

  it("keeps late data from an old project ID out of the new route", async () => {
    let resolveFirstProject: ((response: Response) => void) | undefined;
    const fetchImplementation = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (
        url.includes(`/${demoProjectFixture.id}`) &&
        !url.endsWith("/geometry")
      ) {
        return new Promise<Response>((resolve) => {
          resolveFirstProject = resolve;
        });
      }

      const projectId = url.includes("project-two")
        ? "project-two"
        : demoProjectFixture.id;
      const project = {
        ...demoProjectFixture,
        id: projectId,
        name:
          projectId === "project-two" ? "Project Two" : demoProjectFixture.name
      };

      return Promise.resolve(
        Response.json(
          url.endsWith("/geometry")
            ? { ...geometryResponse, sourceProjectId: projectId }
            : { project, sourceRevision: project.revision }
        )
      );
    }) as typeof fetch;

    renderConnectedRoute(createApiClient(fetchImplementation));
    fireEvent.click(
      await screen.findByRole("link", { name: "Open project two" })
    );

    expect(
      await screen.findByRole("heading", { name: "Project Two" })
    ).toBeTruthy();

    await act(async () => {
      resolveFirstProject?.(
        Response.json({
          project: demoProjectFixture,
          sourceRevision: demoProjectFixture.revision
        })
      );
    });

    expect(screen.getByRole("heading", { name: "Project Two" })).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: demoProjectFixture.name })
    ).toBeNull();
  });
});
