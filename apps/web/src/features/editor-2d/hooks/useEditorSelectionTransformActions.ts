import type { Level } from "@casastudio/schema";
import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { AppDispatch } from "../../../app/store/store";
import type { WorldPointXZ } from "../../geometry-2d/viewport/viewport-transform-2d";
import {
  editingDraftReplaced,
  editorSelectionCleared,
  editorSelectionTranslationStarted,
  editorTransientInteractionCleared,
  type ProjectEditorState,
  type ProjectWorkspaceMode
} from "../state/project-editor-slice";
import {
  alignFurnitureSelection,
  deleteProjectSelection,
  distributeFurnitureSelection,
  translateProjectSelection,
  type FurnitureAlignment,
  type FurnitureDistribution,
  type ProjectSelectionCapabilities,
  type ProjectSelectionRoot
} from "../selection/project-selection-transforms";
import type { EditingErrorKey } from "./useEditorSelectionActions";

type UseEditorSelectionTransformActionsOptions = {
  readonly dispatch: AppDispatch;
  readonly editor: ProjectEditorState;
  readonly activeProjectLevel?: Level;
  readonly selectionRoots: readonly ProjectSelectionRoot[];
  readonly selectionCapabilities: ProjectSelectionCapabilities;
  readonly saveInteractionBlocked: boolean;
  readonly workspaceMode: ProjectWorkspaceMode;
  readonly setEditingError: Dispatch<
    SetStateAction<EditingErrorKey | undefined>
  >;
};

/** Coordinates whole-selection translation, alignment, distribution, and deletion. */
export function useEditorSelectionTransformActions({
  dispatch,
  editor,
  activeProjectLevel,
  selectionRoots,
  selectionCapabilities,
  saveInteractionBlocked,
  workspaceMode,
  setEditingError
}: UseEditorSelectionTransformActionsOptions) {
  const handleSelectionTranslationPointerDown = useCallback(
    (_selection: unknown, point: WorldPointXZ, pointerId: number) => {
      if (
        saveInteractionBlocked ||
        workspaceMode !== "edit" ||
        editor.activeTool !== "select"
      )
        return;
      if (!selectionCapabilities.translate.supported) {
        setEditingError("errors.selection.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(
        editorSelectionTranslationStarted({ pointerId, startPointer: point })
      );
    },
    [
      dispatch,
      editor.activeTool,
      saveInteractionBlocked,
      selectionCapabilities.translate,
      setEditingError,
      workspaceMode
    ]
  );

  const handleSelectionTranslationPointerUp = useCallback(
    (pointerId: number, dragged: boolean) => {
      const interaction = editor.transient.interaction;
      if (
        interaction?.kind !== "translate-selection" ||
        interaction.pointerId !== pointerId
      )
        return;
      dispatch(editorTransientInteractionCleared());
      if (!dragged || !editor.draft || !activeProjectLevel) return;
      const result = translateProjectSelection(
        editor.draft,
        activeProjectLevel,
        selectionRoots,
        {
          x: interaction.currentPointer.x - interaction.startPointer.x,
          z: interaction.currentPointer.z - interaction.startPointer.z
        }
      );
      if (!result.ok) {
        setEditingError("errors.selection.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
    },
    [
      activeProjectLevel,
      dispatch,
      editor.draft,
      editor.transient.interaction,
      selectionRoots,
      setEditingError
    ]
  );

  const handleSelectionTranslationPointerCancel = useCallback(
    (pointerId: number) => {
      if (
        editor.transient.interaction?.kind === "translate-selection" &&
        editor.transient.interaction.pointerId === pointerId
      )
        dispatch(editorTransientInteractionCleared());
    },
    [dispatch, editor.transient.interaction]
  );

  const handleNudgeSelection = useCallback(
    (delta: WorldPointXZ) => {
      if (
        !editor.draft ||
        !activeProjectLevel ||
        saveInteractionBlocked ||
        workspaceMode !== "edit"
      )
        return;
      const result = translateProjectSelection(
        editor.draft,
        activeProjectLevel,
        selectionRoots,
        delta
      );
      if (!result.ok) {
        setEditingError("errors.selection.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
    },
    [
      activeProjectLevel,
      dispatch,
      editor.draft,
      saveInteractionBlocked,
      selectionRoots,
      setEditingError,
      workspaceMode
    ]
  );

  const handleAlignSelection = useCallback(
    (alignment: FurnitureAlignment) => {
      if (!editor.draft || !activeProjectLevel || saveInteractionBlocked)
        return;
      const result = alignFurnitureSelection(
        editor.draft,
        activeProjectLevel,
        selectionRoots,
        alignment
      );
      if (!result.ok) {
        setEditingError("errors.selection.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
    },
    [
      activeProjectLevel,
      dispatch,
      editor.draft,
      saveInteractionBlocked,
      selectionRoots,
      setEditingError
    ]
  );

  const handleDistributeSelection = useCallback(
    (distribution: FurnitureDistribution) => {
      if (!editor.draft || !activeProjectLevel || saveInteractionBlocked)
        return;
      const result = distributeFurnitureSelection(
        editor.draft,
        activeProjectLevel,
        selectionRoots,
        distribution
      );
      if (!result.ok) {
        setEditingError("errors.selection.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
    },
    [
      activeProjectLevel,
      dispatch,
      editor.draft,
      saveInteractionBlocked,
      selectionRoots,
      setEditingError
    ]
  );

  const handleDeleteSelection = useCallback(() => {
    if (
      !editor.draft ||
      !activeProjectLevel ||
      saveInteractionBlocked ||
      workspaceMode !== "edit"
    )
      return;
    const result = deleteProjectSelection(
      editor.draft,
      activeProjectLevel,
      selectionRoots
    );
    if (!result.ok) {
      setEditingError("errors.selection.invalid");
      return;
    }
    setEditingError(undefined);
    dispatch(editorSelectionCleared());
    dispatch(editingDraftReplaced(result.project));
  }, [
    activeProjectLevel,
    dispatch,
    editor.draft,
    saveInteractionBlocked,
    selectionRoots,
    setEditingError,
    workspaceMode
  ]);

  return {
    handleSelectionTranslationPointerDown,
    handleSelectionTranslationPointerUp,
    handleSelectionTranslationPointerCancel,
    handleNudgeSelection,
    handleAlignSelection,
    handleDistributeSelection,
    handleDeleteSelection
  };
}
