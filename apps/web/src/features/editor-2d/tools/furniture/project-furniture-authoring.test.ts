import { describe, expect, it } from "vitest";
import {
  builtinFurnitureDefinitions,
  deleteFurniture,
  deleteRoom,
  resizeFurniture,
  rotateFurniture,
  resolveFurnitureRoom
} from "@casastudio/schema";
import { furnitureProjectFixture } from "../../../../test/furniture-project-fixture";
import {
  commitFurnitureInteraction,
  furnitureRoomCandidates,
  positionFurniture,
  resolveFurnitureTarget,
  startFurniturePlacement
} from "./project-furniture-authoring";
import {
  editingDraftReplaced,
  editingSessionEntered,
  editorActiveToolChanged,
  editorFurnitureChanged,
  editorRedoRequested,
  editorSelectionChanged,
  editorTransientInteractionCleared,
  editorUndoRequested,
  projectEditorReducer
} from "../../state/project-editor-slice";
import {
  getProjectEditorInteraction,
  projectEditorTools
} from "../../state/project-editor-tools";
import { createGeometrySelectionState } from "../../../geometry-2d/selection/geometry-selection-state";

const project = furnitureProjectFixture();
const overlap = { x: 350, z: 350 };
const ordinary = { x: 150, z: 150 };
const place = () =>
  positionFurniture(
    project,
    "ground",
    startFurniturePlacement("generic-sofa")!,
    ordinary
  );

describe("Furniture authoring", () => {
  it("registers the tool and copies every canonical catalog default without a second catalog", () => {
    expect(
      projectEditorTools.find((tool) => tool.id === "furniture")?.enabled
    ).toBe(true);
    expect(
      getProjectEditorInteraction("furniture", true).furniturePlacementEnabled
    ).toBeUndefined();
    for (const definition of builtinFurnitureDefinitions) {
      const draft = startFurniturePlacement(definition.id)!;
      expect(draft.item).toMatchObject({
        definitionId: definition.id,
        width: definition.defaultWidth,
        depth: definition.defaultDepth,
        height: definition.defaultHeight,
        rotation: 0
      });
      expect(draft.positioned).toBe(false);
      expect(draft.previewVisible).toBe(true);
    }
    expect(startFurniturePlacement("absent")).toBeUndefined();
  });
  it("uses the anchor, includes edges, supports elevated overlaps and never guesses", () => {
    expect(
      furnitureRoomCandidates(project, "ground", ordinary).map(
        (room) => room.roomId
      )
    ).toEqual(["living"]);
    expect(
      furnitureRoomCandidates(project, "ground", { x: 0, z: 100 })
    ).toHaveLength(1);
    expect(furnitureRoomCandidates(project, "ground", overlap)).toEqual([
      { roomId: "living", name: "Living Room", floorElevation: 0 },
      { roomId: "study", name: "Elevated Study", floorElevation: 200 }
    ]);
    expect(
      resolveFurnitureTarget(
        furnitureRoomCandidates(project, "ground", overlap)
      )
    ).toBe("");
    expect(
      furnitureRoomCandidates(project, "ground", { x: -10, z: -10 })
    ).toEqual([]);
    expect(furnitureRoomCandidates(project, "missing", ordinary)).toEqual([]);
  });
  it("retains explicit targets until ineligible, then re-resolves single/ambiguous/outside anchors", () => {
    let draft = positionFurniture(
      project,
      "ground",
      startFurniturePlacement("generic-desk")!,
      overlap
    );
    expect(draft.item.roomId).toBe("");
    expect(
      commitFurnitureInteraction(project, "ground", draft, "desk")
    ).toBeUndefined();
    draft = {
      ...draft,
      explicitRoomId: "study",
      item: { ...draft.item, roomId: "study" }
    };
    draft = positionFurniture(project, "ground", draft, { x: 400, z: 400 });
    expect(draft.item.roomId).toBe("study");
    draft = positionFurniture(project, "ground", draft, ordinary);
    expect(draft.item.roomId).toBe("living");
    draft = positionFurniture(project, "ground", draft, { x: 800, z: 400 });
    expect(draft.item.roomId).toBe("other");
    draft = positionFurniture(project, "ground", draft, overlap);
    expect(draft.item.roomId).toBe("");
    draft = positionFurniture(project, "ground", draft, { x: -10, z: -10 });
    expect(draft.item.roomId).toBe("");
    expect(
      commitFurnitureInteraction(project, "ground", draft, "desk")
    ).toBeUndefined();
  });
  it("creates only at confirmation, retains exact metadata and dimensions, and cancels without history", () => {
    let state = projectEditorReducer(
      undefined,
      editingSessionEntered({ project, baseRevision: project.revision })
    );
    state = projectEditorReducer(state, editorActiveToolChanged("furniture"));
    state = projectEditorReducer(state, editorFurnitureChanged(place()));
    expect(state.history.past).toHaveLength(0);
    expect(state.draft?.building.furniture).toEqual([]);
    state = projectEditorReducer(state, editorTransientInteractionCleared());
    expect(state.history.past).toHaveLength(0);
    state = projectEditorReducer(state, editorFurnitureChanged(place()));
    state = projectEditorReducer(state, editorActiveToolChanged("select"));
    expect(state.transient.interaction).toBeNull();
    const result = commitFurnitureInteraction(
      project,
      "ground",
      place(),
      "sofa"
    )!;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.furniture[0]).toMatchObject({
      id: "sofa",
      roomId: "living",
      position: ordinary
    });
    expect(project.building.furniture).toEqual([]);
  });
  it("undoes/redoes each semantic create/move/rotate/resize/reassign/duplicate/delete with complete snapshots", () => {
    let state = projectEditorReducer(
      undefined,
      editingSessionEntered({ project, baseRevision: project.revision })
    );
    const commit = (result: ReturnType<typeof resizeFurniture> | undefined) => {
      expect(result?.ok).toBe(true);
      if (!result?.ok) throw new Error("invalid fixture operation");
      const before = state.draft;
      state = projectEditorReducer(state, editingDraftReplaced(result.project));
      expect(state.history.past.at(-1)).toEqual(before);
      const after = state.draft;
      state = projectEditorReducer(state, editorUndoRequested());
      expect(state.draft).toEqual(before);
      state = projectEditorReducer(state, editorRedoRequested());
      expect(state.draft).toEqual(after);
    };
    commit(commitFurnitureInteraction(state.draft!, "ground", place(), "sofa"));
    const move = (position: { x: number; z: number }, roomId?: string) =>
      commit(
        commitFurnitureInteraction(
          state.draft!,
          "ground",
          positionFurniture(
            state.draft!,
            "ground",
            {
              ...place(),
              intent: "move",
              sourceId: "sofa",
              item: {
                ...state.draft!.building.furniture[0]!,
                roomId: roomId ?? "living"
              }
            },
            position
          ),
          "unused"
        )
      );
    move({ x: 120, z: 130 });
    commit(
      rotateFurniture(state.draft!, { furnitureId: "sofa", rotation: 387.25 })
    );
    commit(
      resizeFurniture(state.draft!, {
        furnitureId: "sofa",
        width: 230,
        depth: 110,
        height: 95
      })
    );
    move(overlap, "study");
    expect(
      resolveFurnitureRoom(state.draft!, state.draft!.building.furniture[0]!)
        ?.floorElevation
    ).toBe(200);
    expect(state.draft!.building.furniture[0]).not.toHaveProperty("levelId");
    expect(state.draft!.building.furniture[0]!.position).not.toHaveProperty(
      "y"
    );
    commit(
      commitFurnitureInteraction(
        state.draft!,
        "ground",
        {
          ...place(),
          intent: "duplicate",
          sourceId: "sofa",
          item: {
            ...state.draft!.building.furniture[0]!,
            position: overlap,
            roomId: "living"
          }
        },
        "copy"
      )
    );
    expect(
      state.draft!.building.furniture.map(
        (item) => resolveFurnitureRoom(state.draft!, item)?.floorElevation
      )
    ).toEqual([200, 0]);
    expect(state.draft!.building.furniture[1]).toMatchObject({
      width: 230,
      depth: 110,
      height: 95,
      rotation: 387.25
    });
    commit(deleteFurniture(state.draft!, { furnitureId: "copy" }));
    state = projectEditorReducer(
      state,
      editorSelectionChanged(
        createGeometrySelectionState([
          { kind: "FURNITURE", geometryId: "sofa" }
        ])
      )
    );
    const deleted = deleteRoom(state.draft!, {
      levelId: "ground",
      roomId: "study"
    });
    expect(deleted.ok).toBe(true);
    if (deleted.ok)
      state = projectEditorReducer(
        state,
        editingDraftReplaced(deleted.project)
      );
    expect(state.selection).toEqual([]);
  });
});
