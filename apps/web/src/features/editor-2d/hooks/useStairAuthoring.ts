import { createStaircase, type Level, type Project } from "@casastudio/schema";
import {
  useCallback,
  useEffect,
  useMemo,
  type Dispatch,
  type SetStateAction
} from "react";

import type { AppDispatch } from "../../../app/store/store";
import {
  createGeometrySelectionState,
  selectStaircase
} from "../../geometry-2d/selection/geometry-selection-state";
import {
  editingDraftReplaced,
  editorActiveToolChanged,
  editorSelectionChanged,
  editorStairAuthoringChanged,
  type ProjectEditorState
} from "../state/project-editor-slice";
import {
  angleToProjectPlanVector,
  createStairIdentifiers,
  createStairProposal,
  getStairSourceRoomCandidates,
  getSuggestedStairParameters,
  type StairAuthoringParameters,
  type StairTemplate
} from "../tools/stair/project-stair-authoring";
import type { EditingErrorKey } from "./useEditorSelectionActions";

type UseStairAuthoringOptions = {
  readonly activeProject?: Project | null;
  readonly activeProjectLevel?: Level;
  readonly editor: ProjectEditorState;
  readonly dispatch: AppDispatch;
  readonly setEditingError: Dispatch<
    SetStateAction<EditingErrorKey | undefined>
  >;
};

/** Coordinates destination-first Stair authoring and its transient proposal. */
export function useStairAuthoring({
  activeProject,
  activeProjectLevel,
  editor,
  dispatch,
  setEditingError
}: UseStairAuthoringOptions) {
  const stairPlacement =
    editor.transient.interaction?.kind === "place-stair"
      ? editor.transient.interaction
      : undefined;
  const sourceRoomCandidates = useMemo(() =>
    activeProject && stairPlacement?.start
      ? getStairSourceRoomCandidates(
          activeProject,
          stairPlacement.owningLevelId,
          stairPlacement.start
        )
      : [],
    [activeProject, stairPlacement?.owningLevelId, stairPlacement?.start]
  );
  const explicitSourceRoomValid = Boolean(
    stairPlacement?.sourceRoomSelectionExplicit &&
    stairPlacement.fromRoomId &&
    sourceRoomCandidates.some((candidate) =>
      candidate.roomId === stairPlacement.fromRoomId
    )
  );
  const explicitLevelFloor = Boolean(
    stairPlacement?.sourceRoomSelectionExplicit && !stairPlacement.fromRoomId
  );
  const resolvedFromRoomId = explicitSourceRoomValid
    ? stairPlacement?.fromRoomId
    : !explicitLevelFloor && sourceRoomCandidates.length === 1
      ? sourceRoomCandidates[0]!.roomId
      : undefined;
  const sourceRoomAmbiguous = sourceRoomCandidates.length > 1 &&
    !explicitSourceRoomValid && !explicitLevelFloor;
  useEffect(() => {
    if (
      stairPlacement?.sourceRoomSelectionExplicit &&
      stairPlacement.fromRoomId &&
      stairPlacement.start &&
      !sourceRoomCandidates.some((candidate) =>
        candidate.roomId === stairPlacement.fromRoomId
      )
    ) {
      dispatch(editorStairAuthoringChanged({
        fromRoomId: undefined,
        sourceRoomSelectionExplicit: false
      }));
    }
  }, [dispatch, sourceRoomCandidates, stairPlacement]);
  const stairProposal = useMemo(() => {
    if (
      !activeProject ||
      !stairPlacement?.toLevelId ||
      !stairPlacement.template ||
      !stairPlacement.identifiers ||
      !stairPlacement.start
    )
      return undefined;
    const firstStepCount =
      stairPlacement.parameters.kind === "STRAIGHT"
        ? stairPlacement.parameters.flightStepCount
        : stairPlacement.parameters.firstFlightStepCount;
    const direction = angleToProjectPlanVector(stairPlacement.rotation);
    if (!direction) return undefined;
    const firstRun = firstStepCount * stairPlacement.parameters.treadDepth;
    const control = {
      x: stairPlacement.start.x + direction.x * firstRun,
      z: stairPlacement.start.z + direction.z * firstRun
    };
    return createStairProposal({
      project: activeProject,
      owningLevelId: stairPlacement.owningLevelId,
      destination: {
        toLevelId: stairPlacement.toLevelId,
        ...(stairPlacement.toRoomId
          ? { toRoomId: stairPlacement.toRoomId }
          : {})
      },
      ...(resolvedFromRoomId ? { fromRoomId: resolvedFromRoomId } : {}),
      sourceRoomAmbiguous,
      template: stairPlacement.template,
      parameters: stairPlacement.parameters,
      start: stairPlacement.start,
      control,
      turnDirection: stairPlacement.turnDirection,
      identifiers: stairPlacement.identifiers,
      name: `Stair ${(activeProjectLevel?.staircases.length ?? 0) + 1}`
    });
  }, [
    activeProject,
    activeProjectLevel?.staircases.length,
    resolvedFromRoomId,
    sourceRoomAmbiguous,
    stairPlacement
  ]);

  const handleStairDestinationChange = useCallback(
    (toLevelId: string, toRoomId?: string) => {
      if (!editor.draft || !editor.activeLevelId) return;
      const parameters = getSuggestedStairParameters(
        editor.draft,
        editor.activeLevelId,
        {
          toLevelId,
          ...(toRoomId ? { toRoomId } : {})
        },
        stairPlacement?.template ?? "STRAIGHT"
      );
      dispatch(
        editorStairAuthoringChanged({ toLevelId, toRoomId, parameters })
      );
    },
    [dispatch, editor.activeLevelId, editor.draft, stairPlacement?.template]
  );

  const handleStairTemplateChange = useCallback(
    (template: StairTemplate) => {
      if (!editor.draft || !editor.activeLevelId || !stairPlacement?.toLevelId)
        return;
      const parameters = getSuggestedStairParameters(
        editor.draft,
        editor.activeLevelId,
        {
          toLevelId: stairPlacement.toLevelId,
          ...(stairPlacement.toRoomId
            ? { toRoomId: stairPlacement.toRoomId }
            : {})
        },
        template
      );
      dispatch(
        editorStairAuthoringChanged({
          template,
          parameters,
          identifiers: createStairIdentifiers(template)
        })
      );
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.draft,
      stairPlacement?.toLevelId,
      stairPlacement?.toRoomId
    ]
  );

  const handleStairParametersChange = useCallback(
    (parameters: StairAuthoringParameters) => {
      dispatch(editorStairAuthoringChanged({ parameters }));
    },
    [dispatch]
  );

  const handleStairRotationChange = useCallback((rotation: number) => {
    dispatch(editorStairAuthoringChanged({ rotation }));
  }, [dispatch]);

  const handleStairSourceRoomChange = useCallback((fromRoomId?: string) => {
    dispatch(editorStairAuthoringChanged({
      fromRoomId,
      sourceRoomSelectionExplicit: true
    }));
  }, [dispatch]);

  const handleCancelStairAuthoring = useCallback(() => {
    dispatch(editorActiveToolChanged("select"));
  }, [dispatch]);

  useEffect(() => {
    if (
      editor.activeTool !== "stair" ||
      stairPlacement?.template ||
      !editor.draft ||
      !editor.activeLevelId
    )
      return;
    const owningLevel = editor.draft.building.levels.find(
      (level) => level.id === editor.activeLevelId
    );
    const higherLevel = editor.draft.building.levels
      .filter((level) => level.elevation > (owningLevel?.elevation ?? 0))
      .sort((first, second) => first.elevation - second.elevation)[0];
    const elevatedRoom = owningLevel?.rooms.find(
      (room) => (room.elevation ?? 0) > 0
    );
    const toLevelId = higherLevel?.id ?? owningLevel?.id;
    const toRoomId = higherLevel ? undefined : elevatedRoom?.id;
    if (!toLevelId) return;
    const destination = { toLevelId, ...(toRoomId ? { toRoomId } : {}) };
    dispatch(
      editorStairAuthoringChanged({
        ...destination,
        template: "STRAIGHT",
        parameters: getSuggestedStairParameters(
          editor.draft,
          editor.activeLevelId,
          destination
        ),
        identifiers: createStairIdentifiers("STRAIGHT")
      })
    );
  }, [
    dispatch,
    editor.activeLevelId,
    editor.activeTool,
    editor.draft,
    stairPlacement
  ]);

  const handleConfirmStairAuthoring = useCallback(() => {
    if (!editor.draft || !stairPlacement || !stairProposal?.valid) return;
    const result = createStaircase(editor.draft, {
      owningLevelId: stairPlacement.owningLevelId,
      staircase: stairProposal.staircase
    });
    if (!result.ok) {
      setEditingError("errors.stair.invalid");
      return;
    }
    setEditingError(undefined);
    dispatch(editingDraftReplaced(result.project));
    dispatch(editorActiveToolChanged("select"));
    dispatch(
      editorSelectionChanged(
        createGeometrySelectionState([
          selectStaircase(stairProposal.staircase.id)
        ])
      )
    );
  }, [dispatch, editor.draft, setEditingError, stairPlacement, stairProposal]);

  return {
    stairPlacement,
    stairProposal,
    sourceRoomCandidates,
    resolvedFromRoomId,
    sourceRoomAmbiguous,
    handleStairDestinationChange,
    handleStairTemplateChange,
    handleStairParametersChange,
    handleStairRotationChange,
    handleStairSourceRoomChange,
    handleCancelStairAuthoring,
    handleConfirmStairAuthoring
  };
}
