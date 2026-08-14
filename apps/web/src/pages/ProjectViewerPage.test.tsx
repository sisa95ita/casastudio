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

function prepareSvgPointerCoordinates(svg: SVGSVGElement) {
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 520,
    width: 800,
    height: 520,
    toJSON: () => ({})
  });
  Object.defineProperties(svg, {
    setPointerCapture: { configurable: true, value: vi.fn() },
    releasePointerCapture: { configurable: true, value: vi.fn() },
    hasPointerCapture: { configurable: true, value: vi.fn(() => true) }
  });
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
    const drawWall = screen.getByRole("button", { name: "Draw Wall" });

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
    expect(drawWall.hasAttribute("disabled")).toBe(false);
    expect(store.getState().projectEditor.activeTool).toBe("draw-wall");

    fireEvent.click(drawWall);
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

    const drawWall = screen.getByRole("button", { name: "Draw Wall" });
    fireEvent.mouseOver(drawWall);
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Draw walls by choosing a start and end point."
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

  it("keeps Draw Wall pointer previews out of the draft and Geometry Engine", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const draft = store.getState().projectEditor.draft;
    const buildCount = buildSpy.mock.calls.length;

    fireEvent.click(svg, { clientX: 100, clientY: 350 });
    fireEvent.pointerMove(svg, {
      clientX: 160,
      clientY: 300,
      pointerId: 1
    });
    fireEvent.pointerMove(svg, {
      clientX: 180,
      clientY: 280,
      pointerId: 1
    });

    expect(screen.getByTestId("draw-wall-preview")).toBeTruthy();
    expect(store.getState().projectEditor.draft).toBe(draft);
    expect(store.getState().projectEditor.dirty).toBe(false);
    expect(buildSpy).toHaveBeenCalledTimes(buildCount);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("draw-wall-preview")).toBeNull();
    expect(store.getState().projectEditor.activeTool).toBe("draw-wall");
    expect(store.getState().projectEditor.draft).toBe(draft);
  });

  it("commits a new stable Wall once and leaves Draw Wall active", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");
    const authoritative = structuredClone(demoProjectFixture);
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const originalWallCount =
      store.getState().projectEditor.draft!.building.levels[0]!.walls.length;
    const buildCount = buildSpy.mock.calls.length;

    fireEvent.click(svg, { clientX: 100, clientY: 350 });
    fireEvent.pointerMove(svg, {
      clientX: 220,
      clientY: 300,
      pointerId: 1
    });
    expect(buildSpy).toHaveBeenCalledTimes(buildCount);
    fireEvent.click(svg, { clientX: 220, clientY: 300 });

    await waitFor(() =>
      expect(
        store.getState().projectEditor.draft!.building.levels[0]!.walls
      ).toHaveLength(originalWallCount + 1)
    );
    const state = store.getState().projectEditor;
    const wall = state.draft!.building.levels[0]!.walls.at(-1)!;
    expect(wall.id).toMatch(/^wall-[a-z0-9-]+$/);
    expect(wall.start.x).toBeCloseTo(66.67, 1);
    expect(wall.start.z).toBeCloseTo(50, 1);
    expect(wall.end.x).toBeCloseTo(200, 1);
    expect(wall.end.z).toBeCloseTo(105.56, 1);
    expect(state.activeTool).toBe("draw-wall");
    expect(state.transient.interaction).toBeNull();
    expect(state.dirty).toBe(true);
    expect(buildSpy).toHaveBeenCalledTimes(buildCount + 1);
    expect(state.draft).toMatchObject({
      id: authoritative.id,
      revision: authoritative.revision,
      createdAt: authoritative.createdAt,
      updatedAt: authoritative.updatedAt
    });
    expect(authoritative).toEqual(demoProjectFixture);
    expect(document.querySelectorAll(".geometry-edge-hit-target")).toHaveLength(
      originalWallCount + 1
    );
  });

  it("rejects a zero-length Wall without dirtying the draft", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const draft = store.getState().projectEditor.draft;

    fireEvent.click(svg, { clientX: 120, clientY: 320 });
    fireEvent.click(svg, { clientX: 120, clientY: 320 });

    expect(
      await screen.findByText("Wall cannot have zero length.")
    ).toBeTruthy();
    expect(store.getState().projectEditor.draft).toBe(draft);
    expect(store.getState().projectEditor.dirty).toBe(false);
    expect(store.getState().projectEditor.transient.interaction).toBeNull();
  });

  it("selects a Wall, previews one endpoint, commits once, and deletes it", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    fireEvent.click(svg, { clientX: 100, clientY: 350 });
    fireEvent.click(svg, { clientX: 220, clientY: 300 });
    await waitFor(() =>
      expect(
        document.querySelectorAll(".geometry-edge-hit-target")
      ).toHaveLength(8)
    );
    const newWall = store
      .getState()
      .projectEditor.draft!.building.levels[0]!.walls.at(-1)!;

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    const hitTargets = document.querySelectorAll(".geometry-edge-hit-target");
    fireEvent.click(hitTargets[hitTargets.length - 1]!);
    expect(screen.getByTestId("selected-wall-overlay")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start endpoint" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "End endpoint" })).toBeTruthy();

    const buildCount = buildSpy.mock.calls.length;
    const startBefore = { ...newWall.start };
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Start endpoint" }),
      {
        clientX: 100,
        clientY: 350,
        pointerId: 9
      }
    );
    fireEvent.pointerMove(svg, {
      clientX: 130,
      clientY: 330,
      pointerId: 9
    });
    expect(
      screen
        .getByTestId("selected-wall-overlay")
        .querySelector(".geometry-selected-wall--dragging")
    ).toBeTruthy();
    expect(
      document.querySelectorAll(".geometry-edge--drag-source")
    ).toHaveLength(1);
    expect(
      store.getState().projectEditor.draft!.building.levels[0]!.walls.at(-1)!
        .start
    ).toEqual(startBefore);
    expect(buildSpy).toHaveBeenCalledTimes(buildCount);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(store.getState().projectEditor.transient.interaction).toBeNull();
    expect(
      store.getState().projectEditor.draft!.building.levels[0]!.walls.at(-1)!
        .start
    ).toEqual(startBefore);
    expect(buildSpy).toHaveBeenCalledTimes(buildCount);
    expect(
      document.querySelectorAll(".geometry-edge--drag-source")
    ).toHaveLength(0);

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Start endpoint" }),
      {
        clientX: 100,
        clientY: 350,
        pointerId: 9
      }
    );
    fireEvent.pointerMove(svg, {
      clientX: 130,
      clientY: 330,
      pointerId: 9
    });

    fireEvent.pointerUp(svg, {
      clientX: 140,
      clientY: 325,
      pointerId: 9
    });
    await waitFor(() =>
      expect(
        store.getState().projectEditor.draft!.building.levels[0]!.walls.at(-1)!
          .start
      ).not.toEqual(startBefore)
    );
    expect(buildSpy).toHaveBeenCalledTimes(buildCount + 1);
    expect(
      document.querySelectorAll(".geometry-edge--drag-source")
    ).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Start endpoint" })).toBeTruthy();

    const movedDraft = store.getState().projectEditor.draft;
    const startHandle = screen.getByRole("button", { name: "Start endpoint" });
    const endHandle = screen.getByRole("button", { name: "End endpoint" });
    fireEvent.pointerDown(endHandle, { pointerId: 10 });
    fireEvent.pointerUp(svg, {
      clientX: Number(startHandle.getAttribute("cx")),
      clientY: Number(startHandle.getAttribute("cy")),
      pointerId: 10
    });
    expect(
      await screen.findByText("Wall cannot have zero length.")
    ).toBeTruthy();
    expect(store.getState().projectEditor.draft).toBe(movedDraft);
    expect(buildSpy).toHaveBeenCalledTimes(buildCount + 1);
    expect(
      document.querySelectorAll(".geometry-edge--drag-source")
    ).toHaveLength(0);

    fireEvent.keyDown(window, { key: "Delete" });
    await waitFor(() =>
      expect(
        store
          .getState()
          .projectEditor.draft!.building.levels[0]!.walls.some(
            (wall) => wall.id === newWall.id
          )
      ).toBe(false)
    );
    expect(store.getState().projectEditor.selection).toEqual([]);
    expect(screen.queryByTestId("selected-wall-overlay")).toBeNull();
  });

  it("keeps referenced Walls and native text deletion safe", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    const wallCount =
      store.getState().projectEditor.draft!.building.levels[0]!.walls.length;
    fireEvent.click(document.querySelector(".geometry-edge-hit-target")!);
    const referencedDraft = store.getState().projectEditor.draft;
    const buildCount = buildSpy.mock.calls.length;
    fireEvent.click(screen.getByRole("tab", { name: "Selection" }));
    expect(screen.queryByRole("button", { name: "Start endpoint" })).toBeNull();
    expect(
      screen.getByText(/endpoints cannot be moved independently yet/i)
    ).toBeTruthy();
    expect(store.getState().projectEditor.draft).toBe(referencedDraft);
    expect(buildSpy).toHaveBeenCalledTimes(buildCount);

    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(
      store.getState().projectEditor.draft!.building.levels[0]!.walls
    ).toHaveLength(wallCount);
    input.remove();

    fireEvent.keyDown(window, { key: "Delete" });
    expect(
      await screen.findByText(
        "Cannot delete this wall because it belongs to a room."
      )
    ).toBeTruthy();
    expect(
      store.getState().projectEditor.draft!.building.levels[0]!.walls
    ).toHaveLength(wallCount);
    expect(store.getState().projectEditor.selection).toHaveLength(1);
  });

  it("shows runtime Vertex topology in the Edit selection inspector", async () => {
    renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getAllByTestId("geometry-vertex")[0]!);
    fireEvent.click(screen.getByRole("tab", { name: "Selection" }));

    expect(screen.getByText("Vertex")).toBeTruthy();
    expect(screen.getByText(/X: 0 cm · Z: 0 cm/)).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(
      screen.queryByText("Select a wall in the plan to inspect it.")
    ).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("clears selected geometry when entering Draw Wall or Pan", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    fireEvent.click(svg, { clientX: 100, clientY: 350 });
    fireEvent.click(svg, { clientX: 220, clientY: 300 });
    await waitFor(() =>
      expect(
        document.querySelectorAll(".geometry-edge-hit-target")
      ).toHaveLength(8)
    );
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(document.querySelectorAll(".geometry-edge-hit-target")[7]!);
    expect(screen.getByRole("button", { name: "Start endpoint" })).toBeTruthy();
    const buildCount = buildSpy.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    expect(store.getState().projectEditor.selection).toEqual([]);
    expect(screen.queryByTestId("selected-wall-overlay")).toBeNull();
    expect(screen.queryByRole("button", { name: "Start endpoint" })).toBeNull();
    expect(buildSpy).toHaveBeenCalledTimes(buildCount);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(document.querySelectorAll(".geometry-edge-hit-target")[7]!);
    expect(screen.getByRole("button", { name: "Start endpoint" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pan" }));
    expect(store.getState().projectEditor.selection).toEqual([]);
    expect(screen.queryByTestId("selected-wall-overlay")).toBeNull();
    expect(screen.queryByRole("button", { name: "Start endpoint" })).toBeNull();
    expect(buildSpy).toHaveBeenCalledTimes(buildCount);
  });

  it("commits Wall properties on blur and rejects invalid intermediary input", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(document.querySelector(".geometry-edge-hit-target")!);
    fireEvent.click(screen.getByRole("tab", { name: "Selection" }));
    const height = screen.getByRole("spinbutton", { name: "Height (cm)" });
    const wallId =
      store.getState().projectEditor.draft!.building.levels[0]!.walls[0]!.id;
    const originalDraft = store.getState().projectEditor.draft;
    const buildCount = buildSpy.mock.calls.length;

    fireEvent.change(height, { target: { value: "325" } });
    expect(store.getState().projectEditor.draft).toBe(originalDraft);
    expect(buildSpy).toHaveBeenCalledTimes(buildCount);
    fireEvent.blur(height);
    await waitFor(() =>
      expect(store.getState().projectEditor.draft).not.toBe(originalDraft)
    );
    expect(store.getState().projectEditor.dirty).toBe(true);
    expect(
      store
        .getState()
        .projectEditor.draft!.building.levels[0]!.walls.find(
          (wall) => wall.id === wallId
        )?.height
    ).toBe(325);
    expect(buildSpy).toHaveBeenCalledTimes(buildCount + 1);

    const validDraft = store.getState().projectEditor.draft;
    const thickness = screen.getByRole("spinbutton", {
      name: "Thickness (cm)"
    });
    fireEvent.change(thickness, { target: { value: "0" } });
    expect(store.getState().projectEditor.draft).toBe(validDraft);
    fireEvent.blur(thickness);
    expect(await screen.findByText("Invalid wall thickness.")).toBeTruthy();
    expect(store.getState().projectEditor.draft).toBe(validDraft);
    expect(thickness).toHaveProperty("value", "20");
    expect(buildSpy).toHaveBeenCalledTimes(buildCount + 1);
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
      (await screen.findByRole("button", { name: "Draw Wall" })).hasAttribute(
        "disabled"
      )
    ).toBe(false);
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
    expect(
      within(dialog).getByText("Cancel interaction / clear selection")
    ).toBeTruthy();
    expect(within(dialog).getByText("Escape")).toBeTruthy();
    expect(within(dialog).getByText("Fit viewport")).toBeTruthy();
    expect(within(dialog).getByText("F")).toBeTruthy();
    expect(within(dialog).getByText("Reset viewport")).toBeTruthy();
    expect(within(dialog).getByText("R")).toBeTruthy();
    expect(within(dialog).getByText("Delete selected wall")).toBeTruthy();
    expect(within(dialog).getByText("Delete / Backspace")).toBeTruthy();
    expect(within(dialog).queryByText(/Draw Wall|Zoom/i)).toBeNull();

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
