import {
  createSelector,
  createSlice,
  type PayloadAction
} from "@reduxjs/toolkit";
import type { Project, WallEndpoint } from "@casastudio/schema";
import type { WorldPointXZ } from "../geometry-playground/viewport-transform-2d";

import type {
  GeometrySelection,
  GeometrySelectionState
} from "../geometry-playground/geometry-selection-state";
import type { RootState } from "./store";
import type { ProjectEditorTool } from "./project-editor-tools";
import type { DrawWallSnapCandidate } from "./project-wall-snapping";

/** Mutually exclusive interaction modes for the 2D Project workspace. */
export type ProjectWorkspaceMode = "view" | "edit";

/** Describes an unfinished Wall segment that has not entered the Project draft. */
export type DrawWallInteraction = {
  readonly kind: "draw-wall";
  readonly startPoint: WorldPointXZ;
  readonly currentPointerPoint: WorldPointXZ;
  readonly startConnectionWallId?: string;
};

/** Describes a Wall endpoint proposal that has not entered the Project draft. */
export type MoveWallEndpointInteraction = {
  readonly kind: "move-wall-endpoint";
  readonly levelId: string;
  readonly wallId: string;
  readonly endpoint: WallEndpoint;
  readonly pointerId: number;
  readonly currentPointerPoint: WorldPointXZ;
};

/** Editor-only pointer state cleared at stable session boundaries. */
export type ProjectEditorTransientState = {
  readonly interaction:
    DrawWallInteraction | MoveWallEndpointInteraction | null;
  readonly snapCandidate?: DrawWallSnapCandidate;
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
    editingSessionEnded(state, action: PayloadAction<string>) {
      if (state.mode === "edit" && state.projectId === action.payload) {
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
      if (state.mode === "edit" && state.activeTool !== action.payload) {
        state.activeTool = action.payload;
        state.selection = [];
        state.hover = undefined;
        state.transient = { interaction: null };
      }
    },
    editorDrawWallStarted(
      state,
      action: PayloadAction<{
        readonly point: WorldPointXZ;
        readonly snapCandidate?: DrawWallSnapCandidate;
      }>
    ) {
      if (state.mode === "edit" && state.activeTool === "draw-wall") {
        state.transient.interaction = {
          kind: "draw-wall",
          startPoint: action.payload.point,
          currentPointerPoint: action.payload.point,
          startConnectionWallId:
            action.payload.snapCandidate?.kind === "wall-interior"
              ? action.payload.snapCandidate.wallId
              : undefined
        };
        state.transient.snapCandidate = action.payload.snapCandidate;
      }
    },
    editorEndpointDragStarted(
      state,
      action: PayloadAction<{
        readonly levelId: string;
        readonly wallId: string;
        readonly endpoint: WallEndpoint;
        readonly pointerId: number;
        readonly point: WorldPointXZ;
      }>
    ) {
      if (state.mode === "edit" && state.activeTool === "select") {
        state.transient.interaction = {
          kind: "move-wall-endpoint",
          levelId: action.payload.levelId,
          wallId: action.payload.wallId,
          endpoint: action.payload.endpoint,
          pointerId: action.payload.pointerId,
          currentPointerPoint: action.payload.point
        };
      }
    },
    editorTransientPointerMoved(
      state,
      action: PayloadAction<{
        readonly point: WorldPointXZ;
        readonly pointerId: number;
      }>
    ) {
      const interaction = state.transient.interaction;
      if (
        interaction?.kind === "draw-wall" ||
        (interaction?.kind === "move-wall-endpoint" &&
          interaction.pointerId === action.payload.pointerId)
      ) {
        interaction.currentPointerPoint = action.payload.point;
      }
    },
    editorDrawWallPointerMoved(
      state,
      action: PayloadAction<{
        readonly point: WorldPointXZ;
        readonly snapCandidate?: DrawWallSnapCandidate;
      }>
    ) {
      if (state.mode !== "edit" || state.activeTool !== "draw-wall") return;
      state.transient.snapCandidate = action.payload.snapCandidate;
      if (state.transient.interaction?.kind === "draw-wall") {
        state.transient.interaction.currentPointerPoint = action.payload.point;
      }
    },
    editorTransientInteractionCleared(state) {
      if (state.mode === "edit") {
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
  editingSessionEnded,
  editingSessionMarkedDirty,
  editingDraftReplaced,
  editorActiveLevelChanged,
  editorActiveToolChanged,
  editorDrawWallStarted,
  editorDrawWallPointerMoved,
  editorEndpointDragStarted,
  editorTransientPointerMoved,
  editorTransientInteractionCleared,
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
