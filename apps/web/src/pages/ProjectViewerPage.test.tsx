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
import type { Project, Room, Wall } from "@casastudio/schema";
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
import { geometryKeys } from "../queries/geometry-queries";
import { projectKeys } from "../queries/project-queries";
import { createAppStore } from "../state/store";
import {
  editingDraftReplaced,
  editingSessionMarkedDirty
} from "../state/project-editor-slice";
import { createDraftWall } from "../state/project-wall-editing";
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
const savedProjectFixture = {
  ...demoProjectFixture,
  revision: demoProjectFixture.revision + 1,
  updatedAt: "2026-08-15T12:00:00.000Z"
};
const savedGeometryResponse = createGeometrySnapshotFixture(
  demoProjectFixture.id,
  savedProjectFixture.revision
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
          { path: "/app/projects/:projectId", element: <ProjectViewerPage /> },
          { path: "/destination", element: <div>Destination route</div> }
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

  return { ...result, store, router, queryClient };
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
      <Link to="/destination">Open destination</Link>
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

function createMultiWallSubdivisionProject(): Project {
  const project = structuredClone(demoProjectFixture);
  const room: Room = {
    id: "whole-room",
    name: "Whole Room",
    type: "OTHER",
    boundary: [
      "bottom", "right-lower", "right-upper", "top", "left-upper", "left-lower"
    ].map((wallId) => ({ wallId, direction: "FORWARD" as const }))
  };
  const wall = (
    id: string,
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    assigned = true
  ): Wall => ({
    id,
    start: { x: startX, z: startZ },
    end: { x: endX, z: endZ },
    height: 280,
    thickness: 18,
    roomIds: assigned ? [room.id] : [],
    openings: []
  });
  project.building.levels = [{
    ...project.building.levels[0]!,
    id: "ground-floor",
    rooms: [room],
    walls: [
      wall("bottom", 0, 0, 100, 0),
      wall("right-lower", 100, 0, 100, 70),
      wall("right-upper", 100, 70, 100, 100),
      wall("top", 100, 100, 0, 100),
      wall("left-upper", 0, 100, 0, 50),
      wall("left-lower", 0, 50, 0, 0),
      wall("path-one", 0, 50, 40, 50, false),
      wall("path-two", 40, 50, 40, 70, false),
      wall("path-three", 40, 70, 100, 70, false)
    ],
    staircases: []
  }];
  project.building.levels[0]!.walls.find((candidate) => candidate.id === "top")!.openings = [{
    id: "outer-door",
    type: "DOOR",
    offsetFromStart: 10,
    width: 20,
    height: 200,
    elevation: 0,
    connectedRoomIds: [room.id]
  }];
  project.viewpoints = [{
    id: "upper-room-view",
    levelId: "ground-floor",
    roomId: room.id,
    cameraPosition: { x: 80, y: 160, z: 90 },
    cameraTarget: { x: 60, y: 100, z: 80 },
    fieldOfView: 60,
    projection: "PERSPECTIVE"
  }];
  project.baseImages = [];
  return project;
}

function saveSuccessFetch() {
  let persisted = false;
  const fetchImplementation = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT") {
        persisted = true;
        return Response.json({
          project: savedProjectFixture,
          sourceRevision: savedProjectFixture.revision
        });
      }

      return Response.json(
        url.endsWith("/geometry")
          ? persisted
            ? savedGeometryResponse
            : geometryResponse
          : {
              project: persisted ? savedProjectFixture : demoProjectFixture,
              sourceRevision: persisted
                ? savedProjectFixture.revision
                : demoProjectFixture.revision
            }
      );
    }
  ) as unknown as typeof fetch;

  return fetchImplementation;
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

function findOpening(project: Project, openingId: string) {
  const opening = project.building.levels
    .flatMap((level) => level.walls)
    .flatMap((wall) => wall.openings)
    .find((candidate) => candidate.id === openingId);
  if (!opening) throw new Error(`Opening ${openingId} was not found.`);
  return opening;
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
    expect((screen.getByRole("switch", { name: "Show room contours" }) as HTMLInputElement).checked)
      .toBe(true);
    expect(screen.queryByRole("switch", { name: "Show bounding boxes" })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Show geometry labels" })).toBeNull();
    expect(screen.queryByTestId("polygon-bounds")).toBeNull();
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
      "Draw connected walls as a continuous chain."
    );
  });

  it("keeps document scale independent from Project geometry, history, and viewport zoom", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const draft = store.getState().projectEditor.draft;
    const serializedDraft = JSON.stringify(draft);
    const automatic = (await screen.findAllByTestId("automatic-dimension"))[0]!;
    const physicalValue = automatic.getAttribute("data-physical-value");
    const originalLine = automatic.querySelector(".architectural-dimension-line")?.getAttribute("y1");

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Scale" }));
    fireEvent.click(screen.getByRole("option", { name: "1:100" }));

    expect(store.getState().projectEditor.presentation.scaleDenominator).toBe(100);
    expect(store.getState().projectEditor.draft).toBe(draft);
    expect(JSON.stringify(store.getState().projectEditor.draft)).toBe(serializedDraft);
    expect(store.getState().projectEditor.dirty).toBe(false);
    expect(store.getState().projectEditor.history).toEqual({ past: [], future: [] });
    const rescaled = screen.getAllByTestId("automatic-dimension")[0]!;
    expect(rescaled.getAttribute("data-physical-value")).toBe(physicalValue);
    expect(rescaled.querySelector(".architectural-dimension-line")?.getAttribute("y1")).not.toBe(originalLine);

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(store.getState().projectEditor.presentation.scaleDenominator).toBe(100);
    expect(screen.getAllByTestId("automatic-dimension")[0]?.getAttribute("data-physical-value")).toBe(physicalValue);
    fireEvent.click(screen.getByRole("button", { name: "Fit to view" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset viewport" }));
    expect(store.getState().projectEditor.presentation.scaleDenominator).toBe(100);
    expect(store.getState().projectEditor.dirty).toBe(false);
  });

  it("controls derived dimensions without dirtying the Project", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect((await screen.findAllByTestId("automatic-dimension")).length).toBeGreaterThan(0);
    const inspector = screen.getByRole("complementary", { name: "Test inspector" });
    const toggle = within(inspector).getByRole("switch", { name: "Overall dimensions" });
    fireEvent.click(toggle);
    expect(screen.queryByTestId("automatic-dimension")).toBeNull();
    expect(store.getState().projectEditor.presentation.dimensions.overallDimensions).toBe(false);
    expect(store.getState().projectEditor.dirty).toBe(false);
    expect(store.getState().projectEditor.history.past).toHaveLength(0);
  });

  it("shows exact selected Wall and Room measurements from canonical geometry", async () => {
    renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    const wallTarget = document.querySelector(
      '.architectural-wall-hit-target[data-geometry-id="left-room-north-wall"]'
    );
    expect(wallTarget).not.toBeNull();
    fireEvent.click(wallTarget as Element);
    const selectedDimension = await screen.findByTestId("selected-dimension");
    expect(selectedDimension.getAttribute("data-physical-value")).toBe("400");
    expect(within(selectedDimension).getByText("4.00 m")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("selected-dimension")).toBeNull();

    fireEvent.click(screen.getAllByTestId("geometry-polygon")[0]!);
    const inspector = screen.getByRole("complementary", { name: "Test inspector" });
    fireEvent.click(within(inspector).getByRole("tab", { name: "Selection" }));
    expect(within(inspector).getByText("Left Room")).toBeTruthy();
    expect(within(inspector).getByText("12.00 m²")).toBeTruthy();
    expect(within(inspector).getByText("14.00 m")).toBeTruthy();
    expect(screen.getByText(/Total room area: 24.00 m²/)).toBeTruthy();
    expect(screen.getByText(/Overall width: 8.00 m/)).toBeTruthy();
    expect(screen.getByText(/Overall depth: 3.00 m/)).toBeTruthy();
  });

  it("measures snapped Project points transiently and cancels with Escape", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.keyDown(window, { key: "m" });
    expect(store.getState().projectEditor.activeTool).toBe("measure");
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const edge = screen.getAllByTestId("boundary-edge")[0]!;
    const start = { x: Number(edge.getAttribute("x1")), y: Number(edge.getAttribute("y1")) };
    const midpoint = {
      x: (Number(edge.getAttribute("x1")) + Number(edge.getAttribute("x2"))) / 2,
      y: (Number(edge.getAttribute("y1")) + Number(edge.getAttribute("y2"))) / 2
    };
    const draft = store.getState().projectEditor.draft;

    fireEvent.click(svg, { clientX: start.x, clientY: start.y });
    fireEvent.pointerMove(svg, { clientX: midpoint.x + 2, clientY: midpoint.y + 2, pointerId: 1 });
    expect(store.getState().projectEditor.transient.snapCandidate?.kind).toBe("wall-midpoint");
    expect(screen.getByTestId("measurement-snap-marker")).toBeTruthy();
    const temporary = screen.getByTestId("temporary-measurement");
    expect(Number(temporary.getAttribute("data-physical-value"))).toBeGreaterThan(0);
    fireEvent.click(svg, { clientX: midpoint.x + 2, clientY: midpoint.y + 2 });
    expect(store.getState().projectEditor.transient.interaction).toMatchObject({
      kind: "measure",
      completed: true
    });
    expect(store.getState().projectEditor.draft).toBe(draft);
    expect(store.getState().projectEditor.history).toEqual({ past: [], future: [] });
    expect(store.getState().projectEditor.dirty).toBe(false);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("temporary-measurement")).toBeNull();
    expect(store.getState().projectEditor.activeTool).toBe("measure");
    expect(store.getState().projectEditor.history).toEqual({ past: [], future: [] });
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

  it("places, selects, edits, and deletes architectural Openings with semantic history", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const initialDraft = store.getState().projectEditor.draft;

    fireEvent.click(screen.getByRole("button", { name: "Door" }));
    fireEvent.pointerMove(svg, { clientX: 220, clientY: 395, pointerId: 31 });
    expect(screen.getByTestId("opening-placement-preview").getAttribute("data-valid")).toBe("true");
    expect(store.getState().projectEditor.draft).toBe(initialDraft);
    const previewInteraction = store.getState().projectEditor.transient.interaction;
    expect(previewInteraction?.kind).toBe("place-opening");
    const previewCandidate = previewInteraction?.kind === "place-opening"
      ? previewInteraction.candidate
      : undefined;
    expect(previewCandidate?.valid).toBe(true);
    fireEvent.click(svg, { clientX: 580, clientY: 395 });

    await waitFor(() => expect(screen.getAllByTestId("architectural-door")).toHaveLength(1));
    expect(store.getState().projectEditor.history.past).toHaveLength(1);
    const owningWall = store.getState().projectEditor.draft!.building.levels[0]!.walls
      .find((wall) => wall.openings.some((opening) => opening.type === "DOOR"))!;
    const door = owningWall.openings.find((opening) => opening.type === "DOOR")!;
    expect(owningWall.id).toBe(previewCandidate?.wallId);
    expect(door.offsetFromStart).toBe(previewCandidate?.opening.offsetFromStart);
    expect(door).toMatchObject({ width: 90, height: 210, elevation: 0, hingeSide: "START", swingSide: "LEFT" });
    expect(store.getState().projectEditor.selection).toEqual([{ kind: "DOOR", geometryId: door.id }]);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    const doorElement = screen.getByTestId("architectural-door");
    fireEvent.pointerDown(doorElement, { clientX: 220, clientY: 395, pointerId: 30 });
    fireEvent.pointerUp(svg, { clientX: 220, clientY: 395, pointerId: 30 });
    fireEvent.click(doorElement);
    expect(store.getState().projectEditor.selection).toEqual([{ kind: "DOOR", geometryId: door.id }]);
    expect(store.getState().projectEditor.history.past).toHaveLength(1);
    expect(findOpening(store.getState().projectEditor.draft!, door.id).offsetFromStart).toBe(door.offsetFromStart);
    fireEvent.click(screen.getByRole("tab", { name: "Selection" }));
    expect(screen.getAllByText("Door")).toHaveLength(2);

    const positionField = screen.getByLabelText("Position from wall start (cm)");
    fireEvent.change(positionField, { target: { value: "80" } });
    fireEvent.blur(positionField);
    expect(findOpening(store.getState().projectEditor.draft!, door.id).offsetFromStart).toBe(80);
    expect(store.getState().projectEditor.history.past).toHaveLength(2);

    const draftBeforeDrag = store.getState().projectEditor.draft;
    const selectedDoor = screen.getByTestId("architectural-door");
    const span = selectedDoor.querySelector(".architectural-opening-hit-target")!;
    const spanStart = {
      x: Number(span.getAttribute("x1")),
      y: Number(span.getAttribute("y1"))
    };
    const spanEnd = {
      x: Number(span.getAttribute("x2")),
      y: Number(span.getAttribute("y2"))
    };
    const spanLength = Math.hypot(spanEnd.x - spanStart.x, spanEnd.y - spanStart.y);
    const tangent = {
      x: (spanEnd.x - spanStart.x) / spanLength,
      y: (spanEnd.y - spanStart.y) / spanLength
    };
    const center = {
      x: (spanStart.x + spanEnd.x) / 2,
      y: (spanStart.y + spanEnd.y) / 2
    };
    const screenUnitsPerProjectUnit = spanLength / door.width;
    const targetOffset = 91.237;
    const target = {
      x: center.x + tangent.x * (targetOffset - 80) * screenUnitsPerProjectUnit,
      y: center.y + tangent.y * (targetOffset - 80) * screenUnitsPerProjectUnit
    };
    fireEvent.pointerDown(screen.getByTestId("selected-opening-drag-handle"), {
      clientX: center.x,
      clientY: center.y,
      pointerId: 33
    });
    fireEvent.pointerMove(svg, {
      clientX: center.x + tangent.x * 3,
      clientY: center.y + tangent.y * 3,
      pointerId: 33
    });
    expect((screen.getByLabelText("Position from wall start (cm)") as HTMLInputElement).value).toBe("80");
    fireEvent.pointerMove(svg, { clientX: target.x, clientY: target.y, pointerId: 33 });
    expect(store.getState().projectEditor.draft).toBe(draftBeforeDrag);
    expect(findOpening(store.getState().projectEditor.draft!, door.id).offsetFromStart).toBe(80);
    expect(store.getState().projectEditor.history.past).toHaveLength(2);
    expect(store.getState().projectEditor.transient.interaction).toMatchObject({
      kind: "move-opening",
      currentOffsetFromStart: 91.24,
      dragging: true,
      valid: true
    });
    expect((screen.getByLabelText("Position from wall start (cm)") as HTMLInputElement).value).toBe("91.24");
    expect(screen.getByTestId("opening-placement-preview").getAttribute("data-offset-from-start")).toBe("91.24");
    expect(svg.classList).toContain("geometry-svg--opening-drag");
    expect(screen.getByTestId("architectural-door").getAttribute("data-dragging")).toBe("true");
    fireEvent.pointerUp(svg, { clientX: target.x, clientY: target.y, pointerId: 33 });
    fireEvent.click(screen.getByTestId("architectural-door"));
    expect(svg.classList).not.toContain("geometry-svg--opening-drag");
    expect(store.getState().projectEditor.history.past).toHaveLength(3);
    expect(findOpening(store.getState().projectEditor.draft!, door.id).offsetFromStart).toBe(91.24);
    expect((screen.getByLabelText("Position from wall start (cm)") as HTMLInputElement).value).toBe("91.24");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(findOpening(store.getState().projectEditor.draft!, door.id).offsetFromStart).toBe(80);
    expect(store.getState().projectEditor.selection).toEqual([]);
    fireEvent.click(screen.getByTestId("architectural-door"));
    expect((screen.getByLabelText("Position from wall start (cm)") as HTMLInputElement).value).toBe("80");

    fireEvent.pointerDown(screen.getByTestId("selected-opening-drag-handle"), {
      clientX: center.x,
      clientY: center.y,
      pointerId: 35
    });
    fireEvent.pointerMove(svg, { clientX: target.x, clientY: target.y, pointerId: 35 });
    expect(svg.classList).toContain("geometry-svg--opening-drag");
    fireEvent.pointerCancel(svg, { pointerId: 35 });
    expect(svg.classList).not.toContain("geometry-svg--opening-drag");
    expect(store.getState().projectEditor.transient.interaction).toBeNull();
    expect(findOpening(store.getState().projectEditor.draft!, door.id).offsetFromStart).toBe(80);
    expect(store.getState().projectEditor.history.past).toHaveLength(2);

    const widthField = screen.getByLabelText("Width (cm)");
    fireEvent.change(widthField, { target: { value: "100" } });
    fireEvent.blur(widthField);
    expect(store.getState().projectEditor.history.past).toHaveLength(3);
    const heightField = screen.getByLabelText("Height (cm)");
    fireEvent.change(heightField, { target: { value: "220" } });
    fireEvent.blur(heightField);
    expect(store.getState().projectEditor.history.past).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Flip hinge" }));
    expect(store.getState().projectEditor.history.past).toHaveLength(5);
    expect(store.getState().projectEditor.draft!.building.levels[0]!.walls
      .flatMap((wall) => wall.openings)
      .find((opening) => opening.id === door.id)).toMatchObject({ hingeSide: "END" });
    fireEvent.click(screen.getByRole("button", { name: "Flip swing" }));
    expect(store.getState().projectEditor.history.past).toHaveLength(6);

    fireEvent.keyDown(window, { key: "Delete" });
    expect(store.getState().projectEditor.history.past).toHaveLength(7);
    expect(store.getState().projectEditor.draft!.building.levels[0]!.walls.flatMap((wall) => wall.openings)).toEqual([]);

    fireEvent.keyDown(window, { key: "n" });
    expect(store.getState().projectEditor.activeTool).toBe("window");
    fireEvent.pointerMove(svg, { clientX: 580, clientY: 395, pointerId: 32 });
    fireEvent.click(svg, { clientX: 580, clientY: 395 });
    await waitFor(() => expect(screen.getAllByTestId("architectural-window")).toHaveLength(1));
    expect(store.getState().projectEditor.draft!.building.levels[0]!.walls.flatMap((wall) => wall.openings)[0])
      .toMatchObject({ type: "WINDOW", width: 120, height: 120, elevation: 90 });
    expect(store.getState().projectEditor.history.past).toHaveLength(8);
    const windowOpening = store.getState().projectEditor.draft!.building.levels[0]!.walls
      .flatMap((wall) => wall.openings)[0]!;
    expect(store.getState().projectEditor.selection).toEqual([{ kind: "WINDOW", geometryId: windowOpening.id }]);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    const windowElement = screen.getByTestId("architectural-window");
    fireEvent.pointerDown(windowElement, { clientX: 580, clientY: 395, pointerId: 34 });
    fireEvent.pointerUp(svg, { clientX: 580, clientY: 395, pointerId: 34 });
    fireEvent.click(windowElement);
    expect(store.getState().projectEditor.selection).toEqual([{ kind: "WINDOW", geometryId: windowOpening.id }]);
    expect(store.getState().projectEditor.history.past).toHaveLength(8);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(store.getState().projectEditor.draft!.building.levels[0]!.walls.flatMap((wall) => wall.openings)).toEqual([]);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(store.getState().projectEditor.draft!.building.levels[0]!.walls.flatMap((wall) => wall.openings)[0])
      .toMatchObject({ type: "WINDOW" });
  });

  it("creates an explicit Room, supports undo and redo, and keeps grid controls transient", async () => {
    const unassignedProject = structuredClone(demoProjectFixture);
    unassignedProject.viewpoints = [];
    for (const level of unassignedProject.building.levels) {
      level.rooms = [];
      level.staircases = [];
      level.walls = level.walls.map((wall) => ({
        ...wall,
        roomIds: [],
        openings: []
      }));
    }
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) =>
      Response.json(
        String(input).endsWith("/geometry")
          ? geometryResponse
          : { project: unassignedProject, sourceRevision: unassignedProject.revision }
      )
    ) as typeof fetch;
    const { store } = renderConnectedRoute(createApiClient(fetchImplementation));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });
    expect(undo.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("switch", { name: "Grid" }));
    fireEvent.click(screen.getByRole("switch", { name: "Snap to grid" }));
    expect(document.querySelector('[data-layer="editor-grid"]')).toBeTruthy();
    expect(store.getState().projectEditor.dirty).toBe(false);

    const createRoomButton = screen.getByRole("button", { name: "Create Room" });
    expect(createRoomButton.hasAttribute("disabled")).toBe(true);
    fireEvent.click((await screen.findAllByTestId("room-face-candidate"))[0]!);
    expect(createRoomButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(createRoomButton);
    await waitFor(() =>
      expect(store.getState().projectEditor.draft!.building.levels[0]!.rooms.length).toBe(1)
    );
    expect(store.getState().projectEditor.dirty).toBe(true);
    expect(undo.hasAttribute("disabled")).toBe(false);
    fireEvent.click(undo);
    expect(store.getState().projectEditor.draft!.building.levels[0]!.rooms).toEqual([]);
    expect(store.getState().projectEditor.dirty).toBe(false);
    expect(redo.hasAttribute("disabled")).toBe(false);
    fireEvent.click(redo);
    expect(store.getState().projectEditor.draft!.building.levels[0]!.rooms).toHaveLength(1);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(store.getState().projectEditor.draft!.building.levels[0]!.rooms).toEqual([]);
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(store.getState().projectEditor.draft!.building.levels[0]!.rooms).toHaveLength(1);
  });

  it("selects and reconciles a multi-Wall Room subdivision as one history commit", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingDraftReplaced(createMultiWallSubdivisionProject())));

    const createRoomButton = screen.getByRole("button", { name: "Create Room" });
    const candidates = await screen.findAllByTestId("room-face-candidate");
    expect(candidates).toHaveLength(2);
    const candidatePointSequences = candidates.map((candidate) => candidate.getAttribute("points"))
      .sort();
    expect(createRoomButton.hasAttribute("disabled")).toBe(true);
    const historyBefore = store.getState().projectEditor.history.past.length;

    fireEvent.click(candidates[1]!);
    expect(candidates[1]!.getAttribute("class")).toContain(
      "geometry-room-face-candidate--selected"
    );
    fireEvent.click(createRoomButton);
    await waitFor(() =>
      expect(store.getState().projectEditor.draft!.building.levels[0]!.rooms).toHaveLength(2)
    );
    const reconciledLevel = store.getState().projectEditor.draft!.building.levels[0]!;
    const additionalRoomId = reconciledLevel.rooms.find((room) => room.id !== "whole-room")!.id;
    expect(reconciledLevel.walls.find((wall) => wall.id === "top")?.openings[0])
      .toMatchObject({ connectedRoomIds: [additionalRoomId] });
    expect(store.getState().projectEditor.draft!.viewpoints[0]?.roomId).toBe(additionalRoomId);
    expect(store.getState().projectEditor.history.past).toHaveLength(historyBefore + 1);
    expect(screen.getAllByTestId("geometry-polygon")).toHaveLength(2);
    const polygonPointSequences = screen.getAllByTestId("geometry-polygon")
      .map((polygon) => polygon.getAttribute("points"))
      .sort();
    const contourPointSequences = screen.getAllByTestId("room-contour")
      .map((contour) => contour.getAttribute("points"))
      .sort();
    expect(polygonPointSequences).toEqual(candidatePointSequences);
    expect(contourPointSequences).toEqual(polygonPointSequences);
    expect(polygonPointSequences.every((points) => points?.split(" ").length === 6)).toBe(true);
    expect(screen.queryByTestId("polygon-bounds")).toBeNull();
    expect(screen.getAllByTestId("polygon-centroid")).toHaveLength(2);
    expect(screen.queryByTestId("room-face-candidate")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(store.getState().projectEditor.draft!.building.levels[0]!.rooms).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(store.getState().projectEditor.draft!.building.levels[0]!.rooms).toHaveLength(2);
  });

  it("preserves the draft when a referenced Viewpoint lies on the subdivision boundary", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const project = createMultiWallSubdivisionProject();
    project.viewpoints[0] = {
      ...project.viewpoints[0]!,
      cameraPosition: { x: 40, y: 160, z: 60 }
    };
    act(() => store.dispatch(editingDraftReplaced(project)));
    const candidate = (await screen.findAllByTestId("room-face-candidate"))[0]!;
    fireEvent.click(candidate);
    const before = store.getState().projectEditor.draft;
    const historyBefore = store.getState().projectEditor.history.past.length;

    fireEvent.click(screen.getByRole("button", { name: "Create Room" }));

    expect(store.getState().projectEditor.draft).toBe(before);
    expect(store.getState().projectEditor.history.past).toHaveLength(historyBefore);
    expect(await screen.findByText(
      "A saved viewpoint lies on or outside the resulting room boundaries."
    )).toBeTruthy();
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
    expect(state.transient.interaction).toMatchObject({
      kind: "draw-wall",
      startPoint: wall.end,
      currentPointerPoint: wall.end
    });
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

  it("continues a Draw Wall chain from the exact committed endpoint until Escape", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const originalWallCount =
      store.getState().projectEditor.draft!.building.levels[0]!.walls.length;

    fireEvent.click(svg, { clientX: 120, clientY: 360 });
    fireEvent.click(svg, { clientX: 180, clientY: 320 });
    fireEvent.click(svg, { clientX: 250, clientY: 285 });

    await waitFor(() =>
      expect(
        store.getState().projectEditor.draft!.building.levels[0]!.walls
      ).toHaveLength(originalWallCount + 2)
    );
    const walls = store
      .getState()
      .projectEditor.draft!.building.levels[0]!.walls.slice(-2);
    expect(walls[0]?.end).toEqual(walls[1]?.start);
    expect(store.getState().projectEditor.transient.interaction).toMatchObject({
      kind: "draw-wall",
      startPoint: walls[1]?.end
    });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(store.getState().projectEditor.transient.interaction).toBeNull();
    expect(store.getState().projectEditor.activeTool).toBe("draw-wall");
    expect(
      store.getState().projectEditor.draft!.building.levels[0]!.walls
    ).toHaveLength(originalWallCount + 2);
  });

  it("ends a chain after canonical cycle closure while keeping Draw Wall active", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const levelBefore =
      store.getState().projectEditor.draft!.building.levels[0]!;
    const wallCount = levelBefore.walls.length;
    const roomCount = levelBefore.rooms.length;
    const start = { x: 120, y: 360 };

    fireEvent.click(svg, { clientX: start.x, clientY: start.y });
    fireEvent.click(svg, { clientX: 180, clientY: 320 });
    fireEvent.click(svg, { clientX: 250, clientY: 360 });
    fireEvent.pointerMove(svg, {
      clientX: start.x,
      clientY: start.y,
      pointerId: 1
    });
    fireEvent.click(svg, { clientX: start.x, clientY: start.y });

    await waitFor(() =>
      expect(
        store.getState().projectEditor.draft!.building.levels[0]!.walls
      ).toHaveLength(wallCount + 3)
    );
    expect(store.getState().projectEditor.transient.interaction).toBeNull();
    expect(store.getState().projectEditor.activeTool).toBe("draw-wall");
    expect(
      store.getState().projectEditor.draft!.building.levels[0]!.rooms
    ).toHaveLength(roomCount);

    fireEvent.pointerMove(svg, { clientX: 300, clientY: 400, pointerId: 1 });
    expect(store.getState().projectEditor.transient.interaction).toBeNull();
    fireEvent.click(svg, { clientX: 300, clientY: 400 });
    expect(store.getState().projectEditor.transient.interaction).toMatchObject({
      kind: "draw-wall",
      startPoint: expect.any(Object)
    });
  });

  it("exposes standalone and shared-junction handles on a connected Wall", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const wallCount =
      store.getState().projectEditor.draft!.building.levels[0]!.walls.length;

    fireEvent.click(svg, { clientX: 120, clientY: 360 });
    fireEvent.click(svg, { clientX: 180, clientY: 320 });
    fireEvent.click(svg, { clientX: 250, clientY: 285 });
    const firstNewWall =
      store.getState().projectEditor.draft!.building.levels[0]!.walls[
        wallCount
      ]!;

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(
      document.querySelector(
        `[data-geometry-id="boundary-edge:${firstNewWall.id}"]`
      )!
    );

    expect(screen.getByRole("button", { name: "Start endpoint" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "End endpoint" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Selection" }));
    expect(
      screen.getByText(/connected to other walls and moves as one junction/i)
    ).toBeTruthy();
    expect(
      screen.getByRole("spinbutton", { name: "Height (cm)" })
    ).toBeTruthy();
  });

  it("defensively cancels a stale endpoint drag after the endpoint becomes shared", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const wallCount =
      store.getState().projectEditor.draft!.building.levels[0]!.walls.length;
    fireEvent.click(svg, { clientX: 120, clientY: 360 });
    fireEvent.click(svg, { clientX: 220, clientY: 300 });
    fireEvent.keyDown(window, { key: "Escape" });
    const wall =
      store.getState().projectEditor.draft!.building.levels[0]!.walls[
        wallCount
      ]!;

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(
      document.querySelector(`[data-geometry-id="boundary-edge:${wall.id}"]`)!
    );
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Start endpoint" }),
      { pointerId: 19 }
    );

    const draft = structuredClone(store.getState().projectEditor.draft!);
    draft.building.levels[0]!.walls.push(
      createDraftWall(
        wall.start,
        { x: wall.start.x - 40, z: wall.start.z },
        "stale-connection"
      )
    );
    act(() => store.dispatch(editingDraftReplaced(draft)));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start endpoint" })).toBeTruthy()
    );
    const protectedDraft = store.getState().projectEditor.draft;
    const buildCount = buildSpy.mock.calls.length;

    fireEvent.pointerMove(svg, { clientX: 80, clientY: 360, pointerId: 19 });
    fireEvent.pointerUp(svg, { clientX: 80, clientY: 360, pointerId: 19 });

    expect(store.getState().projectEditor.draft).toBe(protectedDraft);
    expect(store.getState().projectEditor.transient.interaction).toBeNull();
    expect(buildSpy).toHaveBeenCalledTimes(buildCount);
  });

  it("keeps equal snap offsets stable across a letterboxed SVG", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 520,
      width: 1000,
      height: 520,
      toJSON: () => ({})
    });
    const edge = document.querySelector(
      '[data-geometry-id="boundary-edge:left-room-north-wall"]'
    ) as SVGLineElement;
    const start = {
      x: Number(edge.getAttribute("x1")),
      y: Number(edge.getAttribute("y1"))
    };
    const end = {
      x: Number(edge.getAttribute("x2")),
      y: Number(edge.getAttribute("y2"))
    };
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const normal = {
      x: -(end.y - start.y) / length,
      y: (end.x - start.x) / length
    };
    const sample = (parameter: number) => {
      fireEvent.pointerMove(svg, {
        clientX: 100 + start.x + (end.x - start.x) * parameter + normal.x * 5,
        clientY: start.y + (end.y - start.y) * parameter + normal.y * 5,
        pointerId: 1
      });
      return store.getState().projectEditor.transient.snapCandidate;
    };

    const nearStart = sample(0);
    const midpoint = sample(0.5);
    const nearEnd = sample(1);
    expect(nearStart?.kind).toBe("vertex");
    expect(midpoint?.kind).toBe("wall-midpoint");
    expect(nearEnd?.kind).toBe("vertex");
    for (const candidate of [nearStart, midpoint, nearEnd]) {
      expect(candidate?.visualDistancePixels).toBeCloseTo(5, 5);
    }
    const marker = screen
      .getByTestId("draw-wall-snap-marker")
      .querySelector(".geometry-wall-snap-marker")!;
    expect(Number(marker.getAttribute("cx"))).toBeCloseTo(end.x, 5);
    expect(Number(marker.getAttribute("cy"))).toBeCloseTo(end.y, 5);
  });

  it("snaps a new Wall endpoint to exact existing Vertex coordinates", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const vertexElement = screen.getAllByTestId("geometry-vertex")[0]!;
    const clientX = Number(vertexElement.getAttribute("cx"));
    const clientY = Number(vertexElement.getAttribute("cy"));
    const geometryId = vertexElement.getAttribute("data-geometry-id");
    const before = GeometryEngine.build(store.getState().projectEditor.draft!);
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const canonicalVertex = before.model.levels[0]!.vertices.find(
      (vertex) => vertex.id === geometryId
    )!;

    fireEvent.pointerMove(svg, { clientX, clientY, pointerId: 1 });
    expect(
      store.getState().projectEditor.transient.snapCandidate
    ).toMatchObject({
      kind: "vertex",
      geometryId
    });
    expect(await screen.findByTestId("draw-wall-snap-marker")).toBeTruthy();
    fireEvent.click(svg, { clientX, clientY });
    fireEvent.click(svg, { clientX: clientX + 37, clientY: clientY + 31 });

    await waitFor(() =>
      expect(
        store.getState().projectEditor.draft!.building.levels[0]!.walls.at(-1)
          ?.start
      ).toEqual({ x: canonicalVertex.x, z: canonicalVertex.z })
    );
    const after = GeometryEngine.build(store.getState().projectEditor.draft!);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(
      after.model.levels[0]!.vertices.find(
        (vertex) =>
          vertex.x === canonicalVertex.x && vertex.z === canonicalVertex.z
      )?.incidentEdges.length
    ).toBeGreaterThan(canonicalVertex.incidentEdges.length);
  });

  it("commits a Wall-interior snap as one atomic split and connected Wall draft", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const edge = document.querySelector(
      '[data-geometry-id="boundary-edge:left-room-north-wall"]'
    ) as SVGLineElement;
    expect(edge).toBeTruthy();
    const x1 = Number(edge.getAttribute("x1"));
    const y1 = Number(edge.getAttribute("y1"));
    const x2 = Number(edge.getAttribute("x2"));
    const y2 = Number(edge.getAttribute("y2"));
    const midpoint = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    const length = Math.hypot(x2 - x1, y2 - y1);
    const normal = { x: -(y2 - y1) / length, y: (x2 - x1) / length };
    const snapPointer = {
      x: midpoint.x + normal.x * 4,
      y: midpoint.y + normal.y * 4
    };
    const freeEnd = {
      x: midpoint.x + normal.x * 30,
      y: midpoint.y + normal.y * 30
    };
    const beforeDraft = store.getState().projectEditor.draft!;
    const originalWallCount = beforeDraft.building.levels[0]!.walls.length;

    fireEvent.pointerMove(svg, {
      clientX: snapPointer.x,
      clientY: snapPointer.y,
      pointerId: 1
    });
    expect(
      (await screen.findByTestId("draw-wall-snap-marker")).querySelector(
        ".geometry-wall-snap-marker--wall-midpoint"
      )
    ).toBeTruthy();
    fireEvent.click(svg, { clientX: snapPointer.x, clientY: snapPointer.y });
    expect(store.getState().projectEditor.draft).toBe(beforeDraft);
    const buildCount = buildSpy.mock.calls.length;
    fireEvent.click(svg, { clientX: freeEnd.x, clientY: freeEnd.y });

    await waitFor(() =>
      expect(
        store.getState().projectEditor.draft!.building.levels[0]!.walls
      ).toHaveLength(originalWallCount + 2)
    );
    expect(buildSpy).toHaveBeenCalledTimes(buildCount + 1);
    const level = store.getState().projectEditor.draft!.building.levels[0]!;
    const original = level.walls.find(
      (wall) => wall.id === "left-room-north-wall"
    )!;
    const connected = level.walls.at(-1)!;
    expect(original.end).toEqual(connected.start);
    expect(
      level.walls.some(
        (wall) =>
          wall.id !== original.id &&
          wall.id !== connected.id &&
          wall.start.x === connected.start.x &&
          wall.start.z === connected.start.z
      )
    ).toBe(true);
    expect(GeometryEngine.build(store.getState().projectEditor.draft!).ok).toBe(
      true
    );
  });

  it("deleting a branch atomically removes its redundant Room-wall split", async () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Draw Wall" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const beforeLevel =
      store.getState().projectEditor.draft!.building.levels[0]!;
    const originalWallCount = beforeLevel.walls.length;
    const originalWall = structuredClone(
      beforeLevel.walls.find((wall) => wall.id === "left-room-north-wall")!
    );
    const edge = document.querySelector(
      '[data-geometry-id="boundary-edge:left-room-north-wall"]'
    ) as SVGLineElement;
    const midpoint = {
      x:
        (Number(edge.getAttribute("x1")) + Number(edge.getAttribute("x2"))) / 2,
      y: (Number(edge.getAttribute("y1")) + Number(edge.getAttribute("y2"))) / 2
    };
    const delta = {
      x: Number(edge.getAttribute("x2")) - Number(edge.getAttribute("x1")),
      y: Number(edge.getAttribute("y2")) - Number(edge.getAttribute("y1"))
    };
    const length = Math.hypot(delta.x, delta.y);
    const normal = { x: -delta.y / length, y: delta.x / length };

    fireEvent.click(svg, {
      clientX: midpoint.x + normal.x * 4,
      clientY: midpoint.y + normal.y * 4
    });
    fireEvent.click(svg, {
      clientX: midpoint.x + normal.x * 45,
      clientY: midpoint.y + normal.y * 45
    });
    await waitFor(() =>
      expect(
        store.getState().projectEditor.draft!.building.levels[0]!.walls
      ).toHaveLength(originalWallCount + 2)
    );
    const splitLevel =
      store.getState().projectEditor.draft!.building.levels[0]!;
    const branch = splitLevel.walls.at(-1)!;
    const originalIndex = splitLevel.walls.findIndex(
      (wall) => wall.id === originalWall.id
    );
    const splitChild = splitLevel.walls[originalIndex + 1]!;

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(
      document.querySelector(`[data-geometry-id="boundary-edge:${branch.id}"]`)!
    );
    const buildCount = buildSpy.mock.calls.length;
    fireEvent.keyDown(window, { key: "Delete" });

    await waitFor(() =>
      expect(
        store.getState().projectEditor.draft!.building.levels[0]!.walls
      ).toHaveLength(originalWallCount)
    );
    const level = store.getState().projectEditor.draft!.building.levels[0]!;
    expect(level.walls.find((wall) => wall.id === originalWall.id)).toEqual(
      originalWall
    );
    expect(level.walls.some((wall) => wall.id === splitChild.id)).toBe(false);
    expect(level.rooms).toHaveLength(beforeLevel.rooms.length);
    expect(buildSpy).toHaveBeenCalledTimes(buildCount + 1);
    const geometry = GeometryEngine.build(
      store.getState().projectEditor.draft!
    );
    expect(geometry.ok).toBe(true);
    if (!geometry.ok) return;
    expect(
      geometry.model.levels[0]?.vertices.some(
        (vertex) => vertex.x === branch.start.x && vertex.z === branch.start.z
      )
    ).toBe(false);
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
    const selectedLengthBefore = screen.getByTestId("selected-dimension").getAttribute("data-physical-value");
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
    expect(screen.getByTestId("selected-dimension").getAttribute("data-physical-value"))
      .not.toBe(selectedLengthBefore);
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
    expect(screen.getByRole("button", { name: "Start endpoint" })).toBeTruthy();
    expect(
      screen.getByText(/move all connected walls together/i)
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
    expect(screen.queryByRole("spinbutton", { name: "Height (cm)" })).toBeNull();
    expect(screen.queryByRole("spinbutton", { name: "Thickness (cm)" })).toBeNull();
  });

  it("previews a selected shared Vertex and commits one junction move on pointer-up", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    const svg = screen.getByRole("img") as unknown as SVGSVGElement;
    prepareSvgPointerCoordinates(svg);
    const vertex = screen.getAllByTestId("geometry-vertex")[0]!;
    const originalDraft = store.getState().projectEditor.draft;
    const originalHistoryLength = store.getState().projectEditor.history.past.length;
    fireEvent.click(vertex);
    const handle = screen.getByRole("button", { name: "Move junction" });
    const clientX = Number(handle.getAttribute("cx"));
    const clientY = Number(handle.getAttribute("cy"));
    fireEvent.pointerDown(handle, { pointerId: 31, clientX, clientY });
    fireEvent.pointerMove(svg, { pointerId: 31, clientX: clientX + 12, clientY: clientY + 8 });
    expect(store.getState().projectEditor.draft).toBe(originalDraft);
    expect(screen.getByTestId("selected-junction-overlay")).toBeTruthy();
    fireEvent.pointerUp(svg, { pointerId: 31, clientX: clientX + 12, clientY: clientY + 8 });

    await waitFor(() =>
      expect(store.getState().projectEditor.history.past).toHaveLength(originalHistoryLength + 1)
    );
    expect(store.getState().projectEditor.draft).not.toBe(originalDraft);
    expect(store.getState().projectEditor.transient.interaction).toBeNull();
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
        .getByRole("button", { name: "Undo" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Redo" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(screen.queryByText(/AI Assistant/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(screen.queryByRole("toolbar", { name: "Editing tools" })).toBeNull();
    await waitFor(() => {
      const unloadEvent = new Event("beforeunload", { cancelable: true });
      expect(window.dispatchEvent(unloadEvent)).toBe(true);
    });
    expect(screen.getByText("Saved")).toBeTruthy();
    const unloadEvent = new Event("beforeunload", { cancelable: true });
    expect(window.dispatchEvent(unloadEvent)).toBe(true);
  });

  it("keeps Save disabled for a clean Edit session without sending PUT", async () => {
    const fetchImplementation = successFetch();
    renderConnectedRoute(createApiClient(fetchImplementation));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(screen.getByText("No unsaved changes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
      "disabled",
      true
    );
    expect(
      vi
        .mocked(fetchImplementation)
        .mock.calls.some(([, init]) => init?.method === "PUT")
    ).toBe(false);
  });

  it("saves one stable complete draft, refreshes both authorities, and returns to View", async () => {
    let resolvePut: ((response: Response) => void) | undefined;
    let persisted = false;
    const fetchImplementation = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "PUT") {
          return new Promise<Response>((resolve) => {
            resolvePut = (response) => {
              persisted = true;
              resolve(response);
            };
          });
        }
        return Promise.resolve(
          Response.json(
            url.endsWith("/geometry")
              ? persisted
                ? savedGeometryResponse
                : geometryResponse
              : {
                  project: persisted ? savedProjectFixture : demoProjectFixture,
                  sourceRevision: persisted
                    ? savedProjectFixture.revision
                    : demoProjectFixture.revision
                }
          )
        );
      }
    ) as unknown as typeof fetch;
    const { store, queryClient } = renderConnectedRoute(
      createApiClient(fetchImplementation)
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));
    const savedDraft = structuredClone(store.getState().projectEditor.draft!);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const savingDialog = await screen.findByRole("dialog", {
      name: "Saving project…"
    });
    expect(within(savingDialog).getByRole("progressbar")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Draw Wall" })).toBeNull();
    fireEvent.keyDown(savingDialog, { key: "Escape" });
    expect(
      screen.getByRole("dialog", { name: "Saving project…" })
    ).toBeTruthy();

    const putCall = vi
      .mocked(fetchImplementation)
      .mock.calls.find(([, init]) => init?.method === "PUT");
    expect(putCall).toBeTruthy();
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual({
      baseRevision: demoProjectFixture.revision,
      project: savedDraft
    });

    await act(async () => {
      resolvePut?.(
        Response.json({
          project: savedProjectFixture,
          sourceRevision: savedProjectFixture.revision
        })
      );
    });

    await waitFor(() =>
      expect(store.getState().projectEditor.mode).toBe("view")
    );
    expect(
      queryClient.getQueryData(projectKeys.detail(demoProjectFixture.id))
    ).toMatchObject({
      sourceRevision: savedProjectFixture.revision
    });
    expect(
      queryClient.getQueryData(geometryKeys.detail(demoProjectFixture.id))
    ).toMatchObject({
      sourceRevision: savedProjectFixture.revision
    });
    expect(screen.queryByRole("toolbar", { name: "Editing tools" })).toBeNull();
    expect(
      vi
        .mocked(fetchImplementation)
        .mock.calls.filter(
          ([input, init]) =>
            init?.method === "GET" &&
            String(input).endsWith(`/projects/${demoProjectFixture.id}`)
        )
    ).toHaveLength(2);
    expect(
      vi
        .mocked(fetchImplementation)
        .mock.calls.filter(([input]) => String(input).endsWith("/geometry"))
    ).toHaveLength(2);
  });

  it("keeps a refreshed Project with stale Geometry behind the blocking modal", async () => {
    let persisted = false;
    let geometryReads = 0;
    let resolveGeometryRefresh: ((response: Response) => void) | undefined;
    const fetchImplementation = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "PUT") {
          persisted = true;
          return Response.json({
            project: savedProjectFixture,
            sourceRevision: savedProjectFixture.revision
          });
        }
        if (url.endsWith("/geometry")) {
          geometryReads += 1;
          if (geometryReads > 1) {
            return new Promise<Response>((resolve) => {
              resolveGeometryRefresh = resolve;
            });
          }
          return Response.json(geometryResponse);
        }
        return Response.json({
          project: persisted ? savedProjectFixture : demoProjectFixture,
          sourceRevision: persisted
            ? savedProjectFixture.revision
            : demoProjectFixture.revision
        });
      }
    ) as unknown as typeof fetch;
    const { store } = renderConnectedRoute(
      createApiClient(fetchImplementation)
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(geometryReads).toBe(2));
    expect(
      screen.getByRole("dialog", { name: "Saving project…" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", {
        name: "Project geometry is inconsistent"
      })
    ).toBeNull();

    await act(async () => {
      resolveGeometryRefresh?.(Response.json(savedGeometryResponse));
    });
    await waitFor(() =>
      expect(store.getState().projectEditor.mode).toBe("view")
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Saving project…" })
      ).toBeNull()
    );
  });

  it("confirms explicit Discard and never mutates authoritative state", async () => {
    const fetchImplementation = successFetch();
    const { store } = renderConnectedRoute(
      createApiClient(fetchImplementation)
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));
    const draft = store.getState().projectEditor.draft;

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Discard unsaved changes?" })
      ).getByRole("button", { name: "Keep editing" })
    );
    expect(store.getState().projectEditor.draft).toBe(draft);

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Discard unsaved changes?" })
      ).toBeNull()
    );

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() =>
      expect(store.getState().projectEditor.mode).toBe("view")
    );
    expect(
      vi
        .mocked(fetchImplementation)
        .mock.calls.some(([, init]) => init?.method === "PUT")
    ).toBe(false);
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("preserves the exact dirty session after authoritative validation failure", async () => {
    const fetchImplementation = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PUT") {
          return Response.json(
            {
              type: "/problems/project-state-invalid",
              title: "Project state invalid",
              status: 422,
              detail: "Internal validation detail",
              code: "PROJECT_STATE_INVALID"
            },
            { status: 422 }
          );
        }
        return Response.json(
          String(input).endsWith("/geometry")
            ? geometryResponse
            : {
                project: demoProjectFixture,
                sourceRevision: demoProjectFixture.revision
              }
        );
      }
    ) as unknown as typeof fetch;
    const { store } = renderConnectedRoute(
      createApiClient(fetchImplementation)
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));
    const draft = store.getState().projectEditor.draft;
    const baseRevision = store.getState().projectEditor.baseRevision;

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/some geometry is invalid/i)).toBeTruthy();
    expect(store.getState().projectEditor.draft).toBe(draft);
    expect(store.getState().projectEditor.baseRevision).toBe(baseRevision);
    expect(store.getState().projectEditor.dirty).toBe(true);
    expect(store.getState().projectEditor.mode).toBe("edit");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Saving project…" })
      ).toBeNull()
    );
  });

  it("preserves generic save failures and leaves Save available for retry", async () => {
    const fetchImplementation = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PUT") {
          return new Response("gateway failure", { status: 503 });
        }
        return Response.json(
          String(input).endsWith("/geometry")
            ? geometryResponse
            : {
                project: demoProjectFixture,
                sourceRevision: demoProjectFixture.revision
              }
        );
      }
    ) as unknown as typeof fetch;
    const { store } = renderConnectedRoute(
      createApiClient(fetchImplementation)
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));
    const draft = store.getState().projectEditor.draft;
    const baseRevision = store.getState().projectEditor.baseRevision;
    const saveFailureCopy =
      "The project could not be saved. Your changes are still available locally. Please try again.";

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const feedback = await screen.findByText(saveFailureCopy);
    expect(store.getState().projectEditor.draft).toBe(draft);
    expect(store.getState().projectEditor.baseRevision).toBe(baseRevision);
    expect(store.getState().projectEditor.dirty).toBe(true);
    expect(store.getState().projectEditor.mode).toBe("edit");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Saving project…" })
      ).toBeNull()
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
      "disabled",
      false
    );

    fireEvent.click(
      within(feedback.closest('[role="alert"]')!).getByRole("button", {
        name: "Close"
      })
    );
    await waitFor(() => expect(screen.queryByText(saveFailureCopy)).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        vi
          .mocked(fetchImplementation)
          .mock.calls.filter(([, init]) => init?.method === "PUT")
      ).toHaveLength(2)
    );
    expect(store.getState().projectEditor.draft).toBe(draft);
    expect(store.getState().projectEditor.dirty).toBe(true);
    expect(store.getState().projectEditor.mode).toBe("edit");
  });

  it("uses the unified unsaved-changes decision when returning to View", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(
      screen.getByRole("dialog", { name: "Unsaved changes" })
    ).toBeTruthy();
    expect(store.getState().projectEditor.mode).toBe("edit");
    expect(store.getState().projectEditor.dirty).toBe(true);
  });

  it("cancels pending navigation when the user keeps editing", async () => {
    const { store } = renderConnectedRoute(createApiClient(successFetch()));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));

    fireEvent.click(screen.getByRole("link", { name: "Open project two" }));

    expect(
      await screen.findByRole("dialog", { name: "Unsaved changes" })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Unsaved changes" })
      ).toBeNull()
    );
    expect(store.getState().projectEditor.dirty).toBe(true);
    expect(
      screen.getByRole("heading", { name: demoProjectFixture.name })
    ).toBeTruthy();
  });

  it("resumes the exact pending route once after Save and authoritative refresh", async () => {
    const fetchImplementation = saveSuccessFetch();
    const { store, router } = renderConnectedRoute(
      createApiClient(fetchImplementation)
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));

    fireEvent.click(screen.getByRole("link", { name: "Open destination" }));
    fireEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Unsaved changes" })
      ).getByRole("button", { name: "Save" })
    );

    expect(await screen.findByText("Destination route")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/destination");
    expect(store.getState().projectEditor.mode).toBe("view");
    expect(
      vi
        .mocked(fetchImplementation)
        .mock.calls.filter(([, init]) => init?.method === "PUT")
    ).toHaveLength(1);
  });

  it("does not resume pending navigation when Save fails", async () => {
    const fetchImplementation = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PUT") {
          return new Response("gateway failure", { status: 503 });
        }
        return Response.json(
          String(input).endsWith("/geometry")
            ? geometryResponse
            : {
                project: demoProjectFixture,
                sourceRevision: demoProjectFixture.revision
              }
        );
      }
    ) as unknown as typeof fetch;
    const { store, router } = renderConnectedRoute(
      createApiClient(fetchImplementation)
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));
    const draft = store.getState().projectEditor.draft;

    fireEvent.click(screen.getByRole("link", { name: "Open destination" }));
    fireEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Unsaved changes" })
      ).getByRole("button", { name: "Save" })
    );

    expect(
      await screen.findByText(
        "The project could not be saved. Your changes are still available locally. Please try again."
      )
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe(
      `/app/projects/${demoProjectFixture.id}`
    );
    expect(store.getState().projectEditor.draft).toBe(draft);
    expect(store.getState().projectEditor.dirty).toBe(true);
  });

  it("resumes pending navigation after Discard without sending PUT", async () => {
    const fetchImplementation = successFetch();
    const { store, router } = renderConnectedRoute(
      createApiClient(fetchImplementation)
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));

    fireEvent.click(screen.getByRole("link", { name: "Open destination" }));
    fireEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Unsaved changes" })
      ).getByRole("button", { name: "Discard changes" })
    );

    expect(await screen.findByText("Destination route")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/destination");
    expect(store.getState().projectEditor.mode).toBe("view");
    expect(
      vi
        .mocked(fetchImplementation)
        .mock.calls.some(([, init]) => init?.method === "PUT")
    ).toBe(false);
  });

  it("preserves conflict work and requires a second confirmation before reload", async () => {
    let latest = false;
    const fetchImplementation = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "PUT") {
          return Response.json(
            {
              type: "/problems/project-revision-conflict",
              title: "Project revision conflict",
              status: 409,
              detail: "The base revision is stale.",
              code: "PROJECT_REVISION_CONFLICT"
            },
            { status: 409 }
          );
        }
        return Response.json(
          url.endsWith("/geometry")
            ? latest
              ? savedGeometryResponse
              : geometryResponse
            : {
                project: latest ? savedProjectFixture : demoProjectFixture,
                sourceRevision: latest
                  ? savedProjectFixture.revision
                  : demoProjectFixture.revision
              }
        );
      }
    ) as unknown as typeof fetch;
    const { store, queryClient } = renderConnectedRoute(
      createApiClient(fetchImplementation)
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));
    const draft = store.getState().projectEditor.draft;
    const baseRevision = store.getState().projectEditor.baseRevision;

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const conflictDialog = await screen.findByRole("dialog", {
      name: "Project changed on the server"
    });
    expect(
      within(conflictDialog).getByText(
        "A newer version of this project exists. Your local changes are still available, but they cannot be saved over the newer version."
      )
    ).toBeTruthy();
    expect(
      within(conflictDialog).getByRole("button", { name: "Keep local draft" })
    ).toBeTruthy();
    expect(store.getState().projectEditor.draft).toBe(draft);
    expect(store.getState().projectEditor.baseRevision).toBe(baseRevision);
    expect(store.getState().projectEditor.dirty).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Keep local draft" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Project changed on the server"
        })
      ).toBeNull()
    );
    expect(store.getState().projectEditor.draft).toBe(draft);
    expect(store.getState().projectEditor.baseRevision).toBe(baseRevision);
    expect(store.getState().projectEditor.dirty).toBe(true);
    expect(store.getState().projectEditor.mode).toBe("edit");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByRole("dialog", {
        name: "Project changed on the server"
      })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reload latest" }));
    expect(
      screen.getByRole("dialog", {
        name: "Discard local changes and reload?"
      })
    ).toBeTruthy();
    expect(store.getState().projectEditor.draft).toBe(draft);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(store.getState().projectEditor.draft).toBe(draft);

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Discard local changes and reload?"
        })
      ).toBeNull()
    );

    fireEvent.click(screen.getByRole("button", { name: "Reload latest" }));
    latest = true;
    fireEvent.click(screen.getByRole("button", { name: "Discard and reload" }));
    await waitFor(() =>
      expect(store.getState().projectEditor.mode).toBe("view")
    );
    await waitFor(() =>
      expect(
        queryClient.getQueryData(projectKeys.detail(demoProjectFixture.id))
      ).toMatchObject({ sourceRevision: savedProjectFixture.revision })
    );
    expect(
      queryClient.getQueryData(geometryKeys.detail(demoProjectFixture.id))
    ).toMatchObject({ sourceRevision: savedProjectFixture.revision });
    expect(store.getState().projectEditor.draft).toBeNull();
    expect(store.getState().projectEditor.baseRevision).toBeNull();
    expect(store.getState().projectEditor.dirty).toBe(false);
    expect(screen.queryByRole("toolbar", { name: "Editing tools" })).toBeNull();
  });

  it("reports post-save refresh failure without resending the successful PUT", async () => {
    let persisted = false;
    let refreshAvailable = false;
    const fetchImplementation = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PUT") {
          persisted = true;
          return Response.json({
            project: savedProjectFixture,
            sourceRevision: savedProjectFixture.revision
          });
        }
        if (persisted && !refreshAvailable) {
          return new Response("unavailable", { status: 503 });
        }
        return Response.json(
          String(input).endsWith("/geometry")
            ? persisted
              ? savedGeometryResponse
              : geometryResponse
            : {
                project: persisted ? savedProjectFixture : demoProjectFixture,
                sourceRevision: persisted
                  ? savedProjectFixture.revision
                  : demoProjectFixture.revision
              }
        );
      }
    ) as unknown as typeof fetch;
    const { store, queryClient, router } = renderConnectedRoute(
      createApiClient(fetchImplementation)
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    act(() => store.dispatch(editingSessionMarkedDirty()));
    fireEvent.click(screen.getByRole("link", { name: "Open destination" }));
    fireEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Unsaved changes" })
      ).getByRole("button", { name: "Save" })
    );

    expect(
      await screen.findByRole("heading", {
        name: "Project saved, but the latest version could not be loaded"
      })
    ).toBeTruthy();
    expect(store.getState().projectEditor.mode).toBe("view");
    expect(
      vi
        .mocked(fetchImplementation)
        .mock.calls.filter(([, init]) => init?.method === "PUT")
    ).toHaveLength(1);
    expect(router.state.location.pathname).toBe(
      `/app/projects/${demoProjectFixture.id}`
    );

    refreshAvailable = true;
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    expect(await screen.findByText("Destination route")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/destination");
    expect(
      queryClient.getQueryData(projectKeys.detail(demoProjectFixture.id))
    ).toMatchObject({ sourceRevision: savedProjectFixture.revision });
    expect(
      vi
        .mocked(fetchImplementation)
        .mock.calls.filter(([, init]) => init?.method === "PUT")
    ).toHaveLength(1);
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
    expect(within(dialog).getByText("Delete selected wall or opening")).toBeTruthy();
    expect(within(dialog).getByText("Delete / Backspace")).toBeTruthy();
    expect(within(dialog).getByText("Undo")).toBeTruthy();
    expect(within(dialog).getByText("Ctrl/Cmd + Z")).toBeTruthy();
    expect(within(dialog).getAllByText("Redo")).toHaveLength(2);
    expect(within(dialog).getByText("Ctrl/Cmd + Shift + Z")).toBeTruthy();
    expect(within(dialog).getByText("Ctrl/Cmd + Y")).toBeTruthy();
    expect(within(dialog).getByText("Measure tool")).toBeTruthy();
    expect(within(dialog).getByText("M")).toBeTruthy();
    expect(within(dialog).queryByText(/Zoom/i)).toBeNull();

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
