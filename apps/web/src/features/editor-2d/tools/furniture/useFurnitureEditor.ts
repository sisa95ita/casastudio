import {
  deleteFurniture,
  resizeFurniture,
  rotateFurniture,
  resolveFurnitureRoom,
  type Project,
  type ProjectEditingResult
} from "@casastudio/schema";
import type { AppDispatch } from "../../../../app/store/store";
import {
  editingDraftReplaced,
  editorActiveToolChanged,
  editorFurnitureChanged,
  editorSelectionChanged,
  editorTransientInteractionCleared,
  type ProjectEditorState
} from "../../state/project-editor-slice";
import {
  createGeometrySelectionState,
  type GeometrySelectionState
} from "../../../geometry-2d/selection/geometry-selection-state";
import {
  commitFurnitureInteraction,
  furnitureRoomCandidates,
  positionFurniture,
  startFurniturePlacement,
  validateFurniturePlacement,
  type FurniturePlacementIssue,
  type FurniturePropertyChanges,
  type FurnitureInteraction
} from "./project-furniture-authoring";
import type { SvgViewportPointer } from "../../../geometry-2d/viewer/GeometrySvgViewer";
import {
  createFurniturePlan2D,
  createFurniturePresentation2D
} from "../../../geometry-2d/presentation/furniture-presentation-model-2d";
import { useEffect, useMemo, useRef, useState } from "react";
import { resolveFurniturePrecisionTranslation } from "../../precision/project-precision-assistance";

type Options = {
  readonly project?: Project | null;
  readonly levelId?: string;
  readonly editor: ProjectEditorState;
  readonly dispatch: AppDispatch;
  readonly selection: GeometrySelectionState;
  readonly editable: boolean;
  readonly visible: boolean;
  readonly zoom?: number;
  readonly snapToGrid?: boolean;
  readonly gridSpacing?: number;
};

/** Coordinates Furniture proposals, canonical operations, and one snapshot per confirmed edit. */
export function useFurnitureEditor({
  project,
  levelId,
  editor,
  dispatch,
  selection,
  editable,
  visible,
  zoom = 1,
  snapToGrid = false,
  gridSpacing = 100
}: Options) {
  const lastCanvasPointerRef = useRef<SvgViewportPointer | undefined>(
    undefined
  );
  const furnitureAuthoringActive = editable && editor.activeTool === "furniture";
  const previousAuthoringActiveRef = useRef(false);
  useEffect(() => {
    if (furnitureAuthoringActive && !previousAuthoringActiveRef.current) {
      lastCanvasPointerRef.current = undefined;
    }
    previousAuthoringActiveRef.current = furnitureAuthoringActive;
  }, [furnitureAuthoringActive]);
  const [error, setError] = useState<
    FurniturePlacementIssue | "EDIT_FAILED" | undefined
  >();
  return useMemo(() => {
    const transient =
      editable && editor.transient.interaction?.kind === "furniture"
        ? editor.transient.interaction
        : undefined;
    const selectedId =
      selection.selected.length === 1 &&
      selection.selected[0]?.kind === "FURNITURE"
        ? selection.selected[0].geometryId
        : undefined;
    const selected = visible
      ? project?.building.furniture.find((item) => item.id === selectedId)
      : undefined;
    const authoring = furnitureAuthoringActive;
    const setTransient = (value: FurnitureInteraction) => {
      setError(undefined);
      dispatch(editorFurnitureChanged(value));
    };
    const cancel = () => {
      setError(undefined);
      dispatch(editorTransientInteractionCleared());
    };
    const apply = (result: ProjectEditingResult | undefined) => {
      if (!editable || !result?.ok) {
        setError("EDIT_FAILED");
        return false;
      }
      setError(undefined);
      dispatch(editingDraftReplaced(result.project));
      return true;
    };
    const commit = (proposal = transient) => {
      if (!editable || !project || !levelId || !proposal) return false;
      const validation = validateFurniturePlacement(
        project,
        levelId,
        proposal.item,
        proposal.intent === "move" || proposal.intent === "rotate"
          ? proposal.sourceId
          : undefined
      );
      if (validation.status === "INVALID") {
        setError(validation.issue);
        return false;
      }
      const result = commitFurnitureInteraction(
        project,
        levelId,
        proposal,
        `furniture-${crypto.randomUUID().toLowerCase()}`
      );
      if (!apply(result)) return false;
      if (proposal.intent === "place" || proposal.intent === "duplicate") {
        setTransient({
          ...proposal,
          intent: "place",
          sourceId: undefined,
          positioned: false,
          previewVisible: false,
          gesture: undefined,
          awaitingRoom: false
        });
      } else cancel();
      return true;
    };
    const chooseDefinition = (id: string) => {
      if (!editable || !project || !levelId) return;
      const next = startFurniturePlacement(id);
      if (!next) return;
      const currentPosition =
        lastCanvasPointerRef.current?.worldPoint ??
        (transient?.positioned ? transient.item.position : undefined);
      const proposal = { ...next, explicitRoomId: transient?.explicitRoomId };
      setTransient(
        currentPosition
          ? positionFurniture(project, levelId, proposal, currentPosition)
          : proposal
      );
    };
    const positionWithPrecision = (
      interaction: FurnitureInteraction,
      position: { readonly x: number; readonly z: number },
      pointer: SvgViewportPointer
    ): FurnitureInteraction => {
      if (!project || !levelId) return interaction;
      const raw = positionFurniture(project, levelId, interaction, position);
      const rawValidation = validateFurniturePlacement(
        project,
        levelId,
        raw.item,
        raw.intent === "move" || raw.intent === "rotate"
          ? raw.sourceId
          : undefined
      );
      const precision = resolveFurniturePrecisionTranslation({
        project,
        levelId,
        moving: [raw.item],
        rawDelta: { x: 0, z: 0 },
        pixelsPerWorldUnit: Math.max(
          Number.EPSILON,
          zoom * pointer.cssPixelsPerSvgUnit
        ),
        grid: { enabled: snapToGrid, spacing: gridSpacing },
        bypass: pointer.altKey || rawValidation.status === "INVALID",
        previous: interaction.precision,
        isValid: (correction) => {
          const candidate = positionFurniture(project, levelId, raw, {
            x: raw.item.position.x + correction.x,
            z: raw.item.position.z + correction.z
          });
          return (
            validateFurniturePlacement(
              project,
              levelId,
              candidate.item,
              candidate.intent === "move" || candidate.intent === "rotate"
                ? candidate.sourceId
                : undefined
            ).status !== "INVALID"
          );
        }
      });
      const positioned = positionFurniture(project, levelId, raw, {
        x: raw.item.position.x + precision.delta.x,
        z: raw.item.position.z + precision.delta.z
      });
      return { ...positioned, precision };
    };
    const pointerMove = (pointer: SvgViewportPointer, pointerId: number) => {
      if (authoring && transient) lastCanvasPointerRef.current = pointer;
      if (
        !editable ||
        !project ||
        !levelId ||
        !transient ||
        transient.awaitingRoom
      )
        return;
      const gesture = transient.gesture;
      if (gesture) {
        if (gesture.pointerId !== pointerId) return;
        const item = gesture.original;
        if (transient.intent === "rotate") {
          const initial = Math.atan2(
            gesture.start.z - item.position.z,
            gesture.start.x - item.position.x
          );
          const current = Math.atan2(
            pointer.worldPoint.z - item.position.z,
            pointer.worldPoint.x - item.position.x
          );
          const delta = Math.atan2(
            Math.sin(initial - current),
            Math.cos(initial - current)
          );
          setTransient({
            ...transient,
            item: {
              ...transient.item,
              rotation: item.rotation + (delta * 180) / Math.PI
            }
          });
        } else {
          setTransient(
            positionWithPrecision(
              transient,
              {
                x: item.position.x + pointer.worldPoint.x - gesture.start.x,
                z: item.position.z + pointer.worldPoint.z - gesture.start.z
              },
              pointer
            )
          );
        }
      } else if (authoring)
        setTransient(
          positionWithPrecision(transient, pointer.worldPoint, pointer)
        );
    };
    const canvasClick = (pointer: SvgViewportPointer) => {
      if (!editable || !authoring || !transient || !project || !levelId) return;
      const proposal = transient.positioned
        ? transient
        : positionWithPrecision(transient, pointer.worldPoint, pointer);
      if (!proposal.item.roomId) setTransient(proposal);
      else {
        const validation = validateFurniturePlacement(
          project,
          levelId,
          proposal.item,
          proposal.intent === "move" || proposal.intent === "rotate"
            ? proposal.sourceId
            : undefined
        );
        if (validation.status === "INVALID") {
          setTransient(proposal);
          setError(validation.issue);
        } else commit(proposal);
      }
    };
    const beginGesture = (
      id: string,
      intent: "move" | "rotate",
      pointer: SvgViewportPointer,
      pointerId: number
    ) => {
      if (!editable || editor.activeTool !== "select") return;
      const item = project?.building.furniture.find((entry) => entry.id === id);
      if (!item) return;
      dispatch(
        editorSelectionChanged(
          createGeometrySelectionState([{ kind: "FURNITURE", geometryId: id }])
        )
      );
      setTransient({
        kind: "furniture",
        intent,
        item,
        sourceId: id,
        positioned: true,
        previewVisible: true,
        gesture: { pointerId, start: pointer.worldPoint, original: item }
      });
    };
    const endGesture = (dragged: boolean) => {
      if (!editable || !transient?.gesture) return;
      if (!dragged) {
        cancel();
        return;
      }
      if (
        !transient.item.roomId &&
        project &&
        levelId &&
        furnitureRoomCandidates(project, levelId, transient.item.position)
          .length > 1
      ) {
        setTransient({ ...transient, gesture: undefined, awaitingRoom: true });
      } else if (!commit()) {
        dispatch(editorTransientInteractionCleared());
      }
    };
    const update = (changes: FurniturePropertyChanges): boolean => {
      if (!editable || !project || !levelId) return false;
      if (
        [changes.width, changes.depth, changes.height].some(
          (value) =>
            value !== undefined && (!Number.isFinite(value) || value <= 0)
        ) ||
        (changes.rotation !== undefined && !Number.isFinite(changes.rotation))
      ) {
        setError("EDIT_FAILED");
        return false;
      }
      if (authoring && transient) {
        setTransient({ ...transient, item: { ...transient.item, ...changes } });
        return true;
      }
      if (!selected) return false;
      if (changes.position || changes.roomId) {
        const proposal = positionFurniture(
          project,
          levelId,
          {
            kind: "furniture",
            intent: "move",
            sourceId: selected.id,
            item: { ...selected, roomId: changes.roomId ?? selected.roomId },
            positioned: true
          },
          changes.position ?? selected.position
        );
        if (changes.roomId && proposal.item.roomId !== changes.roomId) {
          setError("EDIT_FAILED");
          return false;
        }
        if (
          !proposal.item.roomId &&
          furnitureRoomCandidates(project, levelId, proposal.item.position)
            .length > 1
        ) {
          setTransient({ ...proposal, awaitingRoom: true });
          return true;
        }
        const validation = validateFurniturePlacement(
          project,
          levelId,
          proposal.item,
          selected.id
        );
        if (validation.status === "INVALID") {
          setError(validation.issue);
          return false;
        }
        return apply(
          commitFurnitureInteraction(project, levelId, proposal, selected.id)
        );
      }
      if (changes.rotation !== undefined) {
        const proposed = { ...selected, rotation: changes.rotation };
        const validation = validateFurniturePlacement(
          project,
          levelId,
          proposed,
          selected.id
        );
        if (validation.status === "INVALID") {
          setError(validation.issue);
          return false;
        }
        return apply(
          rotateFurniture(project, {
            furnitureId: selected.id,
            rotation: changes.rotation
          })
        );
      }
      const proposed = {
        ...selected,
        width: changes.width ?? selected.width,
        depth: changes.depth ?? selected.depth,
        height: changes.height ?? selected.height
      };
      const validation = validateFurniturePlacement(
        project,
        levelId,
        proposed,
        selected.id
      );
      if (validation.status === "INVALID") {
        setError(validation.issue);
        return false;
      }
      return apply(
        resizeFurniture(project, {
          furnitureId: selected.id,
          width: proposed.width,
          depth: proposed.depth,
          height: proposed.height
        })
      );
    };
    const chooseRoom = (roomId: string) => {
      if (!editable || !project || !levelId) return;
      const item = transient?.item ?? selected;
      if (
        !item ||
        !furnitureRoomCandidates(project, levelId, item.position).some(
          (candidate) => candidate.roomId === roomId
        )
      )
        return;
      if (transient)
        setTransient({
          ...transient,
          explicitRoomId: roomId,
          item: { ...item, roomId }
        });
      else update({ roomId });
    };
    const duplicate = () => {
      if (!editable || !selected) return;
      dispatch(editorActiveToolChanged("furniture"));
      setTransient({
        kind: "furniture",
        intent: "duplicate",
        item: { ...selected },
        explicitRoomId: selected.roomId,
        sourceId: selected.id,
        positioned: false,
        previewVisible: false
      });
    };
    const remove = () => {
      if (
        editable &&
        project &&
        selected &&
        apply(deleteFurniture(project, { furnitureId: selected.id }))
      )
        cancel();
    };
    const item = transient?.item ?? selected;
    const candidates =
      project && levelId && item && (!authoring || transient?.positioned)
        ? furnitureRoomCandidates(project, levelId, item.position)
        : [];
    const validation =
      project && levelId && item && (selected || transient?.positioned)
        ? validateFurniturePlacement(
            project,
            levelId,
            item,
            transient
              ? transient.intent === "move" || transient.intent === "rotate"
                ? transient.sourceId
                : undefined
              : selected?.id
          )
        : undefined;
    return {
      authoring,
      transient,
      selected,
      item,
      error,
      validation,
      candidates,
      chooseDefinition,
      chooseRoom,
      update,
      duplicate,
      remove,
      cancel,
      commit,
      room:
        project && item?.roomId
          ? resolveFurnitureRoom(project, item)
          : undefined,
      model: project && levelId ? createFurniturePlan2D(project, levelId) : [],
      preview:
        transient && (transient.positioned || transient.previewVisible)
          ? createFurniturePresentation2D({
              ...transient.item,
              id:
                transient.intent === "move" || transient.intent === "rotate"
                  ? transient.item.id
                  : "furniture-preview"
            })
          : undefined,
      previewValid:
        Boolean(transient?.positioned) && validation?.status !== "INVALID",
      pointerMove,
      canvasClick,
      beginGesture,
      endGesture
    };
  }, [
    project,
    levelId,
    editor,
    dispatch,
    selection,
    editable,
    visible,
    error,
    zoom,
    snapToGrid,
    gridSpacing,
    furnitureAuthoringActive
  ]);
}

/** Shared Furniture controller contract for contextual Properties and canvas integration. */
export type FurnitureEditorController = ReturnType<typeof useFurnitureEditor>;
