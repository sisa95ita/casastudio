import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useReducer } from "react";
import { createGeometrySelectionState } from "../../../geometry-2d/selection/geometry-selection-state";
import {
  editingSessionEntered,
  editorActiveToolChanged,
  editorSelectionChanged,
  editorUndoRequested,
  editorRedoRequested,
  projectEditorReducer
} from "../../state/project-editor-slice";
import { furnitureProjectFixture } from "../../../../test/furniture-project-fixture";
import type { AppDispatch } from "../../../../app/store/store";
import { useFurnitureEditor } from "./useFurnitureEditor";
import { ProjectFurnitureProperties } from "./ProjectFurnitureProperties";
import { FurnitureSvgLayer } from "../../../geometry-2d/viewer/FurnitureSvgLayer";
import { createFurniturePresentation2D } from "../../../geometry-2d/presentation/furniture-presentation-model-2d";
import { createViewportTransform2D } from "../../../geometry-2d/viewport/viewport-transform-2d";

afterEach(cleanup);
const pointer = (x: number, z: number) => ({
  worldPoint: { x, z },
  svgPoint: { x, y: -z },
  cssPixelsPerSvgUnit: 1
});
// Hook harness uses the real reducer so gesture assertions inspect actual snapshot history.
function useEditorHarness(initialProject = furnitureProjectFixture()) {
  const [editor, dispatch] = useReducer(projectEditorReducer, undefined, () => {
    return projectEditorReducer(
      undefined,
      editingSessionEntered({
        project: initialProject,
        baseRevision: initialProject.revision
      })
    );
  });
  const controller = useFurnitureEditor({
    project: editor.draft,
    levelId: "ground",
    editor,
    dispatch: dispatch as AppDispatch,
    selection: createGeometrySelectionState(editor.selection, editor.hover),
    editable: true,
    visible: true
  });
  return { controller, editor, dispatch };
}

describe("Furniture controller and Properties", () => {
  it("creates a visible preview before any click and commits the final transient geometry once", () => {
    const { result } = renderHook(useEditorHarness);
    const c = () => result.current.controller;
    act(() => c().pointerMove(pointer(150, 150), 1));
    act(() => result.current.dispatch(editorActiveToolChanged("furniture")));
    act(() => c().chooseDefinition("generic-sofa"));
    expect(c().transient).toMatchObject({ positioned: true, previewVisible: true });
    expect(c().preview).toMatchObject({
      category: "SOFA",
      center: { x: 150, z: 150 },
      width: 200,
      depth: 90,
      rotation: 0
    });
    expect(c().previewValid).toBe(true);
    expect(c().item?.roomId).toBe("living");
    expect(result.current.editor.draft!.building.furniture).toEqual([]);
    expect(result.current.editor.history.past).toHaveLength(0);

    act(() => c().update({ width: 210, depth: 80, height: 92, rotation: 15 }));
    expect(c().preview).toMatchObject({
      width: 210,
      depth: 80,
      rotation: 15
    });
    expect(c().item?.height).toBe(92);
    expect(result.current.editor.history.past).toHaveLength(0);

    act(() => c().chooseDefinition("generic-desk"));
    expect(c().preview).toMatchObject({
      category: "DESK",
      center: { x: 150, z: 150 },
      width: 120,
      depth: 60,
      rotation: 0
    });
    act(() => c().update({ width: 130, depth: 70, height: 82, rotation: 12 }));
    const finalPreview = c().preview!;
    expect(result.current.editor.history.past).toHaveLength(0);
    act(() => c().canvasClick(pointer(150, 150)));
    expect(result.current.editor.draft!.building.furniture).toHaveLength(1);
    expect(result.current.editor.history.past).toHaveLength(1);
    const committed = result.current.editor.draft!.building.furniture[0]!;
    expect(committed).toMatchObject({
      definitionId: "generic-desk",
      position: { x: 150, z: 150 },
      width: 130,
      depth: 70,
      height: 82,
      rotation: 12,
      roomId: "living"
    });
    expect(createFurniturePresentation2D(committed).footprint).toEqual(
      finalPreview.footprint
    );
    expect(c().preview).toBeUndefined();
    expect(c().transient?.positioned).toBe(false);
    expect(result.current.editor.activeTool).toBe("furniture");
  });

  it("updates Room and spatial validity live, retaining invalid previews without history", () => {
    const project = furnitureProjectFixture();
    project.building.furniture.push({
      id: "existing",
      definitionId: "generic-chair",
      roomId: "living",
      position: { x: 300, z: 300 },
      rotation: 0,
      width: 45,
      depth: 50,
      height: 85
    });
    project.building.levels.push({
      id: "upper",
      name: "Upper",
      elevation: 280,
      rooms: [],
      walls: [],
      staircases: []
    });
    project.building.levels[0]!.staircases.push({
      id: "stair",
      name: "Stair",
      fromLevelId: "ground",
      toLevelId: "upper",
      width: 100,
      flights: [{
        id: "flight",
        start: { x: 400, z: 100 },
        end: { x: 500, z: 100 },
        width: 100,
        stepCount: 10,
        startElevation: 0,
        endElevation: 280
      }],
      landings: []
    });
    const { result } = renderHook(() => useEditorHarness(project));
    const c = () => result.current.controller;
    act(() => result.current.dispatch(editorActiveToolChanged("furniture")));
    act(() => c().chooseDefinition("generic-chair"));
    expect(c().preview).toBeTruthy();
    expect(c().previewValid).toBe(false);
    expect(c().candidates).toEqual([]);

    act(() => c().pointerMove(pointer(-50, 150), 1));
    expect(c().preview?.center).toEqual({ x: -50, z: 150 });
    expect(c().validation).toEqual({ status: "INVALID", issue: "NO_ROOM" });
    act(() => c().canvasClick(pointer(-50, 150)));
    expect(c().transient?.positioned).toBe(true);
    expect(c().item?.definitionId).toBe("generic-chair");
    expect(result.current.editor.draft!.building.furniture).toHaveLength(1);
    expect(result.current.editor.history.past).toHaveLength(0);

    act(() => c().pointerMove(pointer(30, 150), 1));
    expect(c().validation).toEqual({
      status: "INVALID",
      issue: "WALL_INTERSECTION"
    });
    expect(c().previewValid).toBe(false);
    act(() => c().pointerMove(pointer(150, 150), 1));
    expect(c().validation).toEqual({ status: "VALID" });
    expect(c().previewValid).toBe(true);
    expect(c().item?.roomId).toBe("living");

    act(() => c().pointerMove(pointer(300, 300), 1));
    expect(c().item?.roomId).toBe("");
    act(() => c().chooseRoom("living"));
    expect(c().validation).toEqual({
      status: "INVALID",
      issue: "FURNITURE_INTERSECTION"
    });
    act(() => c().chooseRoom("study"));
    expect(c().validation).toEqual({ status: "VALID" });

    act(() => c().pointerMove(pointer(450, 100), 1));
    expect(c().validation).toEqual({
      status: "WARNING",
      warning: "STAIRCASE_OVERLAP"
    });
    expect(c().previewValid).toBe(true);
    act(() => c().pointerMove(pointer(150, 150), 1));
    expect(c().validation).toEqual({ status: "VALID" });
    expect(result.current.editor.history.past).toHaveLength(0);

    act(() => c().cancel());
    expect(c().transient).toBeUndefined();
    expect(c().preview).toBeUndefined();
    expect(result.current.editor.history.past).toHaveLength(0);
    act(() => c().chooseDefinition("generic-chair"));
    expect(c().preview).toBeTruthy();
    act(() => result.current.dispatch(editorActiveToolChanged("measure")));
    expect(c().transient).toBeUndefined();
    expect(c().preview).toBeUndefined();
    expect(result.current.editor.history.past).toHaveLength(0);
  });

  it("models Room as no-choice, automatic resolution, or an enabled elevated choice", () => {
    const { result } = renderHook(useEditorHarness);
    act(() => result.current.dispatch(editorActiveToolChanged("furniture")));
    act(() => result.current.controller.chooseDefinition("generic-chair"));
    const view = render(
      <ProjectFurnitureProperties
        controller={result.current.controller}
        units={{ length: "cm", angle: "deg" }}
        editable
      />
    );
    let room = screen.getByRole("textbox", { name: "Room" }) as HTMLInputElement;
    expect(room.value).toBe("No Room");
    expect(room.disabled).toBe(true);
    expect(screen.queryByRole("combobox", { name: "Room" })).toBeNull();
    expect(result.current.controller.preview).toBeTruthy();
    expect(result.current.controller.previewValid).toBe(false);

    act(() => result.current.controller.pointerMove(pointer(150, 150), 1));
    view.rerender(
      <ProjectFurnitureProperties
        controller={result.current.controller}
        units={{ length: "cm", angle: "deg" }}
        editable
      />
    );
    room = screen.getByRole("textbox", { name: "Room" }) as HTMLInputElement;
    expect(room.value).toBe("Living Room");
    expect(room.disabled).toBe(true);
    expect(result.current.controller.item?.roomId).toBe("living");

    act(() => result.current.controller.pointerMove(pointer(350, 350), 1));
    view.rerender(
      <ProjectFurnitureProperties
        controller={result.current.controller}
        units={{ length: "cm", angle: "deg" }}
        editable
      />
    );
    const selector = screen.getByRole("combobox", {
      name: "Room"
    }) as HTMLInputElement;
    expect(selector.getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.mouseDown(selector);
    expect(
      screen.getByRole("option", { name: "Living Room · 0.00 m" })
    ).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Elevated Study · +2.00 m" })
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("option", { name: "Elevated Study · +2.00 m" })
    );
    expect(result.current.controller.item?.roomId).toBe("study");
    act(() => result.current.controller.pointerMove(pointer(400, 400), 1));
    expect(result.current.controller.item?.roomId).toBe("study");
  });

  it("shows unresolved instance identity and Room elevation, preserves metadata on duplication, and keeps unchanged numeric displays exact", () => {
    const project = furnitureProjectFixture();
    project.building.furniture = [
      {
        id: "custom-stool",
        definitionId: "external:stool",
        roomId: "study",
        position: { x: 350.123456, z: 350 },
        rotation: 387.123456,
        width: 45,
        depth: 50,
        height: 85,
        description: "Generic stool metadata"
      }
    ];
    function useUnknownHarness() {
      const [editor, dispatch] = useReducer(
        projectEditorReducer,
        undefined,
        () =>
          projectEditorReducer(
            undefined,
            editingSessionEntered({ project, baseRevision: project.revision })
          )
      );
      const controller = useFurnitureEditor({
        project: editor.draft,
        levelId: "ground",
        editor,
        dispatch: dispatch as AppDispatch,
        selection: createGeometrySelectionState([
          { kind: "FURNITURE", geometryId: "custom-stool" }
        ]),
        editable: true,
        visible: true
      });
      return { controller, editor };
    }
    const { result } = renderHook(useUnknownHarness);
    const { rerender } = render(
      <ProjectFurnitureProperties
        controller={result.current.controller}
        units={project.units}
        editable
      />
    );
    expect(screen.getByText("Unknown Furniture · GENERIC")).toBeTruthy();
    expect(screen.getByText("external:stool")).toBeTruthy();
    expect(screen.getByTestId("furniture-floor").textContent).toBe("2.00 m");
    expect(
      screen.getByRole("button", { name: "Duplicate Furniture" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Delete Furniture" })
    ).toBeTruthy();
    const x = screen.getByRole("spinbutton", {
      name: "X (cm)"
    }) as HTMLInputElement;
    expect(x.value).toBe("350.12");
    fireEvent.blur(x);
    expect(result.current.editor.history.past).toHaveLength(0);
    expect(result.current.editor.draft!.building.furniture[0]!.position.x).toBe(
      350.123456
    );
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Rotation (°)" }));
    expect(result.current.editor.draft!.building.furniture[0]!.rotation).toBe(
      387.123456
    );
    act(() => result.current.controller.duplicate());
    act(() => result.current.controller.update({ width: 55 }));
    act(() => result.current.controller.canvasClick(pointer(400, 400)));
    expect(result.current.editor.draft!.building.furniture[1]).toMatchObject({
      definitionId: "external:stool",
      description: "Generic stool metadata",
      width: 55,
      roomId: "study",
      rotation: 387.123456
    });
    rerender(
      <ProjectFurnitureProperties
        controller={{
          ...result.current.controller,
          authoring: false,
          transient: undefined,
          item: project.building.furniture[0]
        }}
        units={project.units}
        editable={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: "Delete Furniture" })
    ).toBeNull();
  });

  it("supports exact edits, transient drag and free rotation, cancellation, duplication and deletion", () => {
    const { result } = renderHook(useEditorHarness);
    const c = () => result.current.controller;
    act(() => result.current.dispatch(editorActiveToolChanged("furniture")));
    act(() => c().chooseDefinition("generic-sofa"));
    act(() => c().pointerMove(pointer(150, 150), 1));
    expect(result.current.editor.history.past).toHaveLength(0);
    act(() => c().canvasClick(pointer(150, 150)));
    expect(result.current.editor.history.past).toHaveLength(1);
    expect(result.current.editor.activeTool).toBe("furniture");
    expect(c().transient?.positioned).toBe(false);
    const id = result.current.editor.draft!.building.furniture[0]!.id;
    act(() => result.current.dispatch(editorActiveToolChanged("select")));
    act(() => c().beginGesture(id, "move", pointer(160, 160), 1));
    act(() => c().pointerMove(pointer(180, 190), 1));
    expect(c().item?.position).toEqual({ x: 170, z: 180 });
    expect(
      result.current.editor.draft!.building.furniture[0]!.position
    ).toEqual({ x: 150, z: 150 });
    act(() => c().endGesture(true));
    expect(result.current.editor.history.past).toHaveLength(2);
    act(() => c().update({ position: { x: 190, z: 200 } }));
    act(() => c().update({ rotation: 725.25 }));
    act(() => c().update({ width: 230, depth: 110, height: 95 }));
    expect(c().selected).toMatchObject({
      position: { x: 190, z: 200 },
      rotation: 725.25,
      width: 230,
      depth: 110,
      height: 95
    });
    act(() => c().beginGesture(id, "rotate", pointer(190, 280), 2));
    act(() => c().pointerMove(pointer(270, 200), 2));
    expect(c().item!.rotation).toBeCloseTo(815.25);
    expect(c().selected!.rotation).toBe(725.25);
    act(() => c().endGesture(true));
    const historyLength = result.current.editor.history.past.length;
    act(() => c().beginGesture(id, "move", pointer(190, 200), 3));
    act(() => c().pointerMove(pointer(-50, -50), 3));
    act(() => c().endGesture(true));
    expect(result.current.editor.history.past).toHaveLength(historyLength);
    expect(c().selected?.position).toEqual({ x: 190, z: 200 });
    act(() => c().duplicate());
    expect(result.current.editor.draft!.building.furniture).toHaveLength(1);
    act(() => c().canvasClick(pointer(400, 180)));
    expect(result.current.editor.draft!.building.furniture).toHaveLength(2);
    const duplicate = result.current.editor.draft!.building.furniture[1]!;
    expect(duplicate).toMatchObject({
      width: 230,
      depth: 110,
      height: 95,
      rotation: 815.25
    });
    act(() => result.current.dispatch(editorActiveToolChanged("select")));
    act(() => c().beginGesture(duplicate.id, "move", pointer(400, 180), 4));
    act(() => c().endGesture(false));
    act(() => c().remove());
    expect(result.current.editor.draft!.building.furniture).toHaveLength(1);
    act(() => result.current.dispatch(editorUndoRequested()));
    expect(result.current.editor.draft!.building.furniture).toHaveLength(2);
    act(() => result.current.dispatch(editorRedoRequested()));
    expect(result.current.editor.draft!.building.furniture).toHaveLength(1);
  });
  it("rejects Wall collisions consistently across numeric, rotation, resize, duplicate and drag paths", () => {
    const { result } = renderHook(useEditorHarness);
    const c = () => result.current.controller;
    act(() => result.current.dispatch(editorActiveToolChanged("furniture")));
    act(() => c().chooseDefinition("generic-desk"));
    act(() => c().canvasClick(pointer(70, 300)));
    const placed = result.current.editor.draft!.building.furniture[0]!;
    expect(placed.position).toEqual({ x: 70, z: 300 });
    act(() => result.current.dispatch(editorActiveToolChanged("select")));
    act(() =>
      result.current.dispatch(
        editorSelectionChanged(
          createGeometrySelectionState([
            { kind: "FURNITURE", geometryId: placed.id }
          ])
        )
      )
    );
    const historyLength = result.current.editor.history.past.length;
    let accepted = true;
    act(() => { accepted = c().update({ position: { x: 60, z: 300 } }); });
    expect(accepted).toBe(false);
    act(() => { accepted = c().update({ rotation: 45 }); });
    expect(accepted).toBe(false);
    act(() => { accepted = c().update({ width: 140 }); });
    expect(accepted).toBe(false);
    expect(result.current.editor.history.past).toHaveLength(historyLength);
    expect(c().selected).toMatchObject({
      position: { x: 70, z: 300 },
      rotation: 0,
      width: 120
    });

    act(() => c().duplicate());
    act(() => c().canvasClick(pointer(70, 300)));
    expect(result.current.editor.draft!.building.furniture).toHaveLength(1);
    act(() => result.current.dispatch(editorActiveToolChanged("select")));
    act(() => c().beginGesture(placed.id, "move", pointer(70, 300), 2));
    act(() => c().pointerMove(pointer(60, 300), 2));
    act(() => c().endGesture(true));
    expect(result.current.editor.history.past).toHaveLength(historyLength);
    expect(result.current.editor.draft!.building.furniture[0]!.position).toEqual({
      x: 70,
      z: 300
    });
  });
  it("requires an explicit target for numeric and drag transitions into an overlap, with one confirmed history action", () => {
    const { result } = renderHook(useEditorHarness);
    const c = () => result.current.controller;
    act(() => result.current.dispatch(editorActiveToolChanged("furniture")));
    act(() => c().chooseDefinition("generic-desk"));
    act(() => c().canvasClick(pointer(800, 400)));
    const id = result.current.editor.draft!.building.furniture[0]!.id;
    act(() => result.current.dispatch(editorActiveToolChanged("select")));
    act(() => c().beginGesture(id, "move", pointer(800, 400), 1));
    act(() => c().endGesture(false));
    act(() => c().update({ position: { x: 350, z: 350 } }));
    expect(c().transient?.awaitingRoom).toBe(true);
    expect(c().selected?.roomId).toBe("other");
    act(() => c().chooseRoom("study"));
    act(() => c().commit());
    expect(c().room?.floorElevation).toBe(200);
    expect(result.current.editor.history.past).toHaveLength(2);
    act(() => c().update({ roomId: "living" }));
    expect(c().room?.floorElevation).toBe(0);
    act(() => c().update({ position: { x: 800, z: 400 } }));
    act(() => c().beginGesture(id, "move", pointer(800, 400), 2));
    act(() => c().pointerMove(pointer(350, 350), 2));
    act(() => c().endGesture(true));
    expect(c().transient?.awaitingRoom).toBe(true);
    act(() => c().chooseRoom("study"));
    act(() => c().commit());
    expect(c().selected?.roomId).toBe("study");
    const before = result.current.editor.draft;
    act(() => c().update({ position: { x: -100, z: -100 } }));
    expect(result.current.editor.draft).toBe(before);
    act(() => c().update({ roomId: "other" }));
    expect(result.current.editor.draft).toBe(before);
  });
  it("exposes canonical catalog options, exact values, elevated floor and discoverable actions", () => {
    function Harness() {
      const { controller, dispatch } = useEditorHarness();
      return (
        <>
          <button
            onClick={() => dispatch(editorActiveToolChanged("furniture"))}
          >
            Start
          </button>
          <ProjectFurnitureProperties
            controller={controller}
            units={{ length: "cm", angle: "deg" }}
            editable
          />
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByText("Start"));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Catalog" }));
    expect(screen.getAllByRole("option")).toHaveLength(8);
    fireEvent.click(screen.getByRole("option", { name: "SOFA · Sofa" }));
    const width = screen.getByRole("spinbutton", {
      name: "Width (cm)"
    }) as HTMLInputElement;
    expect(width.value).toBe("200");
    fireEvent.change(width, { target: { value: "225" } });
    fireEvent.blur(width);
    expect(
      (
        screen.getByRole("spinbutton", {
          name: "Width (cm)"
        }) as HTMLInputElement
      ).value
    ).toBe("225");
    expect(
      screen.getByRole("button", { name: "Cancel Furniture authoring" })
    ).toBeTruthy();
  });
  it("uses practical whole-footprint hits, independent style, hidden layer suppression and visible authoring previews", () => {
    const item = {
      id: "chair",
      roomId: "living",
      definitionId: "unknown:chair",
      position: { x: 100, z: 100 },
      rotation: 25,
      width: 45,
      depth: 50,
      height: 85
    };
    const model = createFurniturePresentation2D(item);
    const props = {
      model: { items: [model], previewValid: true, editing: true },
      transform: createViewportTransform2D({ zoom: 1, offsetX: 0, offsetY: 0 }),
      selection: createGeometrySelectionState([
        { kind: "FURNITURE", geometryId: item.id }
      ]),
      selectionEnabled: true,
      onClick: () => {},
      onHover: () => {},
      onPointerDown: () => {}
    };
    const { rerender } = render(
      <svg>
        <FurnitureSvgLayer {...props} visible />
      </svg>
    );
    expect(
      screen.getByTestId("furniture-hit-target").getAttribute("pointer-events")
    ).toBe("all");
    expect(screen.getByTestId("furniture-rotation-handle")).toBeTruthy();
    expect(item.rotation).toBe(25);
    rerender(
      <svg>
        <FurnitureSvgLayer {...props} visible={false} />
      </svg>
    );
    expect(screen.queryByTestId("furniture-hit-target")).toBeNull();
    rerender(
      <svg>
        <FurnitureSvgLayer
          {...props}
          visible={false}
          model={{ ...props.model, preview: model }}
        />
      </svg>
    );
    expect(screen.getByTestId("furniture-preview")).toBeTruthy();
    expect(screen.queryByTestId("furniture-hit-target")).toBeNull();
  });
});
