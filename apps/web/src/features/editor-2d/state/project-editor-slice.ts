import type { FurnitureInteraction } from "../tools/furniture/project-furniture-authoring";
import {
  createSelector,
  createSlice,
  type PayloadAction
} from "@reduxjs/toolkit";
import {
  architecturalScaleDenominators,
  type ArchitecturalScaleDenominator
} from "@casastudio/geometry";
import type {
  Project,
  RoomType,
  RoomShapeDefinition,
  WallEndpoint
} from "@casastudio/schema";
import type { WorldPointXZ } from "../../geometry-2d/viewport/viewport-transform-2d";

import type {
  GeometrySelection,
  GeometrySelectionState
} from "../../geometry-2d/selection/geometry-selection-state";
import { createGeometrySelectionState } from "../../geometry-2d/selection/geometry-selection-state";
import type { RootState } from "../../../app/store/store";
import type { ProjectEditorTool } from "./project-editor-tools";
import type { DrawWallSnapCandidate } from "../tools/wall/project-wall-snapping";
import type { PrecisionTranslationResult } from "../../geometry-2d/precision/precision-assistance-2d";
import type { OpeningPlacementCandidate } from "../tools/opening/project-opening-editing";
import {
  defaultStairAuthoringParameters,
  type StairAuthoringParameters,
  type StairTemplate
} from "../tools/stair/project-stair-authoring";

/** Mutually exclusive interaction modes for the 2D Project workspace. */
export type ProjectWorkspaceMode = "view" | "edit";

/** Describes an unfinished Wall segment that has not entered the Project draft. */
export type DrawWallInteraction = {
  readonly kind: "draw-wall";
  readonly startPoint: WorldPointXZ;
  readonly currentPointerPoint: WorldPointXZ;
  readonly startConnectionWallIds: readonly string[];
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

/** Describes a shared junction proposal that has not entered the Project draft. */
export type MoveJunctionInteraction = {
  readonly kind: "move-junction";
  readonly levelId: string;
  readonly position: WorldPointXZ;
  readonly incidentWallIds: readonly string[];
  readonly pointerId: number;
  readonly currentPointerPoint: WorldPointXZ;
};

/** Editable physical defaults owned by one transient Opening tool session. */
export type OpeningAuthoringProperties = {
  readonly width: number;
  readonly height: number;
  readonly elevation: number;
  readonly hingeSide?: "START" | "END";
  readonly swingSide?: "LEFT" | "RIGHT";
};

/** Opening kinds supported by transient placement authoring. */
export type OpeningAuthoringType = "DOOR" | "WINDOW" | "OPENING";

/** Describes an Opening proposal that has not entered Project history. */
export type PlaceOpeningInteraction = {
  readonly kind: "place-opening";
  readonly openingType: OpeningAuthoringType;
  readonly properties: OpeningAuthoringProperties;
  readonly candidate?: OpeningPlacementCandidate;
};

/** Describes a point-on-Wall split proposal that has not entered history. */
export type AddWallVertexInteraction = {
  readonly kind: "add-wall-vertex";
  readonly levelId: string;
  readonly wallId: string;
  readonly splitPoint?: WorldPointXZ;
};

/** Describes an Opening drag constrained to its owning Wall. */
export type MoveOpeningInteraction = {
  readonly kind: "move-opening";
  readonly levelId: string;
  readonly wallId: string;
  readonly openingId: string;
  readonly pointerId: number;
  readonly currentOffsetFromStart: number;
  readonly dragging: boolean;
  readonly valid: boolean;
};

/** Describes a temporary two-point ruler that never enters the Project draft. */
export type MeasureInteraction = {
  readonly kind: "measure";
  readonly startPoint: WorldPointXZ;
  readonly currentPointerPoint: WorldPointXZ;
  readonly completed: boolean;
};

/** Authoring-only Room footprint state that never enters the Project draft. */
export type PlaceRoomShapeInteraction = {
  readonly kind: "place-room-shape";
  readonly levelId: string;
  readonly boundaryKind: "WALLS" | "FREE";
  readonly elevation: number;
  readonly roomType: RoomType;
  readonly shape: RoomShapeDefinition;
  readonly origin?: WorldPointXZ;
};

/** Complete pointer-following Staircase proposal that has not entered Project history. */
export type PlaceStairInteraction = {
  readonly kind: "place-stair";
  readonly owningLevelId: string;
  readonly toLevelId?: string;
  readonly toRoomId?: string;
  readonly template?: StairTemplate;
  readonly parameters: StairAuthoringParameters;
  readonly identifiers?: {
    readonly staircaseId: string;
    readonly flightIds: readonly string[];
    readonly landingIds: readonly string[];
  };
  readonly start?: WorldPointXZ;
  readonly control?: WorldPointXZ;
  readonly turnDirection: "LEFT" | "RIGHT";
};

/** One root Staircase template adjustment preview committed on pointer release. */
export type MoveStairAdjustmentInteraction = {
  readonly kind: "move-stair-adjustment";
  readonly owningLevelId: string;
  readonly staircaseId: string;
  readonly pointerId: number;
  readonly control: WorldPointXZ;
};

/** Rigid plan translation preview for one committed Staircase aggregate. */
export type MoveStairTranslationInteraction = {
  readonly kind: "move-stair-translation";
  readonly owningLevelId: string;
  readonly staircaseId: string;
  readonly pointerId: number;
  readonly startPointer: WorldPointXZ;
  readonly currentPointer: WorldPointXZ;
  readonly precision?: PrecisionTranslationResult;
};

/** Rigid preview delta for one validated canonical selection. */
export type TranslateSelectionInteraction = {
  readonly kind: "translate-selection";
  readonly pointerId: number;
  readonly startPointer: WorldPointXZ;
  readonly currentPointer: WorldPointXZ;
  readonly precision?: PrecisionTranslationResult;
};

/** Editor-only pointer state cleared at stable session boundaries. */
export type ProjectEditorTransientState = {
  readonly interaction:
    | DrawWallInteraction
    | MoveWallEndpointInteraction
    | MoveJunctionInteraction
    | PlaceOpeningInteraction
    | AddWallVertexInteraction
    | MoveOpeningInteraction
    | MeasureInteraction
    | PlaceRoomShapeInteraction
    | PlaceStairInteraction
    | MoveStairAdjustmentInteraction
    | MoveStairTranslationInteraction
    | TranslateSelectionInteraction
    | FurnitureInteraction
    | null;
  readonly snapCandidate?: DrawWallSnapCandidate;
};

/** Session-local precision assistance preferences expressed in Project units. */
export type ProjectEditorPrecisionState = {
  readonly gridVisible: boolean;
  readonly snapToGrid: boolean;
  readonly gridSpacing: number;
};

/** Visibility preferences for derived architectural measurement layers. */
export type ProjectDimensionDisplayState = {
  readonly overallDimensions: boolean;
  readonly selectedDimensions: boolean;
  readonly roomMetrics: boolean;
};

/** Session-local document presentation settings independent from viewport state. */
export type ProjectEditorPresentationState = {
  readonly scaleDenominator: ArchitecturalScaleDenominator;
  readonly dimensions: ProjectDimensionDisplayState;
};

/** Bounded history of meaningful complete-Project draft commits. */
export type ProjectEditorHistoryState = {
  readonly past: readonly Project[];
  readonly future: readonly Project[];
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
  readonly precision: ProjectEditorPrecisionState;
  readonly presentation: ProjectEditorPresentationState;
  readonly history: ProjectEditorHistoryState;
};

/** Maximum number of complete draft snapshots retained in one edit session. */
export const projectEditorHistoryLimit = 50;

/** Default precision assistance for a newly entered edit session. */
export const defaultProjectEditorPrecision: ProjectEditorPrecisionState =
  Object.freeze({
    gridVisible: false,
    snapToGrid: false,
    gridSpacing: 100
  });

/** Default architectural presentation for a newly entered edit session. */
export const defaultProjectEditorPresentation: ProjectEditorPresentationState =
  Object.freeze({
    scaleDenominator: 75,
    dimensions: Object.freeze({
      overallDimensions: true,
      selectedDimensions: true,
      roomMetrics: true
    })
  });

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
  transient: { interaction: null },
  precision: defaultProjectEditorPrecision,
  presentation: defaultProjectEditorPresentation,
  history: { past: [], future: [] }
};

type EnterEditingPayload = {
  readonly project: Project;
  readonly baseRevision: number;
  readonly preferredLevelId?: string;
};

/** Creates deterministic, Project-unit defaults for a new Opening tool session. */
export function createOpeningAuthoringInteraction(
  openingType: OpeningAuthoringType
): PlaceOpeningInteraction {
  return {
    kind: "place-opening",
    openingType,
    properties:
      openingType === "DOOR"
        ? {
            width: 90,
            height: 210,
            elevation: 0,
            hingeSide: "START",
            swingSide: "LEFT"
          }
        : openingType === "WINDOW"
          ? { width: 120, height: 120, elevation: 90 }
          : { width: 120, height: 210, elevation: 0 }
  };
}

const projectEditorSlice = createSlice({
  name: "projectEditor",
  initialState: initialProjectEditorState,
  reducers: {
    editingSessionEntered: {
      prepare(payload: EnterEditingPayload) {
        return {
          payload: {
            projectId: payload.project.id,
            draft: cloneProject(payload.project),
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
        state.activeTool = "select";
        state.selection = [];
        state.hover = undefined;
        state.transient = { interaction: null };
        state.precision = { ...defaultProjectEditorPrecision };
        state.presentation = {
          ...defaultProjectEditorPresentation,
          dimensions: { ...defaultProjectEditorPresentation.dimensions }
        };
        state.history = { past: [], future: [] };
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
      if (JSON.stringify(state.draft) === JSON.stringify(nextDraft)) {
        return;
      }

      state.history.past = [
        ...state.history.past,
        cloneProject(state.draft)
      ].slice(-projectEditorHistoryLimit);
      state.history.future = [];
      state.draft = cloneProject(nextDraft);
      state.selection = state.selection.filter(
        (selection) =>
          selection.kind !== "FURNITURE" ||
          nextDraft.building.furniture.some(
            (item) => item.id === selection.geometryId
          )
      );
      if (
        state.hover?.kind === "FURNITURE" &&
        !nextDraft.building.furniture.some(
          (item) => item.id === state.hover?.geometryId
        )
      )
        state.hover = undefined;
      state.dirty = true;
      if (
        state.transient.interaction?.kind === "place-opening" ||
        state.transient.interaction?.kind === "place-room-shape" ||
        state.transient.interaction?.kind === "place-stair"
      ) {
        state.transient = { interaction: null };
      }
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
    editorUndoRequested(state) {
      if (
        state.mode !== "edit" ||
        !state.draft ||
        state.history.past.length === 0
      )
        return;
      const previous = state.history.past.at(-1);
      if (!previous) return;
      state.history.future = [
        cloneProject(state.draft),
        ...state.history.future
      ].slice(0, projectEditorHistoryLimit);
      state.history.past = state.history.past.slice(0, -1);
      state.draft = cloneProject(previous);
      state.dirty = state.history.past.length > 0;
      state.selection = [];
      state.hover = undefined;
      state.transient = { interaction: null };
    },
    editorRedoRequested(state) {
      if (
        state.mode !== "edit" ||
        !state.draft ||
        state.history.future.length === 0
      )
        return;
      const next = state.history.future[0];
      if (!next) return;
      state.history.past = [
        ...state.history.past,
        cloneProject(state.draft)
      ].slice(-projectEditorHistoryLimit);
      state.history.future = state.history.future.slice(1);
      state.draft = cloneProject(next);
      state.dirty = true;
      state.selection = [];
      state.hover = undefined;
      state.transient = { interaction: null };
    },
    editorGridVisibilityChanged(state, action: PayloadAction<boolean>) {
      if (state.mode === "edit") state.precision.gridVisible = action.payload;
    },
    editorGridSnappingChanged(state, action: PayloadAction<boolean>) {
      if (state.mode === "edit") state.precision.snapToGrid = action.payload;
    },
    editorGridSpacingChanged(state, action: PayloadAction<number>) {
      if (
        state.mode === "edit" &&
        Number.isFinite(action.payload) &&
        action.payload > 0
      ) {
        state.precision.gridSpacing = action.payload;
      }
    },
    editorDocumentScaleChanged(
      state,
      action: PayloadAction<ArchitecturalScaleDenominator>
    ) {
      if (
        state.mode === "edit" &&
        architecturalScaleDenominators.includes(action.payload)
      ) {
        state.presentation.scaleDenominator = action.payload;
      }
    },
    editorDimensionDisplayChanged(
      state,
      action: PayloadAction<Partial<ProjectDimensionDisplayState>>
    ) {
      if (state.mode === "edit") {
        state.presentation.dimensions = {
          ...state.presentation.dimensions,
          ...action.payload
        };
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
        const openingType = action.payload === "openings" ? "DOOR" : undefined;
        state.transient = {
          interaction: openingType
            ? createOpeningAuthoringInteraction(openingType)
            : action.payload === "stair" && state.activeLevelId
              ? {
                  kind: "place-stair",
                  owningLevelId: state.activeLevelId,
                  parameters: { ...defaultStairAuthoringParameters },
                  turnDirection: "LEFT"
                }
              : null
        };
      }
    },
    editorToolToggled(state, action: PayloadAction<ProjectEditorTool>) {
      if (state.mode !== "edit") return;
      const requested = action.payload;
      if (requested === "select") {
        state.activeTool = "select";
        state.transient = { interaction: null };
        return;
      }
      if (state.activeTool === requested) {
        state.activeTool = "select";
        state.hover = undefined;
        state.transient = { interaction: null };
        return;
      }
      state.activeTool = requested;
      state.selection = [];
      state.hover = undefined;
      state.transient = {
        interaction:
          requested === "openings"
            ? createOpeningAuthoringInteraction("DOOR")
            : requested === "stair" && state.activeLevelId
              ? {
                  kind: "place-stair",
                  owningLevelId: state.activeLevelId,
                  parameters: { ...defaultStairAuthoringParameters },
                  turnDirection: "LEFT"
                }
              : null
      };
    },
    editorFurnitureChanged(state, action: PayloadAction<FurnitureInteraction>) {
      if (state.mode === "edit")
        state.transient = { interaction: action.payload };
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
          startConnectionWallIds:
            action.payload.snapCandidate?.kind === "wall-interior" ||
            action.payload.snapCandidate?.kind === "wall-midpoint"
              ? [action.payload.snapCandidate.wallId]
              : action.payload.snapCandidate?.kind === "wall-intersection"
                ? [...action.payload.snapCandidate.wallIds]
                : []
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
    editorJunctionDragStarted(
      state,
      action: PayloadAction<{
        readonly levelId: string;
        readonly position: WorldPointXZ;
        readonly incidentWallIds: readonly string[];
        readonly pointerId: number;
      }>
    ) {
      if (state.mode === "edit" && state.activeTool === "select") {
        state.transient.interaction = {
          kind: "move-junction",
          levelId: action.payload.levelId,
          position: action.payload.position,
          incidentWallIds: [...action.payload.incidentWallIds],
          pointerId: action.payload.pointerId,
          currentPointerPoint: action.payload.position
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
        ((interaction?.kind === "move-wall-endpoint" ||
          interaction?.kind === "move-junction") &&
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
    editorMeasurementPointSet(
      state,
      action: PayloadAction<{
        readonly point: WorldPointXZ;
        readonly snapCandidate?: DrawWallSnapCandidate;
      }>
    ) {
      if (state.mode !== "edit" || state.activeTool !== "measure") return;
      const interaction = state.transient.interaction;
      state.transient.snapCandidate = action.payload.snapCandidate;
      if (interaction?.kind === "measure" && !interaction.completed) {
        interaction.currentPointerPoint = action.payload.point;
        interaction.completed = true;
      } else {
        state.transient.interaction = {
          kind: "measure",
          startPoint: action.payload.point,
          currentPointerPoint: action.payload.point,
          completed: false
        };
      }
    },
    editorMeasurementPointerMoved(
      state,
      action: PayloadAction<{
        readonly point: WorldPointXZ;
        readonly snapCandidate?: DrawWallSnapCandidate;
      }>
    ) {
      if (state.mode !== "edit" || state.activeTool !== "measure") return;
      state.transient.snapCandidate = action.payload.snapCandidate;
      if (
        state.transient.interaction?.kind === "measure" &&
        !state.transient.interaction.completed
      ) {
        state.transient.interaction.currentPointerPoint = action.payload.point;
      }
    },
    editorRoomShapePlacementStarted(
      state,
      action: PayloadAction<{
        readonly levelId: string;
        readonly shape: RoomShapeDefinition;
        readonly boundaryKind?: "WALLS" | "FREE";
        readonly elevation?: number;
        readonly roomType?: RoomType;
      }>
    ) {
      if (
        state.mode === "edit" &&
        state.activeTool === "room" &&
        state.activeLevelId === action.payload.levelId
      ) {
        state.selection = [];
        state.hover = undefined;
        state.transient = {
          interaction: {
            kind: "place-room-shape",
            levelId: action.payload.levelId,
            boundaryKind: action.payload.boundaryKind ?? "WALLS",
            elevation: action.payload.elevation ?? 0,
            roomType: action.payload.roomType ?? "OTHER",
            shape: action.payload.shape
          }
        };
      }
    },
    editorRoomShapePlacementChanged(
      state,
      action: PayloadAction<RoomShapeDefinition>
    ) {
      if (state.transient.interaction?.kind === "place-room-shape") {
        state.transient.interaction.shape = action.payload;
      }
    },
    editorRoomShapeElevationChanged(state, action: PayloadAction<number>) {
      if (
        state.transient.interaction?.kind === "place-room-shape" &&
        Number.isFinite(action.payload)
      ) {
        state.transient.interaction.elevation = action.payload;
        state.transient.interaction.boundaryKind =
          action.payload === 0 ? "WALLS" : "FREE";
      }
    },
    editorRoomShapePlacementPointerMoved(
      state,
      action: PayloadAction<WorldPointXZ>
    ) {
      if (state.transient.interaction?.kind === "place-room-shape") {
        state.transient.interaction.origin = action.payload;
      }
    },
    editorStairAuthoringChanged(
      state,
      action: PayloadAction<
        Partial<Omit<PlaceStairInteraction, "kind" | "owningLevelId">>
      >
    ) {
      const interaction = state.transient.interaction;
      if (
        state.mode !== "edit" ||
        state.activeTool !== "stair" ||
        interaction?.kind !== "place-stair"
      )
        return;
      Object.assign(interaction, action.payload);
    },
    editorStairPlacementPointSet(state, action: PayloadAction<WorldPointXZ>) {
      const interaction = state.transient.interaction;
      if (
        state.mode !== "edit" ||
        state.activeTool !== "stair" ||
        interaction?.kind !== "place-stair" ||
        !interaction.toLevelId ||
        !interaction.template ||
        !interaction.identifiers
      )
        return;
      interaction.start = action.payload;
      interaction.control = action.payload;
    },
    editorStairPlacementPointerMoved(
      state,
      action: PayloadAction<WorldPointXZ>
    ) {
      const interaction = state.transient.interaction;
      if (interaction?.kind === "place-stair") {
        interaction.start = action.payload;
        interaction.control = action.payload;
      }
    },
    editorStairAdjustmentStarted(
      state,
      action: PayloadAction<{
        readonly owningLevelId: string;
        readonly staircaseId: string;
        readonly pointerId: number;
        readonly control: WorldPointXZ;
      }>
    ) {
      if (state.mode === "edit" && state.activeTool === "select") {
        state.transient.interaction = {
          kind: "move-stair-adjustment",
          ...action.payload
        };
      }
    },
    editorStairAdjustmentPointerMoved(
      state,
      action: PayloadAction<{
        readonly pointerId: number;
        readonly control: WorldPointXZ;
      }>
    ) {
      const interaction = state.transient.interaction;
      if (
        interaction?.kind === "move-stair-adjustment" &&
        interaction.pointerId === action.payload.pointerId
      ) {
        interaction.control = action.payload.control;
      }
    },
    editorStairTranslationStarted(
      state,
      action: PayloadAction<
        Omit<MoveStairTranslationInteraction, "kind" | "currentPointer">
      >
    ) {
      if (state.mode === "edit" && state.activeTool === "select") {
        state.transient.interaction = {
          kind: "move-stair-translation",
          ...action.payload,
          currentPointer: action.payload.startPointer
        };
      }
    },
    editorStairTranslationPointerMoved(
      state,
      action: PayloadAction<{
        readonly pointerId: number;
        readonly point: WorldPointXZ;
        readonly precision?: PrecisionTranslationResult;
      }>
    ) {
      const interaction = state.transient.interaction;
      if (
        interaction?.kind === "move-stair-translation" &&
        interaction.pointerId === action.payload.pointerId
      ) {
        interaction.currentPointer = action.payload.point;
        interaction.precision = action.payload.precision;
      }
    },
    editorSelectionTranslationStarted(
      state,
      action: PayloadAction<
        Omit<TranslateSelectionInteraction, "kind" | "currentPointer">
      >
    ) {
      if (
        state.mode === "edit" &&
        state.activeTool === "select" &&
        state.selection.length > 0
      ) {
        state.transient.interaction = {
          kind: "translate-selection",
          ...action.payload,
          currentPointer: action.payload.startPointer
        };
      }
    },
    editorSelectionTranslationPointerMoved(
      state,
      action: PayloadAction<{
        readonly pointerId: number;
        readonly point: WorldPointXZ;
        readonly precision?: PrecisionTranslationResult;
      }>
    ) {
      const interaction = state.transient.interaction;
      if (
        interaction?.kind === "translate-selection" &&
        interaction.pointerId === action.payload.pointerId
      ) {
        interaction.currentPointer = action.payload.point;
        interaction.precision = action.payload.precision;
      }
    },
    editorOpeningPlacementChanged(
      state,
      action: PayloadAction<{
        readonly openingType: OpeningAuthoringType;
        readonly properties?: OpeningAuthoringProperties;
        readonly candidate?: OpeningPlacementCandidate;
      }>
    ) {
      if (state.mode === "edit" && state.activeTool === "openings") {
        const current = state.transient.interaction;
        state.transient.interaction = {
          kind: "place-opening",
          openingType: action.payload.openingType,
          properties:
            action.payload.properties ??
            (current?.kind === "place-opening" &&
            current.openingType === action.payload.openingType
              ? current.properties
              : createOpeningAuthoringInteraction(action.payload.openingType)
                  .properties),
          candidate: action.payload.candidate
        };
      }
    },
    editorOpeningAuthoringTypeChanged(
      state,
      action: PayloadAction<OpeningAuthoringType>
    ) {
      if (state.mode !== "edit" || state.activeTool !== "openings") return;
      state.transient = {
        interaction: createOpeningAuthoringInteraction(action.payload)
      };
    },
    editorRoomAuthoringTypeChanged(state, action: PayloadAction<RoomType>) {
      if (state.transient.interaction?.kind === "place-room-shape") {
        state.transient.interaction.roomType = action.payload;
      }
    },
    editorOpeningAuthoringPropertiesChanged(
      state,
      action: PayloadAction<Partial<OpeningAuthoringProperties>>
    ) {
      if (state.transient.interaction?.kind === "place-opening") {
        state.transient.interaction.properties = {
          ...state.transient.interaction.properties,
          ...action.payload
        };
        state.transient.interaction.candidate = undefined;
      }
    },
    editorWallVertexPlacementStarted(
      state,
      action: PayloadAction<{
        readonly levelId: string;
        readonly wallId: string;
      }>
    ) {
      if (state.mode === "edit" && state.activeTool === "select") {
        state.transient = {
          interaction: {
            kind: "add-wall-vertex",
            levelId: action.payload.levelId,
            wallId: action.payload.wallId
          }
        };
      }
    },
    editorWallVertexPlacementChanged(
      state,
      action: PayloadAction<WorldPointXZ | undefined>
    ) {
      if (state.transient.interaction?.kind === "add-wall-vertex") {
        state.transient.interaction.splitPoint = action.payload;
      }
    },
    editorOpeningDragStarted(
      state,
      action: PayloadAction<{
        readonly levelId: string;
        readonly wallId: string;
        readonly openingId: string;
        readonly pointerId: number;
        readonly offsetFromStart: number;
      }>
    ) {
      if (state.mode === "edit" && state.activeTool === "select") {
        state.transient.interaction = {
          kind: "move-opening",
          levelId: action.payload.levelId,
          wallId: action.payload.wallId,
          openingId: action.payload.openingId,
          pointerId: action.payload.pointerId,
          currentOffsetFromStart: action.payload.offsetFromStart,
          dragging: false,
          valid: true
        };
      }
    },
    editorOpeningDragThresholdCrossed(
      state,
      action: PayloadAction<{ readonly pointerId: number }>
    ) {
      const interaction = state.transient.interaction;
      if (
        interaction?.kind === "move-opening" &&
        interaction.pointerId === action.payload.pointerId
      ) {
        interaction.dragging = true;
      }
    },
    editorOpeningDragPreviewChanged(
      state,
      action: PayloadAction<{
        readonly pointerId: number;
        readonly offsetFromStart: number;
        readonly valid: boolean;
      }>
    ) {
      const interaction = state.transient.interaction;
      if (
        interaction?.kind === "move-opening" &&
        interaction.pointerId === action.payload.pointerId
      ) {
        interaction.currentOffsetFromStart = action.payload.offsetFromStart;
        interaction.valid = action.payload.valid;
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
        state.selection = createGeometrySelectionState(
          action.payload.selected
        ).selected.map((selection) => ({
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

/** Copies a JSON-compatible canonical Project without retaining Immer proxies. */
function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}

/** Focused actions for the local Project editing session. */
export const {
  editingSessionEntered,
  cleanEditingSessionLeft,
  editingSessionEnded,
  editingSessionMarkedDirty,
  editingDraftReplaced,
  editorFurnitureChanged,
  editorUndoRequested,
  editorRedoRequested,
  editorGridVisibilityChanged,
  editorGridSnappingChanged,
  editorGridSpacingChanged,
  editorDocumentScaleChanged,
  editorDimensionDisplayChanged,
  editorActiveLevelChanged,
  editorActiveToolChanged,
  editorToolToggled,
  editorDrawWallStarted,
  editorDrawWallPointerMoved,
  editorMeasurementPointSet,
  editorMeasurementPointerMoved,
  editorRoomShapePlacementStarted,
  editorRoomShapePlacementChanged,
  editorRoomShapeElevationChanged,
  editorRoomShapePlacementPointerMoved,
  editorStairAuthoringChanged,
  editorStairPlacementPointSet,
  editorStairPlacementPointerMoved,
  editorStairAdjustmentStarted,
  editorStairAdjustmentPointerMoved,
  editorStairTranslationStarted,
  editorStairTranslationPointerMoved,
  editorSelectionTranslationStarted,
  editorSelectionTranslationPointerMoved,
  editorOpeningPlacementChanged,
  editorOpeningAuthoringTypeChanged,
  editorOpeningAuthoringPropertiesChanged,
  editorRoomAuthoringTypeChanged,
  editorWallVertexPlacementStarted,
  editorWallVertexPlacementChanged,
  editorOpeningDragStarted,
  editorOpeningDragThresholdCrossed,
  editorOpeningDragPreviewChanged,
  editorEndpointDragStarted,
  editorJunctionDragStarted,
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

/** Whether the active edit session has a stable draft commit to undo. */
export const selectCanUndoProjectEdit = (state: RootState): boolean =>
  state.projectEditor.mode === "edit" &&
  state.projectEditor.history.past.length > 0;

/** Whether the active edit session has an undone draft commit to restore. */
export const selectCanRedoProjectEdit = (state: RootState): boolean =>
  state.projectEditor.mode === "edit" &&
  state.projectEditor.history.future.length > 0;

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
