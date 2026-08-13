import {
  createSelector,
  createSlice,
  type PayloadAction
} from "@reduxjs/toolkit";
import type { Project } from "@casastudio/schema";

import type {
  GeometrySelection,
  GeometrySelectionState
} from "../geometry-playground/geometry-selection-state";
import type { RootState } from "./store";
import type { ProjectEditorTool } from "./project-editor-tools";

/** Mutually exclusive interaction modes for the 2D Project workspace. */
export type ProjectWorkspaceMode = "view" | "edit";

/** Reserved editor interaction state that is cleared at stable session boundaries. */
export type ProjectEditorTransientState = {
  readonly interaction: null;
};

/** Local editing session derived from one authoritative Project revision. */
export type ProjectEditorState = {
  readonly mode: ProjectWorkspaceMode;
  readonly projectId: string | null;
  readonly draft: Project | null;
  readonly baseRevision: number | null;
  readonly dirty: boolean;
  readonly activeLevelId: string | null;
  readonly activeTool: ProjectEditorTool | null;
  readonly selection: readonly GeometrySelection[];
  readonly hover?: GeometrySelection;
  readonly transient: ProjectEditorTransientState;
};

/** Initial editor state before an explicit local editing session begins. */
export const initialProjectEditorState: ProjectEditorState = {
  mode: "view",
  projectId: null,
  draft: null,
  baseRevision: null,
  dirty: false,
  activeLevelId: null,
  activeTool: null,
  selection: [],
  hover: undefined,
  transient: { interaction: null }
};

type EnterEditingPayload = {
  readonly project: Project;
  readonly baseRevision: number;
  readonly preferredLevelId?: string;
};

const projectEditorSlice = createSlice({
  name: "projectEditor",
  initialState: initialProjectEditorState,
  reducers: {
    editingSessionEntered: {
      prepare(payload: EnterEditingPayload) {
        return {
          payload: {
            projectId: payload.project.id,
            draft: structuredClone(payload.project),
            baseRevision: payload.baseRevision,
            preferredLevelId: payload.preferredLevelId
          }
        };
      },
      reducer(
        state,
        action: PayloadAction<{
          readonly projectId: string;
          readonly draft: Project;
          readonly baseRevision: number;
          readonly preferredLevelId?: string;
        }>
      ) {
        if (action.payload.draft.revision !== action.payload.baseRevision) {
          return;
        }

        const levels = action.payload.draft.building.levels;
        const activeLevelId = levels.some(
          (level) => level.id === action.payload.preferredLevelId
        )
          ? action.payload.preferredLevelId!
          : (levels[0]?.id ?? null);

        state.mode = "edit";
        state.projectId = action.payload.projectId;
        state.draft = action.payload.draft;
        state.baseRevision = action.payload.baseRevision;
        state.dirty = false;
        state.activeLevelId = activeLevelId;
        state.activeTool = null;
        state.selection = [];
        state.hover = undefined;
        state.transient = { interaction: null };
      }
    },
    cleanEditingSessionLeft(state) {
      if (state.mode === "edit" && !state.dirty) {
        return initialProjectEditorState;
      }
    },
    editingSessionMarkedDirty(state) {
      if (state.mode === "edit" && state.draft) {
        state.dirty = true;
      }
    },
    editingDraftReplaced(state, action: PayloadAction<Project>) {
      if (!state.draft || state.baseRevision === null) {
        return;
      }

      const nextDraft = action.payload;
      if (
        !hasPreservedServerFields(state.draft, nextDraft, state.baseRevision)
      ) {
        return;
      }

      state.draft = structuredClone(nextDraft);
      state.dirty = true;
      if (
        !nextDraft.building.levels.some(
          (level) => level.id === state.activeLevelId
        )
      ) {
        state.activeLevelId = nextDraft.building.levels[0]?.id ?? null;
        state.selection = [];
        state.hover = undefined;
        state.transient = { interaction: null };
      }
    },
    editorActiveLevelChanged(state, action: PayloadAction<string>) {
      if (
        state.draft?.building.levels.some(
          (level) => level.id === action.payload
        ) &&
        state.activeLevelId !== action.payload
      ) {
        state.activeLevelId = action.payload;
        state.selection = [];
        state.hover = undefined;
        state.transient = { interaction: null };
      }
    },
    editorActiveToolChanged(
      state,
      action: PayloadAction<ProjectEditorTool | null>
    ) {
      if (state.mode === "edit") {
        state.activeTool = action.payload;
        state.hover = undefined;
        state.transient = { interaction: null };
      }
    },
    editorSelectionChanged(
      state,
      action: PayloadAction<GeometrySelectionState>
    ) {
      if (state.mode === "edit") {
        state.selection = action.payload.selected.map((selection) => ({
          ...selection
        }));
        state.hover = action.payload.hovered
          ? { ...action.payload.hovered }
          : undefined;
      }
    },
    editorSelectionCleared(state) {
      if (state.mode === "edit") {
        state.selection = [];
        state.hover = undefined;
      }
    },
    projectRouteChanged(state, action: PayloadAction<string>) {
      if (
        state.projectId &&
        state.projectId !== action.payload &&
        !state.dirty
      ) {
        return initialProjectEditorState;
      }
    },
    projectRouteExited(state, action: PayloadAction<string>) {
      if (state.projectId === action.payload && !state.dirty) {
        return initialProjectEditorState;
      }
    }
  }
});

/** Checks the server-managed fields that local editing operations must preserve. */
export function hasPreservedServerFields(
  base: Project,
  candidate: Project,
  baseRevision: number
): boolean {
  return (
    candidate.id === base.id &&
    candidate.revision === baseRevision &&
    candidate.createdAt === base.createdAt &&
    candidate.updatedAt === base.updatedAt
  );
}

/** Focused actions for the local Project editing session. */
export const {
  editingSessionEntered,
  cleanEditingSessionLeft,
  editingSessionMarkedDirty,
  editingDraftReplaced,
  editorActiveLevelChanged,
  editorActiveToolChanged,
  editorSelectionChanged,
  editorSelectionCleared,
  projectRouteChanged,
  projectRouteExited
} = projectEditorSlice.actions;

/** Reducer for local Project editing state. */
export const projectEditorReducer = projectEditorSlice.reducer;

/** Selects the complete local Project editing session. */
export const selectProjectEditor = (state: RootState): ProjectEditorState =>
  state.projectEditor;

/** Selects edit-mode geometry interaction state without copying the draft. */
export const selectEditorGeometrySelection = createSelector(
  [
    (state: RootState) => state.projectEditor.selection,
    (state: RootState) => state.projectEditor.hover
  ],
  (selected, hovered): GeometrySelectionState => ({ selected, hovered })
);

/** Whether a dirty session belongs to the active Project route. */
export const selectShouldProtectProjectNavigation = (
  state: RootState,
  projectId: string
): boolean =>
  state.projectEditor.mode === "edit" &&
  state.projectEditor.projectId === projectId &&
  state.projectEditor.dirty;
