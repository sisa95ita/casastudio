import {
  deleteStaircase,
  updateStaircase,
  type Level,
  type Project
} from "@casastudio/schema";
import {
  useCallback,
  useMemo,
  type Dispatch,
  type SetStateAction
} from "react";

import type { AppDispatch } from "../../../app/store/store";
import {
  createGeometrySelectionState,
  selectStaircase,
  type GeometrySelectionState
} from "../../geometry-2d/selection/geometry-selection-state";
import type { WorldPointXZ } from "../../geometry-2d/viewport/viewport-transform-2d";
import {
  editingDraftReplaced,
  editorSelectionChanged,
  editorSelectionCleared,
  editorStairAdjustmentStarted,
  editorStairTranslationStarted,
  editorTransientInteractionCleared,
  type ProjectEditorState
} from "../state/project-editor-slice";
import {
  createStairProposal,
  findProjectStaircase,
  getStairAuthoringParameters,
  inferStairTemplate,
  translateStaircase,
  updateStaircaseParameters,
  type StairParameterChanges
} from "../tools/stair/project-stair-authoring";
import type { EditingErrorKey } from "./useEditorSelectionActions";

type UseSelectedStairActionsOptions = {
  readonly activeProject?: Project | null;
  readonly activeProjectLevel?: Level;
  readonly selectionState: GeometrySelectionState;
  readonly editor: ProjectEditorState;
  readonly dispatch: AppDispatch;
  readonly saveInteractionBlocked: boolean;
  readonly setEditingError: Dispatch<
    SetStateAction<EditingErrorKey | undefined>
  >;
};

/** Coordinates selection-derived Stair properties and direct manipulation commits. */
export function useSelectedStairActions({
  activeProject,
  activeProjectLevel,
  selectionState,
  editor,
  dispatch,
  saveInteractionBlocked,
  setEditingError
}: UseSelectedStairActionsOptions) {
  const selectedStair = useMemo(() => {
    const selected =
      selectionState.selected.length === 1
        ? selectionState.selected[0]
        : undefined;
    if (
      !selected ||
      (selected.kind !== "STAIRCASE" &&
        selected.kind !== "STAIR_FLIGHT" &&
        selected.kind !== "STAIR_LANDING")
    )
      return undefined;
    return findProjectStaircase(activeProjectLevel, selected.geometryId);
  }, [activeProjectLevel, selectionState.selected]);
  const stairAdjustmentProposal = useMemo(() => {
    const adjustment =
      editor.transient.interaction?.kind === "move-stair-adjustment"
        ? editor.transient.interaction
        : undefined;
    if (
      !activeProject ||
      !selectedStair ||
      !adjustment ||
      adjustment.staircaseId !== selectedStair.staircase.id
    )
      return undefined;
    const staircase = selectedStair.staircase;
    const proposal = createStairProposal({
      project: activeProject,
      owningLevelId: adjustment.owningLevelId,
      destination: {
        toLevelId: staircase.toLevelId,
        ...(staircase.toRoomId ? { toRoomId: staircase.toRoomId } : {})
      },
      template: inferStairTemplate(staircase),
      parameters: getStairAuthoringParameters(staircase),
      start: staircase.flights[0]?.start ?? adjustment.control,
      control: adjustment.control,
      identifiers: {
        staircaseId: staircase.id,
        flightIds: staircase.flights.map((flight) => flight.id),
        landingIds: staircase.landings.map((landing) => landing.id)
      },
      name: staircase.name
    });
    return proposal && staircase.fromRoomId
      ? {
          ...proposal,
          staircase: { ...proposal.staircase, fromRoomId: staircase.fromRoomId }
        }
      : proposal;
  }, [activeProject, editor.transient.interaction, selectedStair]);
  const translatedStaircase = useMemo(() => {
    const move =
      editor.transient.interaction?.kind === "move-stair-translation"
        ? editor.transient.interaction
        : undefined;
    if (
      !move ||
      !selectedStair ||
      move.staircaseId !== selectedStair.staircase.id
    )
      return undefined;
    return translateStaircase(selectedStair.staircase, {
      x: move.currentPointer.x - move.startPointer.x,
      z: move.currentPointer.z - move.startPointer.z
    });
  }, [editor.transient.interaction, selectedStair]);

  const handleStairAdjustmentPointerDown = useCallback(
    (staircaseId: string, pointerId: number) => {
      if (
        !editor.activeLevelId ||
        editor.activeTool !== "select" ||
        !selectedStair ||
        selectedStair.staircase.id !== staircaseId ||
        saveInteractionBlocked
      )
        return;
      const staircase = selectedStair.staircase;
      const control =
        inferStairTemplate(staircase) === "STRAIGHT"
          ? staircase.flights.at(-1)?.end
          : staircase.flights[0]?.end;
      if (!control) return;
      dispatch(
        editorStairAdjustmentStarted({
          owningLevelId: editor.activeLevelId,
          staircaseId,
          pointerId,
          control
        })
      );
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.activeTool,
      saveInteractionBlocked,
      selectedStair
    ]
  );

  const handleStairTranslationPointerDown = useCallback(
    (staircaseId: string, point: WorldPointXZ, pointerId: number) => {
      if (
        !editor.activeLevelId ||
        editor.activeTool !== "select" ||
        !selectedStair ||
        selectedStair.staircase.id !== staircaseId ||
        saveInteractionBlocked
      )
        return;
      dispatch(
        editorStairTranslationStarted({
          owningLevelId: editor.activeLevelId,
          staircaseId,
          pointerId,
          startPointer: point
        })
      );
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.activeTool,
      saveInteractionBlocked,
      selectedStair
    ]
  );

  const handleStairTranslationPointerUp = useCallback(
    (pointerId: number) => {
      const interaction = editor.transient.interaction;
      if (
        interaction?.kind !== "move-stair-translation" ||
        interaction.pointerId !== pointerId ||
        !editor.draft ||
        !translatedStaircase
      )
        return;
      const result = updateStaircase(editor.draft, {
        owningLevelId: interaction.owningLevelId,
        staircaseId: interaction.staircaseId,
        staircase: translatedStaircase
      });
      dispatch(editorTransientInteractionCleared());
      if (!result.ok) {
        setEditingError("errors.stair.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
      dispatch(
        editorSelectionChanged(
          createGeometrySelectionState([
            selectStaircase(interaction.staircaseId)
          ])
        )
      );
    },
    [
      dispatch,
      editor.draft,
      editor.transient.interaction,
      setEditingError,
      translatedStaircase
    ]
  );

  const handleStairTranslationPointerCancel = useCallback(
    (pointerId: number) => {
      if (
        editor.transient.interaction?.kind === "move-stair-translation" &&
        editor.transient.interaction.pointerId === pointerId
      ) {
        dispatch(editorTransientInteractionCleared());
      }
    },
    [dispatch, editor.transient.interaction]
  );

  const handleStairAdjustmentPointerUp = useCallback(
    (control: WorldPointXZ, pointerId: number) => {
      const interaction = editor.transient.interaction;
      if (
        interaction?.kind !== "move-stair-adjustment" ||
        interaction.pointerId !== pointerId ||
        !editor.draft ||
        !selectedStair
      )
        return;
      const staircase = selectedStair.staircase;
      const proposal = createStairProposal({
        project: editor.draft,
        owningLevelId: interaction.owningLevelId,
        destination: {
          toLevelId: staircase.toLevelId,
          ...(staircase.toRoomId ? { toRoomId: staircase.toRoomId } : {})
        },
        template: inferStairTemplate(staircase),
        parameters: getStairAuthoringParameters(staircase),
        start: staircase.flights[0]?.start ?? control,
        control,
        identifiers: {
          staircaseId: staircase.id,
          flightIds: staircase.flights.map((flight) => flight.id),
          landingIds: staircase.landings.map((landing) => landing.id)
        },
        name: staircase.name
      });
      dispatch(editorTransientInteractionCleared());
      if (!proposal?.valid) {
        setEditingError("errors.stair.invalid");
        return;
      }
      const editedStaircase = staircase.fromRoomId
        ? { ...proposal.staircase, fromRoomId: staircase.fromRoomId }
        : proposal.staircase;
      const result = updateStaircase(editor.draft, {
        owningLevelId: interaction.owningLevelId,
        staircaseId: staircase.id,
        staircase: editedStaircase
      });
      if (!result.ok) {
        setEditingError("errors.stair.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
      dispatch(
        editorSelectionChanged(
          createGeometrySelectionState([selectStaircase(staircase.id)])
        )
      );
    },
    [
      dispatch,
      editor.draft,
      editor.transient.interaction,
      selectedStair,
      setEditingError
    ]
  );

  const handleStairAdjustmentPointerCancel = useCallback(
    (pointerId: number) => {
      const interaction = editor.transient.interaction;
      if (
        interaction?.kind === "move-stair-adjustment" &&
        interaction.pointerId === pointerId
      ) {
        dispatch(editorTransientInteractionCleared());
      }
    },
    [dispatch, editor.transient.interaction]
  );

  const handleDeleteSelectedStair = useCallback(() => {
    if (
      !editor.draft ||
      !editor.activeLevelId ||
      !selectedStair ||
      saveInteractionBlocked
    )
      return;
    const result = deleteStaircase(editor.draft, {
      owningLevelId: editor.activeLevelId,
      staircaseId: selectedStair.staircase.id
    });
    if (!result.ok) {
      setEditingError("errors.stair.invalid");
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
    selectedStair,
    setEditingError
  ]);

  const handleUpdateSelectedStair = useCallback(
    (changes: StairParameterChanges): boolean => {
      if (
        !editor.draft ||
        !editor.activeLevelId ||
        !selectedStair ||
        saveInteractionBlocked
      )
        return false;
      const staircase = updateStaircaseParameters(
        selectedStair.staircase,
        changes
      );
      if (!staircase) return false;
      const result = updateStaircase(editor.draft, {
        owningLevelId: editor.activeLevelId,
        staircaseId: staircase.id,
        staircase
      });
      if (!result.ok) {
        setEditingError("errors.stair.invalid");
        return false;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
      dispatch(
        editorSelectionChanged(
          createGeometrySelectionState([selectStaircase(staircase.id)])
        )
      );
      return true;
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.draft,
      saveInteractionBlocked,
      selectedStair,
      setEditingError
    ]
  );

  return {
    selectedStair,
    stairAdjustmentProposal,
    translatedStaircase,
    handleStairAdjustmentPointerDown,
    handleStairTranslationPointerDown,
    handleStairTranslationPointerUp,
    handleStairTranslationPointerCancel,
    handleStairAdjustmentPointerUp,
    handleStairAdjustmentPointerCancel,
    handleDeleteSelectedStair,
    handleUpdateSelectedStair
  };
}
