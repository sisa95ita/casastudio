import { calculatePolygonInteriorAnchor } from "@casastudio/geometry";
import {
  deriveRoomShapeVertices,
  formatArchitecturalLength,
  type Opening,
  type Point2D,
  type Project,
  type RoomShapeDefinition,
  type Wall
} from "@casastudio/schema";

import type { ProjectEditorState } from "../../editor-2d/state/project-editor-slice";
import { findProjectWall } from "../../editor-2d/tools/wall/project-wall-editing";
import { formatRoomShapePreviewLabel } from "../../editor-2d/tools/room/room-shape-authoring";
import {
  inferStairTemplate,
  type StairProposal
} from "../../editor-2d/tools/stair/project-stair-authoring";
import type { GeometrySelectionState } from "../../geometry-2d/selection/geometry-selection-state";
import type { GeometrySelectionFootprint } from "../../geometry-2d/selection/geometry-selection-spatial";
import type { GeometryEditorOverlay } from "../../geometry-2d/viewer/GeometrySvgViewer";
import type { ProjectWorkspaceMode } from "../../editor-2d/state/project-editor-slice";

type SelectedStair = NonNullable<
  ReturnType<
    typeof import("../../editor-2d/tools/stair/project-stair-authoring").findProjectStaircase
  >
>;

type EndpointAvailability = {
  readonly start: { readonly draggable: boolean };
  readonly end: { readonly draggable: boolean };
};

type ActionableRoomFace = {
  readonly key: string;
  readonly vertices: readonly Point2D[];
};

type CreateProjectWorkspaceOverlayOptions = {
  readonly workspaceMode: ProjectWorkspaceMode;
  readonly editor: ProjectEditorState;
  readonly selectedEditWall?: Wall;
  readonly selectedEditOpening?: {
    readonly wall: Wall;
    readonly opening: Opening;
  };
  readonly selectedEditVertex?: {
    readonly coordinates: { readonly x: number; readonly z: number };
  };
  readonly selectedJunctionWallIds: readonly string[];
  readonly selectedWallEndpointAvailability?: EndpointAvailability;
  readonly actionableRoomFaces: readonly ActionableRoomFace[];
  readonly activeProject?: Project | null;
  readonly roomDetectionActive: boolean;
  readonly stairProposal?: StairProposal;
  readonly stairAdjustmentProposal?: StairProposal;
  readonly translatedStaircase?: SelectedStair["staircase"];
  readonly selectedStair?: SelectedStair;
  readonly selectionState: GeometrySelectionState;
  readonly selectionFootprints: readonly GeometrySelectionFootprint[];
  readonly validatedRoomShape?: RoomShapeDefinition;
  readonly roomPlacementValid: boolean;
  readonly validRoomElevation?: number;
};

/** Creates the transient 2D overlay presented above the authoritative editor model. */
export function createProjectWorkspaceOverlay({
  workspaceMode,
  editor,
  selectedEditWall,
  selectedEditOpening,
  selectedEditVertex,
  selectedJunctionWallIds,
  selectedWallEndpointAvailability,
  actionableRoomFaces,
  activeProject,
  roomDetectionActive,
  stairProposal,
  stairAdjustmentProposal,
  translatedStaircase,
  selectedStair,
  selectionState,
  selectionFootprints,
  validatedRoomShape,
  roomPlacementValid,
  validRoomElevation
}: CreateProjectWorkspaceOverlayOptions): GeometryEditorOverlay | undefined {
  if (workspaceMode !== "edit") return undefined;
  const transient = editor.transient.interaction;
  const selectedWall = selectedEditWall
    ? {
        wallId: selectedEditWall.id,
        endpointEditingAvailable: {
          start: selectedWallEndpointAvailability?.start.draggable ?? false,
          end: selectedWallEndpointAvailability?.end.draggable ?? false
        },
        start:
          transient?.kind === "move-wall-endpoint" &&
          transient.wallId === selectedEditWall.id &&
          transient.endpoint === "start"
            ? transient.currentPointerPoint
            : transient?.kind === "move-junction" &&
                selectedEditWall.start.x === transient.position.x &&
                selectedEditWall.start.z === transient.position.z
              ? transient.currentPointerPoint
              : selectedEditWall.start,
        end:
          transient?.kind === "move-wall-endpoint" &&
          transient.wallId === selectedEditWall.id &&
          transient.endpoint === "end"
            ? transient.currentPointerPoint
            : transient?.kind === "move-junction" &&
                selectedEditWall.end.x === transient.position.x &&
                selectedEditWall.end.z === transient.position.z
              ? transient.currentPointerPoint
              : selectedEditWall.end,
        draggingEndpoint:
          transient?.kind === "move-wall-endpoint" &&
          transient.wallId === selectedEditWall.id
            ? transient.endpoint
            : undefined
      }
    : undefined;
  const placementCandidate =
    transient?.kind === "place-opening" ? transient.candidate : undefined;
  const placementWall = placementCandidate
    ? findProjectWall(
        editor.draft,
        editor.activeLevelId,
        placementCandidate.wallId
      )
    : undefined;
  const draggedOpening =
    transient?.kind === "move-opening" &&
    transient.dragging &&
    selectedEditOpening
      ? ({
          ...selectedEditOpening.opening,
          offsetFromStart: transient.currentOffsetFromStart
        } as Opening)
      : undefined;
  const selectionTranslation =
    transient?.kind === "translate-selection"
      ? (() => {
          const selectedKeys = new Set(
            selectionState.selected.map(
              (selection) => `${selection.kind}:${selection.geometryId}`
            )
          );
          const points = selectionFootprints
            .filter((footprint) =>
              selectedKeys.has(
                `${footprint.selection.kind}:${footprint.selection.geometryId}`
              )
            )
            .flatMap((footprint) =>
              footprint.polygons.flatMap((polygon) => polygon)
            );
          if (points.length === 0) return undefined;
          return {
            min: {
              x: Math.min(...points.map((point) => point.x)),
              z: Math.min(...points.map((point) => point.z))
            },
            max: {
              x: Math.max(...points.map((point) => point.x)),
              z: Math.max(...points.map((point) => point.z))
            },
            delta: {
              x: transient.currentPointer.x - transient.startPointer.x,
              z: transient.currentPointer.z - transient.startPointer.z
            }
          };
        })()
      : undefined;
  const previewShape =
    transient?.kind === "place-room-shape" &&
    (transient.boundaryKind === "WALLS" || validRoomElevation !== undefined)
      ? transient.shape
      : undefined;
  const shapeVertices =
    previewShape &&
    transient?.kind === "place-room-shape" &&
    transient.origin &&
    validatedRoomShape
      ? deriveRoomShapeVertices(transient.origin, previewShape)
      : undefined;
  const shapeLabelAnchor = shapeVertices
    ? calculatePolygonInteriorAnchor(shapeVertices)
    : undefined;

  return {
    precisionGuides:
      transient?.kind === "translate-selection"
        ? transient.precision?.guides
        : transient?.kind === "move-stair-translation"
          ? transient.precision?.guides
          : transient?.kind === "furniture"
            ? transient.precision?.guides
            : undefined,
    stairPreview:
      (translatedStaircase ?? stairAdjustmentProposal ?? stairProposal)
        ? {
            staircase:
              translatedStaircase ??
              (stairAdjustmentProposal ?? stairProposal)!.staircase,
            valid: translatedStaircase
              ? true
              : (stairAdjustmentProposal ?? stairProposal)!.valid,
            locked: Boolean(translatedStaircase || stairAdjustmentProposal)
          }
        : undefined,
    selectedStair:
      selectedStair && selectionState.selected[0]?.kind === "STAIRCASE"
        ? {
            staircaseId: selectedStair.staircase.id,
            adjustmentPoint:
              editor.transient.interaction?.kind === "move-stair-adjustment"
                ? editor.transient.interaction.control
                : inferStairTemplate(selectedStair.staircase) === "STRAIGHT"
                  ? (selectedStair.staircase.flights.at(-1)?.end ?? {
                      x: 0,
                      z: 0
                    })
                  : (selectedStair.staircase.flights[0]?.end ?? {
                      x: 0,
                      z: 0
                    })
          }
        : undefined,
    roomFaceCandidates:
      editor.activeTool === "room" && roomDetectionActive
        ? actionableRoomFaces.map((face) => ({
            faceKey: face.key,
            vertices: face.vertices,
            selected: false
          }))
        : undefined,
    roomShapePreview:
      shapeVertices &&
      shapeLabelAnchor &&
      activeProject &&
      previewShape &&
      transient?.kind === "place-room-shape"
        ? {
            vertices: shapeVertices,
            labelAnchor: shapeLabelAnchor,
            label: formatRoomShapePreviewLabel(
              previewShape,
              activeProject.units.length,
              transient.boundaryKind === "FREE"
                ? transient.elevation
                : undefined
            ),
            kind: previewShape.kind,
            elevated: transient.boundaryKind === "FREE",
            elevation: transient.elevation,
            valid: roomPlacementValid
          }
        : undefined,
    drawWall:
      transient?.kind === "draw-wall"
        ? {
            start: transient.startPoint,
            end: transient.currentPointerPoint,
            lengthLabel:
              activeProject &&
              (transient.currentPointerPoint.x !== transient.startPoint.x ||
                transient.currentPointerPoint.z !== transient.startPoint.z)
                ? formatArchitecturalLength(
                    Math.hypot(
                      transient.currentPointerPoint.x - transient.startPoint.x,
                      transient.currentPointerPoint.z - transient.startPoint.z
                    ),
                    activeProject.units.length
                  )
                : undefined
          }
        : undefined,
    snapCandidate: editor.transient.snapCandidate,
    roomShapeSnapMatches:
      editor.activeTool === "room"
        ? editor.transient.roomShapeSnapMatches
        : undefined,
    snapMarkerPurpose:
      editor.activeTool === "measure" ? "measurement" : "authoring",
    selectedWall,
    selectedJunction:
      selectedEditVertex && selectedJunctionWallIds.length > 1
        ? {
            position: selectedEditVertex.coordinates,
            previewPosition:
              transient?.kind === "move-junction"
                ? transient.currentPointerPoint
                : selectedEditVertex.coordinates
          }
        : undefined,
    wallVertexPreview:
      transient?.kind === "add-wall-vertex" ? transient.splitPoint : undefined,
    openingPreview:
      placementCandidate && placementWall
        ? {
            wall: placementWall,
            opening: placementCandidate.opening,
            valid: placementCandidate.valid
          }
        : draggedOpening && selectedEditOpening
          ? {
              wall: selectedEditOpening.wall,
              opening: draggedOpening,
              valid:
                transient?.kind === "move-opening" ? transient.valid : false
            }
          : undefined,
    activeOpeningDragId:
      transient?.kind === "move-opening" && transient.dragging
        ? transient.openingId
        : undefined,
    grid: {
      visible: editor.precision.gridVisible,
      spacing: editor.precision.gridSpacing
    },
    selectionTranslation
  };
}
