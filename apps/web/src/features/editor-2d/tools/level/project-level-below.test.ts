import { describe, expect, it } from "vitest";

import { demoProjectFixture } from "../../../../test/demo-project-fixture";
import {
  editingDraftReplaced,
  editingSessionEntered,
  editorRedoRequested,
  editorUndoRequested,
  projectEditorReducer
} from "../../state/project-editor-slice";
import {
  canCreateFromLevelBelow,
  createFromLevelBelow,
  findNearestLowerLevel
} from "./project-level-below";

function projectWithEmptyUpperLevel() {
  const project = structuredClone(demoProjectFixture);
  project.building.levels.push({
    id: "upper",
    name: "First Floor",
    elevation: 300,
    walls: [],
    rooms: [],
    staircases: []
  });
  return project;
}

describe("Level-below authoring", () => {
  it("is actionable only for an empty upper Level above a Wall footprint", () => {
    const project = projectWithEmptyUpperLevel();
    expect(canCreateFromLevelBelow(project, "upper")).toBe(true);
    expect(
      canCreateFromLevelBelow(project, project.building.levels[0]!.id)
    ).toBe(false);

    project.building.levels.at(-1)!.rooms.push({
      id: "upper-room",
      name: "Upper Room",
      type: "OTHER",
      boundary: []
    });
    expect(canCreateFromLevelBelow(project, "upper")).toBe(false);
    project.building.levels.at(-1)!.rooms = [];
    project.building.levels
      .at(-1)!
      .walls.push(structuredClone(project.building.levels[0]!.walls[0]!));
    expect(canCreateFromLevelBelow(project, "upper")).toBe(false);
  });

  it("uses nearest lower global elevation instead of array position", () => {
    const project = projectWithEmptyUpperLevel();
    project.building.levels.splice(1, 0, {
      id: "middle",
      name: "Mezzanine",
      elevation: 180,
      walls: [],
      rooms: [],
      staircases: []
    });
    project.building.levels.reverse();

    expect(findNearestLowerLevel(project, "upper")?.id).toBe("middle");
    expect(
      findNearestLowerLevel(project, demoProjectFixture.building.levels[0]!.id)
    ).toBeUndefined();
  });

  it("copies only Walls with new IDs and validates one complete candidate", () => {
    const project = projectWithEmptyUpperLevel();
    const lower = project.building.levels[0]!;
    const sourceWalls = structuredClone(lower.walls);
    const ids = sourceWalls.map((_wall, index) => `wall-copied-${index}`);
    let index = 0;

    const result = createFromLevelBelow(project, "upper", () => ids[index++]!);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const upper = result.project.building.levels.find(
      (level) => level.id === "upper"
    )!;
    expect(upper.walls).toEqual(
      sourceWalls.map((wall, wallIndex) => ({
        id: ids[wallIndex],
        start: wall.start,
        end: wall.end,
        height: wall.height,
        thickness: wall.thickness,
        roomIds: [],
        openings: []
      }))
    );
    expect(upper.rooms).toEqual([]);
    expect(upper.staircases).toEqual([]);
    expect(result.project.building.furniture).toEqual(
      project.building.furniture
    );
    expect(result.project.building.levels[0]!.walls).toEqual(sourceWalls);
    expect(result.project).not.toBe(project);
  });

  it("commits the copied footprint as one undoable and redoable history action", () => {
    const project = projectWithEmptyUpperLevel();
    const copied = createFromLevelBelow(
      project,
      "upper",
      (() => {
        let index = 0;
        return () => `wall-history-${index++}`;
      })()
    );
    expect(copied.ok).toBe(true);
    if (!copied.ok) return;

    let state = projectEditorReducer(
      undefined,
      editingSessionEntered({
        project,
        baseRevision: project.revision,
        preferredLevelId: "upper"
      })
    );
    state = projectEditorReducer(state, editingDraftReplaced(copied.project));
    expect(state.dirty).toBe(true);
    expect(state.history.past).toHaveLength(1);
    expect(
      state.draft?.building.levels.find((level) => level.id === "upper")?.walls
    ).toHaveLength(project.building.levels[0]!.walls.length);

    state = projectEditorReducer(state, editorUndoRequested());
    expect(
      state.draft?.building.levels.find((level) => level.id === "upper")?.walls
    ).toEqual([]);
    expect(state.dirty).toBe(false);

    state = projectEditorReducer(state, editorRedoRequested());
    expect(
      state.draft?.building.levels.find((level) => level.id === "upper")?.walls
    ).toHaveLength(project.building.levels[0]!.walls.length);
    expect(state.dirty).toBe(true);
  });

  it("rejects populated targets and invalid candidates without mutation", () => {
    const populated = projectWithEmptyUpperLevel();
    populated.building.levels.at(-1)!.rooms.push({
      id: "draft-room",
      name: "Draft",
      type: "OTHER",
      boundary: []
    });
    const before = structuredClone(populated);
    expect(createFromLevelBelow(populated, "upper")).toEqual({
      ok: false,
      reason: "ACTIVE_LEVEL_POPULATED"
    });
    expect(populated).toEqual(before);

    const project = projectWithEmptyUpperLevel();
    const duplicateId = project.building.levels[0]!.walls[0]!.id;
    expect(createFromLevelBelow(project, "upper", () => duplicateId)).toEqual({
      ok: false,
      reason: "INVALID_PROJECT"
    });
    expect(project.building.levels.at(-1)!.walls).toEqual([]);
  });
});
