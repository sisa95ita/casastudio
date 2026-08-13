import { describe, expect, it } from "vitest";

import { selectPolygon } from "../geometry-playground/geometry-selection-state";
import { demoProjectFixture } from "../test/demo-project-fixture";
import {
  cleanEditingSessionLeft,
  editingDraftReplaced,
  editingSessionEntered,
  editingSessionMarkedDirty,
  editorActiveLevelChanged,
  editorActiveToolChanged,
  editorSelectionChanged,
  initialProjectEditorState,
  projectEditorReducer,
  projectRouteChanged
} from "./project-editor-slice";

describe("Project editor state", () => {
  it("starts in authoritative View mode", () => {
    expect(projectEditorReducer(undefined, { type: "unknown" })).toEqual(
      initialProjectEditorState
    );
  });

  it("enters Edit from an independent authoritative Project clone", () => {
    const authoritativeProject = structuredClone(demoProjectFixture);
    const preferredLevelId = authoritativeProject.building.levels[0]!.id;
    const state = projectEditorReducer(
      undefined,
      editingSessionEntered({
        project: authoritativeProject,
        baseRevision: authoritativeProject.revision,
        preferredLevelId
      })
    );

    expect(state.mode).toBe("edit");
    expect(state.projectId).toBe(authoritativeProject.id);
    expect(state.baseRevision).toBe(authoritativeProject.revision);
    expect(state.draft).toEqual(authoritativeProject);
    expect(state.draft).not.toBe(authoritativeProject);
    expect(state.draft?.building).not.toBe(authoritativeProject.building);
    expect(state.draft?.building.levels[0]).not.toBe(
      authoritativeProject.building.levels[0]
    );
    expect(state.draft?.revision).toBe(state.baseRevision);
    expect(state.activeLevelId).toBe(preferredLevelId);
    expect(state.dirty).toBe(false);
    expect(state.selection).toEqual([]);
    expect(state.hover).toBeUndefined();
    expect(state.transient).toEqual({ interaction: null });
  });

  it("uses the first valid Level when the preferred View level is unavailable", () => {
    const state = projectEditorReducer(
      undefined,
      editingSessionEntered({
        project: demoProjectFixture,
        baseRevision: demoProjectFixture.revision,
        preferredLevelId: "missing-level"
      })
    );

    expect(state.activeLevelId).toBe(demoProjectFixture.building.levels[0]!.id);
  });

  it("supports a neutral active-tool state", () => {
    const editingState = projectEditorReducer(
      undefined,
      editingSessionEntered({
        project: demoProjectFixture,
        baseRevision: demoProjectFixture.revision
      })
    );

    expect(editingState.activeTool).toBeNull();
    expect(
      projectEditorReducer(editingState, editorActiveToolChanged("select"))
        .activeTool
    ).toBe("select");
    expect(
      projectEditorReducer(editingState, editorActiveToolChanged("pan"))
        .activeTool
    ).toBe("pan");
    expect(
      projectEditorReducer(editingState, editorActiveToolChanged(null))
        .activeTool
    ).toBeNull();
  });

  it("clears stale interaction state when a session is reinitialized", () => {
    let state = projectEditorReducer(
      undefined,
      editingSessionEntered({
        project: demoProjectFixture,
        baseRevision: demoProjectFixture.revision
      })
    );
    const selected = selectPolygon("polygon-one");
    state = projectEditorReducer(
      state,
      editorSelectionChanged({ selected: [selected], hovered: selected })
    );

    state = projectEditorReducer(
      state,
      editingSessionEntered({
        project: demoProjectFixture,
        baseRevision: demoProjectFixture.revision
      })
    );

    expect(state.selection).toEqual([]);
    expect(state.hover).toBeUndefined();
    expect(state.transient).toEqual({ interaction: null });
  });

  it("clears selection and transient state when the active Level changes", () => {
    const secondLevel = {
      ...demoProjectFixture.building.levels[0]!,
      id: "level-upper",
      name: "Upper"
    };
    const project = {
      ...demoProjectFixture,
      building: {
        ...demoProjectFixture.building,
        levels: [...demoProjectFixture.building.levels, secondLevel]
      }
    };
    let state = projectEditorReducer(
      undefined,
      editingSessionEntered({ project, baseRevision: project.revision })
    );
    const selected = selectPolygon("polygon-one");
    state = projectEditorReducer(
      state,
      editorSelectionChanged({ selected: [selected], hovered: selected })
    );
    state = projectEditorReducer(
      state,
      editorActiveLevelChanged(secondLevel.id)
    );

    expect(state.activeLevelId).toBe(secondLevel.id);
    expect(state.selection).toEqual([]);
    expect(state.hover).toBeUndefined();
    expect(state.transient).toEqual({ interaction: null });
  });

  it("leaves a clean Edit session but preserves a dirty session", () => {
    const editingState = projectEditorReducer(
      undefined,
      editingSessionEntered({
        project: demoProjectFixture,
        baseRevision: demoProjectFixture.revision
      })
    );

    expect(
      projectEditorReducer(editingState, cleanEditingSessionLeft())
    ).toEqual(initialProjectEditorState);

    const dirtyState = projectEditorReducer(
      editingState,
      editingSessionMarkedDirty()
    );
    expect(projectEditorReducer(dirtyState, cleanEditingSessionLeft())).toEqual(
      dirtyState
    );
  });

  it("accepts committed draft changes while preserving server-owned fields", () => {
    const editingState = projectEditorReducer(
      undefined,
      editingSessionEntered({
        project: demoProjectFixture,
        baseRevision: demoProjectFixture.revision
      })
    );
    const changedDraft = { ...demoProjectFixture, name: "Locally renamed" };
    const nextState = projectEditorReducer(
      editingState,
      editingDraftReplaced(changedDraft)
    );

    expect(nextState.draft?.name).toBe("Locally renamed");
    expect(nextState.dirty).toBe(true);
    expect(nextState.draft?.id).toBe(demoProjectFixture.id);
    expect(nextState.draft?.revision).toBe(demoProjectFixture.revision);
    expect(nextState.draft?.createdAt).toBe(demoProjectFixture.createdAt);
    expect(nextState.draft?.updatedAt).toBe(demoProjectFixture.updatedAt);
  });

  it("rejects a draft replacement that changes a server-owned field", () => {
    const editingState = projectEditorReducer(
      undefined,
      editingSessionEntered({
        project: demoProjectFixture,
        baseRevision: demoProjectFixture.revision
      })
    );
    const invalidDraft = {
      ...demoProjectFixture,
      revision: demoProjectFixture.revision + 1
    };

    expect(
      projectEditorReducer(editingState, editingDraftReplaced(invalidDraft))
    ).toEqual(editingState);
  });

  it("clears a clean stale route session but keeps dirty work available to the guard", () => {
    const editingState = projectEditorReducer(
      undefined,
      editingSessionEntered({
        project: demoProjectFixture,
        baseRevision: demoProjectFixture.revision
      })
    );

    expect(
      projectEditorReducer(editingState, projectRouteChanged("project-two"))
    ).toEqual(initialProjectEditorState);

    const dirtyState = projectEditorReducer(
      editingState,
      editingSessionMarkedDirty()
    );
    expect(
      projectEditorReducer(dirtyState, projectRouteChanged("project-two"))
    ).toEqual(dirtyState);
  });
});
