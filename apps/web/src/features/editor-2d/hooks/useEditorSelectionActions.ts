import {
  ValidationErrorCode,
  collapseWallJunction,
  createLevel,
  deleteOpening,
  deleteWallAndCollapseRedundantTopology,
  dissolveRoom,
  setWallLength,
  updateLevelProperties,
  updateOpening,
  updateRoomProperties,
  updateWallProperties,
  type Opening,
  type Room,
  type UpdateOpeningProperties,
  type UpdateRoomProperties,
  type Wall
} from "@casastudio/schema";
import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { AppDispatch } from "../../../app/store/store";
import {
  editingDraftReplaced,
  editorActiveLevelChanged,
  editorOpeningPlacementChanged,
  editorSelectionCleared,
  editorTransientInteractionCleared,
  editorWallVertexPlacementStarted,
  type OpeningAuthoringProperties,
  type ProjectEditorState,
  type ProjectWorkspaceMode
} from "../state/project-editor-slice";
import { createLevelIdentifier } from "../tools/level/project-level-editing";
import { resolveOpeningPlacementCandidate } from "../tools/opening/project-opening-editing";
import { commitRoomFaceCandidate } from "../tools/room/project-room-authoring";
import {
  getRoomEditingErrorKey,
  type RoomEditingErrorKey
} from "../tools/room/room-shape-authoring";
import {
  createRoomIdentifier,
  getWallEditingErrorKey,
  type WallEditingErrorKey
} from "../tools/wall/project-wall-editing";

/** Localized editor feedback emitted by selection and authoring actions. */
export type EditingErrorKey =
  | WallEditingErrorKey
  | RoomEditingErrorKey
  | "errors.opening.invalid";

type UseEditorSelectionActionsOptions = {
  readonly dispatch: AppDispatch;
  readonly editor: ProjectEditorState;
  readonly selectedEditWall?: Wall;
  readonly selectedEditVertex?: { readonly coordinates: { readonly x: number; readonly z: number } };
  readonly selectedVertexRemovable: boolean;
  readonly selectedEditOpening?: { readonly wall: Wall; readonly opening: Opening };
  readonly selectedRoom?: Room;
  readonly saveInteractionBlocked: boolean;
  readonly workspaceMode: ProjectWorkspaceMode;
  readonly setEditingError: Dispatch<SetStateAction<EditingErrorKey | undefined>>;
};

/** Provides semantic edit actions for selected Project entities and levels. */
export function useEditorSelectionActions({
  dispatch,
  editor,
  selectedEditWall,
  selectedEditVertex,
  selectedVertexRemovable,
  selectedEditOpening,
  selectedRoom,
  saveInteractionBlocked,
  workspaceMode,
  setEditingError
}: UseEditorSelectionActionsOptions) {
  const handleDeleteSelectedWall = useCallback(() => {
    if (
      saveInteractionBlocked ||
      workspaceMode !== "edit" ||
      !editor.draft ||
      !editor.activeLevelId ||
      !selectedEditWall
    ) {
      return;
    }

    const result = deleteWallAndCollapseRedundantTopology(editor.draft, {
      levelId: editor.activeLevelId,
      wallId: selectedEditWall.id
    });
    if (result.ok) {
      setEditingError(undefined);
      dispatch(editorTransientInteractionCleared());
      dispatch(editorSelectionCleared());
      dispatch(editingDraftReplaced(result.project));
    } else {
      setEditingError(getWallEditingErrorKey(result));
    }
  }, [
    dispatch,
    editor.activeLevelId,
    editor.draft,
    selectedEditWall,
    saveInteractionBlocked,
    workspaceMode
  ]);

  const handleAddVertexToSelectedWall = useCallback(() => {
    if (!editor.activeLevelId || !selectedEditWall || saveInteractionBlocked) return;
    setEditingError(undefined);
    dispatch(editorWallVertexPlacementStarted({
      levelId: editor.activeLevelId,
      wallId: selectedEditWall.id
    }));
  }, [dispatch, editor.activeLevelId, saveInteractionBlocked, selectedEditWall]);

  const handleRemoveSelectedVertex = useCallback(() => {
    if (
      !editor.draft ||
      !editor.activeLevelId ||
      !selectedEditVertex ||
      !selectedVertexRemovable ||
      saveInteractionBlocked
    ) return;
    const result = collapseWallJunction(editor.draft, {
      levelId: editor.activeLevelId,
      junction: selectedEditVertex.coordinates
    });
    if (!result.ok || result.project === editor.draft) {
      setEditingError("errors.wall.invalid");
      return;
    }
    setEditingError(undefined);
    dispatch(editorSelectionCleared());
    dispatch(editingDraftReplaced(result.project));
  }, [
    dispatch,
    editor.activeLevelId,
    editor.draft,
    saveInteractionBlocked,
    selectedEditVertex,
    selectedVertexRemovable
  ]);

  const handleUpdateSelectedWallProperties = useCallback(
    (properties: {
      readonly length?: number;
      readonly anchoredEndpoint?: "START" | "END";
      readonly height?: number;
      readonly thickness?: number;
    }): boolean => {
      if (
        saveInteractionBlocked ||
        workspaceMode !== "edit" ||
        !editor.draft ||
        !editor.activeLevelId ||
        !selectedEditWall
      ) {
        return false;
      }

      const result = properties.length === undefined
        ? updateWallProperties(editor.draft, {
            levelId: editor.activeLevelId,
            wallId: selectedEditWall.id,
            height: properties.height,
            thickness: properties.thickness
          })
        : setWallLength(editor.draft, {
            levelId: editor.activeLevelId,
            wallId: selectedEditWall.id,
            targetLength: properties.length,
            anchoredEndpoint: properties.anchoredEndpoint ?? "START"
          });
      if (!result.ok) {
        setEditingError(getWallEditingErrorKey(result));
        return false;
      }

      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
      return true;
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.draft,
      selectedEditWall,
      saveInteractionBlocked,
      workspaceMode
    ]
  );

  const handleDeleteSelectedOpening = useCallback(() => {
    if (!editor.draft || !editor.activeLevelId || !selectedEditOpening || saveInteractionBlocked) return;
    const result = deleteOpening(editor.draft, {
      levelId: editor.activeLevelId,
      wallId: selectedEditOpening.wall.id,
      openingId: selectedEditOpening.opening.id
    });
    if (result.ok) {
      setEditingError(undefined);
      dispatch(editorSelectionCleared());
      dispatch(editingDraftReplaced(result.project));
    } else {
      setEditingError("errors.opening.invalid");
    }
  }, [dispatch, editor.activeLevelId, editor.draft, saveInteractionBlocked, selectedEditOpening]);

  const handleUpdateOpeningAuthoring = useCallback(
    (changes: Partial<OpeningAuthoringProperties>) => {
      const interaction = editor.transient.interaction;
      if (interaction?.kind !== "place-opening") return;
      const properties = { ...interaction.properties, ...changes };
      const candidate = interaction.candidate && editor.draft && editor.activeLevelId
        ? resolveOpeningPlacementCandidate(
            editor.draft,
            editor.activeLevelId,
            interaction.candidate.projectedPoint,
            interaction.openingType,
            1e-6,
            properties
          )
        : undefined;
      dispatch(editorOpeningPlacementChanged({
        openingType: interaction.openingType,
        properties,
        candidate
      }));
    },
    [dispatch, editor.activeLevelId, editor.draft, editor.transient.interaction]
  );

  const handleUpdateSelectedOpening = useCallback(
    (properties: UpdateOpeningProperties): boolean => {
      if (!editor.draft || !editor.activeLevelId || !selectedEditOpening || saveInteractionBlocked) return false;
      const result = updateOpening(editor.draft, {
        levelId: editor.activeLevelId,
        wallId: selectedEditOpening.wall.id,
        openingId: selectedEditOpening.opening.id,
        ...properties
      });
      if (!result.ok) {
        setEditingError("errors.opening.invalid");
        return false;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
      return true;
    },
    [dispatch, editor.activeLevelId, editor.draft, saveInteractionBlocked, selectedEditOpening]
  );

  const handleDeleteSelectedRoom = useCallback(() => {
    if (!editor.draft || !editor.activeLevelId || !selectedRoom || saveInteractionBlocked) return;
    const result = dissolveRoom(editor.draft, {
      levelId: editor.activeLevelId,
      roomId: selectedRoom.id
    });
    if (result.ok) {
      setEditingError(undefined);
      dispatch(editorSelectionCleared());
      dispatch(editingDraftReplaced(result.project));
    } else {
      setEditingError(
        result.errors[0]?.code === ValidationErrorCode.ROOM_DISSOLUTION_AMBIGUOUS
          ? "errors.room.dissolutionAmbiguous"
          : result.errors[0]?.code === ValidationErrorCode.INVALID_ROOM_DISSOLUTION
            ? "errors.room.dissolutionInvalid"
            : "errors.room.invalid"
      );
    }
  }, [dispatch, editor.activeLevelId, editor.draft, saveInteractionBlocked, selectedRoom]);

  const handleUpdateSelectedRoomProperties = useCallback(
    (properties: Partial<UpdateRoomProperties>): boolean => {
      if (!editor.draft || !editor.activeLevelId || !selectedRoom || saveInteractionBlocked) return false;
      const result = updateRoomProperties(editor.draft, {
        levelId: editor.activeLevelId,
        roomId: selectedRoom.id,
        ...properties
      });
      if (!result.ok) {
        setEditingError("errors.room.metadata");
        return false;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
      return true;
    },
    [dispatch, editor.activeLevelId, editor.draft, saveInteractionBlocked, selectedRoom]
  );

  const handleCreateLevel = useCallback((properties: {
    readonly name: string;
    readonly elevation: number;
  }): boolean => {
    if (!editor.draft || workspaceMode !== "edit" || saveInteractionBlocked) return false;
    const levelId = createLevelIdentifier();
    const result = createLevel(editor.draft, { id: levelId, ...properties });
    if (!result.ok) return false;
    dispatch(editingDraftReplaced(result.project));
    dispatch(editorActiveLevelChanged(levelId));
    return true;
  }, [dispatch, editor.draft, saveInteractionBlocked, workspaceMode]);

  const handleUpdateActiveLevel = useCallback((properties: {
    readonly name: string;
    readonly elevation: number;
  }): boolean => {
    if (
      !editor.draft ||
      !editor.activeLevelId ||
      workspaceMode !== "edit" ||
      saveInteractionBlocked
    ) return false;
    const result = updateLevelProperties(editor.draft, {
      levelId: editor.activeLevelId,
      ...properties
    });
    if (!result.ok) return false;
    dispatch(editingDraftReplaced(result.project));
    return true;
  }, [dispatch, editor.activeLevelId, editor.draft, saveInteractionBlocked, workspaceMode]);

  const handleCreateRoom = useCallback((faceKey: string) => {
    if (
      saveInteractionBlocked ||
      workspaceMode !== "edit" ||
      editor.activeTool !== "room" ||
      !editor.draft ||
      !editor.activeLevelId
    ) return;
    const commit = commitRoomFaceCandidate(
      editor.draft,
      editor.activeLevelId,
      faceKey,
      createRoomIdentifier
    );
    if (!commit) {
      setEditingError("errors.room.none");
      return;
    }
    if (commit.result.ok) {
      setEditingError(undefined);
      dispatch(editorSelectionCleared());
      dispatch(editingDraftReplaced(commit.result.project));
    } else {
      setEditingError(getRoomEditingErrorKey(commit.result.errors[0]?.code));
    }
  }, [
    dispatch,
    editor.activeLevelId,
    editor.activeTool,
    editor.draft,
    saveInteractionBlocked,
    workspaceMode
  ]);

  return {
    handleDeleteSelectedWall,
    handleAddVertexToSelectedWall,
    handleRemoveSelectedVertex,
    handleUpdateSelectedWallProperties,
    handleDeleteSelectedOpening,
    handleUpdateOpeningAuthoring,
    handleUpdateSelectedOpening,
    handleDeleteSelectedRoom,
    handleUpdateSelectedRoomProperties,
    handleCreateLevel,
    handleUpdateActiveLevel,
    handleCreateRoom
  };
}
