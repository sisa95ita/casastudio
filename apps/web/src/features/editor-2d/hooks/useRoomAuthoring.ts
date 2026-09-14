import {
  createFreeBoundaryRoomFromShape,
  createRoomFromShape,
  classifyLevelRoomTopology,
  deriveRoomShapeVertices,
  type RoomShapeKind
} from "@casastudio/schema";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AppDispatch } from "../../../app/store/store";
import {
  editorActiveToolChanged,
  editorRoomAuthoringTypeChanged,
  editorRoomShapeElevationChanged,
  editorRoomShapePlacementChanged,
  editorRoomShapePlacementStarted,
  editorTransientInteractionCleared,
  type ProjectEditorState,
  type ProjectWorkspaceMode
} from "../state/project-editor-slice";
import { collectActionableRoomFaces } from "../tools/room/project-room-authoring";
import {
  defaultRoomShapeDimensions,
  getDefaultRoomShapeDimensions,
  getRoomAuthoringPresetValues,
  parseRoomShapeDefinition,
  type RoomAuthoringPreset,
  type RoomShapeDimensionDraft
} from "../tools/room/room-shape-authoring";
import { newWallDefaults } from "../tools/wall/project-wall-editing";

type UseRoomAuthoringOptions = {
  readonly dispatch: AppDispatch;
  readonly editor: ProjectEditorState;
  readonly workspaceMode: ProjectWorkspaceMode;
};

/** Coordinates Room detection and shape-authoring state for the active editor level. */
export function useRoomAuthoring({
  dispatch,
  editor,
  workspaceMode
}: UseRoomAuthoringOptions) {
  const [roomDetectionActive, setRoomDetectionActive] = useState(false);
  const [roomPreset, setRoomPreset] = useState<RoomAuthoringPreset>("CUSTOM");
  const [roomShapeDimensions, setRoomShapeDimensions] =
    useState<RoomShapeDimensionDraft>(defaultRoomShapeDimensions);
  const [roomElevationDraft, setRoomElevationDraft] = useState("0");
  const roomShapePlacement =
    editor.transient.interaction?.kind === "place-room-shape"
      ? editor.transient.interaction
      : undefined;
  const activeRoomShapeKind = roomShapePlacement?.shape.kind;
  const activeRoomBoundaryKind = roomShapePlacement?.boundaryKind;
  const parsedRoomElevation = Number(roomElevationDraft);
  const validRoomElevation =
    Number.isFinite(parsedRoomElevation) && parsedRoomElevation >= 0
      ? parsedRoomElevation
      : undefined;
  const validatedRoomShape = useMemo(
    () =>
      activeRoomShapeKind
        ? parseRoomShapeDefinition(activeRoomShapeKind, roomShapeDimensions)
        : undefined,
    [activeRoomShapeKind, roomShapeDimensions]
  );
  const roomPlacementValidation = useMemo(() => {
    if (
      !editor.draft ||
      !editor.activeLevelId ||
      !roomShapePlacement?.origin ||
      !validatedRoomShape
    )
      return undefined;
    const room = {
      id: "room-authoring-preview",
      name: "Room preview",
      type: roomShapePlacement.roomType,
      ...(roomShapePlacement.boundaryKind === "FREE"
        ? { elevation: roomShapePlacement.elevation }
        : {})
    };
    return roomShapePlacement.boundaryKind === "FREE"
      ? createFreeBoundaryRoomFromShape(editor.draft, {
          levelId: editor.activeLevelId,
          origin: roomShapePlacement.origin,
          shape: validatedRoomShape,
          room
        })
      : createRoomFromShape(editor.draft, {
          levelId: editor.activeLevelId,
          origin: roomShapePlacement.origin,
          shape: validatedRoomShape,
          room,
          wallIds: Array.from(
            {
              length:
                deriveRoomShapeVertices(
                  roomShapePlacement.origin,
                  validatedRoomShape
                )?.length ?? 0
            },
            (_, index) => `room-authoring-preview-wall-${index + 1}`
          ),
          wallHeight: newWallDefaults.height,
          wallThickness: newWallDefaults.thickness
        });
  }, [
    editor.activeLevelId,
    editor.draft,
    roomShapePlacement,
    validatedRoomShape
  ]);
  const roomTopology = useMemo(
    () =>
      editor.draft && editor.activeLevelId
        ? classifyLevelRoomTopology(editor.draft, editor.activeLevelId)
        : undefined,
    [editor.activeLevelId, editor.draft]
  );
  const actionableRoomFaces = useMemo(
    () => (roomTopology ? collectActionableRoomFaces(roomTopology) : []),
    [roomTopology]
  );

  useEffect(() => {
    if (workspaceMode === "edit" && editor.activeTool === "room") return;
    setRoomDetectionActive(false);
  }, [editor.activeTool, workspaceMode]);

  const handleDetectRoom = useCallback(() => {
    dispatch(editorTransientInteractionCleared());
    setRoomDetectionActive(true);
  }, [dispatch]);

  const handleSelectRoomShape = useCallback(
    (
      kind: RoomShapeKind,
      boundaryKind: "WALLS" | "FREE" = Number(roomElevationDraft) === 0
        ? "WALLS"
        : "FREE",
      roomType = "OTHER" as const
    ) => {
      if (!editor.activeLevelId) return;
      const dimensions = getDefaultRoomShapeDimensions(kind);
      const shape = parseRoomShapeDefinition(kind, dimensions);
      if (!shape) return;
      setRoomShapeDimensions(dimensions);
      setRoomDetectionActive(false);
      dispatch(editorActiveToolChanged("room"));
      if (roomShapePlacement?.levelId === editor.activeLevelId) {
        dispatch(editorRoomShapePlacementChanged(shape));
      } else {
        dispatch(
          editorRoomShapePlacementStarted({
            levelId: editor.activeLevelId,
            shape,
            boundaryKind,
            elevation: boundaryKind === "FREE" ? (validRoomElevation ?? 0) : 0,
            roomType
          })
        );
      }
    },
    [
      dispatch,
      editor.activeLevelId,
      roomElevationDraft,
      roomShapePlacement,
      validRoomElevation
    ]
  );

  const handleRoomMethodChange = useCallback(
    (method: "DETECT" | "SHAPE") => {
      if (method === "DETECT") handleDetectRoom();
      else handleSelectRoomShape(activeRoomShapeKind ?? "RECTANGLE");
    },
    [activeRoomShapeKind, handleDetectRoom, handleSelectRoomShape]
  );

  const handleRoomPresetChange = useCallback(
    (preset: RoomAuthoringPreset) => {
      const values = getRoomAuthoringPresetValues(preset);
      setRoomPreset(preset);
      setRoomShapeDimensions(values.dimensions);
      setRoomDetectionActive(false);
      const shape = parseRoomShapeDefinition(values.shape, values.dimensions);
      if (!shape || !editor.activeLevelId) return;
      if (roomShapePlacement?.levelId === editor.activeLevelId) {
        dispatch(editorRoomShapePlacementChanged(shape));
        dispatch(editorRoomAuthoringTypeChanged(values.roomType));
      } else {
        dispatch(
          editorRoomShapePlacementStarted({
            levelId: editor.activeLevelId,
            shape,
            boundaryKind: Number(roomElevationDraft) === 0 ? "WALLS" : "FREE",
            elevation: Number(roomElevationDraft) || 0,
            roomType: values.roomType
          })
        );
      }
    },
    [dispatch, editor.activeLevelId, roomElevationDraft, roomShapePlacement]
  );

  const handleRoomElevationChange = useCallback(
    (value: string) => {
      setRoomElevationDraft(value);
      const elevation = Number(value);
      if (Number.isFinite(elevation) && elevation >= 0) {
        dispatch(editorRoomShapeElevationChanged(elevation));
      }
    },
    [dispatch]
  );

  const handleRoomShapeDimensionChange = useCallback(
    (field: keyof RoomShapeDimensionDraft, value: string) => {
      if (!activeRoomShapeKind) return;
      const nextDimensions = { ...roomShapeDimensions, [field]: value };
      setRoomShapeDimensions(nextDimensions);
      const shape = parseRoomShapeDefinition(
        activeRoomShapeKind,
        nextDimensions
      );
      if (shape) dispatch(editorRoomShapePlacementChanged(shape));
    },
    [activeRoomShapeKind, dispatch, roomShapeDimensions]
  );

  const handleCancelRoomAuthoring = useCallback(() => {
    dispatch(editorTransientInteractionCleared());
    dispatch(editorActiveToolChanged("select"));
    setRoomDetectionActive(false);
  }, [dispatch]);

  useEffect(() => {
    if (
      editor.activeTool === "room" &&
      !roomShapePlacement &&
      !roomDetectionActive
    ) {
      handleSelectRoomShape("RECTANGLE");
    }
  }, [
    editor.activeTool,
    handleSelectRoomShape,
    roomDetectionActive,
    roomShapePlacement
  ]);

  return {
    roomDetectionActive,
    setRoomDetectionActive,
    roomPreset,
    setRoomPreset,
    roomShapeDimensions,
    setRoomShapeDimensions,
    roomElevationDraft,
    setRoomElevationDraft,
    roomShapePlacement,
    activeRoomShapeKind,
    activeRoomBoundaryKind,
    validRoomElevation,
    validatedRoomShape,
    roomPlacementValidation,
    actionableRoomFaces,
    handleSelectRoomShape,
    handleRoomMethodChange,
    handleRoomPresetChange,
    handleRoomElevationChange,
    handleRoomShapeDimensionChange,
    handleCancelRoomAuthoring
  };
}
