import { useEffect, useRef, useState } from "react";
import { useStore } from "react-redux";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import {
  deriveFurnitureEditContext,
  validateFurnitureEditResult,
  type FurnitureEditRequest,
  type FurnitureEditResponse
} from "@casastudio/ai";
import {
  applyFurnitureCommands,
  furnitureRoomCandidates
} from "@casastudio/geometry";
import {
  resolveBuiltinFurnitureDefinition,
  type Point2D,
  type Project
} from "@casastudio/schema";
import { useAppDispatch, useAppSelector } from "../../../../app/store/hooks";
import type { RootState } from "../../../../app/store/store";
import { useCasaStudioApi } from "../../../../core/api/ApiProvider";
import { editingDraftReplaced } from "../../state/project-editor-slice";

type Props = {
  levelId: string;
  roomId?: string;
  selectedFurnitureIds: readonly string[];
  anchorPoint?: Point2D;
  picking: boolean;
  canPick: boolean;
  blocked: boolean;
  onPick: () => void;
  onClearAnchor: () => void;
};

/** Ephemeral review over the normal editor. No Project write occurs before Apply. */
export function AiFurnitureEditPanel(props: Props) {
  const api = useCasaStudioApi();
  const editor = useAppSelector((state) => state.projectEditor);
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const [instructions, setInstructions] = useState("");
  const [roomChoice, setRoomChoice] = useState<{ key: string; id: string }>();
  const [review, setReview] = useState<{
    response: FurnitureEditResponse;
    snapshot: string;
    request: FurnitureEditRequest;
    preview?: Project;
  }>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
    },
    []
  );
  const project = editor.draft;
  if (!project) return null;
  const level = project.building.levels.find(
    (item) => item.id === props.levelId
  );
  const selectedRoom = project.building.furniture.find((item) =>
    props.selectedFurnitureIds.includes(item.id)
  )?.roomId;
  const candidates = props.anchorPoint
    ? furnitureRoomCandidates(project, props.levelId, props.anchorPoint)
    : [];
  const contextKey = JSON.stringify([
    props.levelId,
    props.roomId,
    props.selectedFurnitureIds,
    props.anchorPoint
  ]);
  const chosenRoomId =
    roomChoice?.key === contextKey ? roomChoice.id : undefined;
  const preferredRoom = [chosenRoomId, props.roomId, selectedRoom].find((id) =>
    level?.rooms.some((room) => room.id === id)
  );
  const roomId = props.anchorPoint
    ? (candidates.find(
        (room) => room.roomId === (preferredRoom || selectedRoom)
      )?.roomId ?? (candidates.length === 1 ? candidates[0]!.roomId : ""))
    : preferredRoom || "";
  const roomLabel = (id: string) =>
    level?.rooms.find((room) => room.id === id)?.name ?? id;
  const guarded =
    editor.dirty || props.blocked || Boolean(editor.transient.interaction);
  const stale = Boolean(
    review &&
    (review.snapshot !== JSON.stringify(project) ||
      review.response.projectRevision !== editor.baseRevision)
  );

  const requestProposal = async () => {
    if (guarded || busy || !editor.baseRevision) return;
    const snapshot = JSON.stringify(project);
    const request: FurnitureEditRequest = {
      instructions,
      baseRevision: editor.baseRevision,
      levelId: props.levelId,
      ...(roomId ? { roomId } : {}),
      selectedFurnitureIds: [...props.selectedFurnitureIds],
      ...(props.anchorPoint && roomId
        ? { placementHint: { roomId, position: props.anchorPoint } }
        : {})
    };
    const token = ++sequence.current;
    setBusy(true);
    setMessage(undefined);
    setReview(undefined);
    try {
      if (props.anchorPoint && !roomId)
        throw new Error("Choose the Room containing the placement anchor.");
      const response = await api.proposeFurnitureEdit(project.id, request);
      if (sequence.current !== token) return;
      const result = validateFurnitureEditResult(
        project,
        deriveFurnitureEditContext(project, request),
        response.result
      );
      let index = 0;
      const preview =
        result.kind === "EDIT_PROPOSAL"
          ? applyFurnitureCommands(project, result.operations, () => {
              let id: string;
              do {
                id = `furniture-review-${index++}`;
              } while (
                project.building.furniture.some((item) => item.id === id)
              );
              return id;
            })
          : undefined;
      setReview({
        response: { ...response, result },
        snapshot,
        request,
        preview
      });
    } catch (error) {
      if (sequence.current === token)
        setMessage(
          error instanceof Error ? error.message : "Furniture editing failed."
        );
    } finally {
      if (sequence.current === token) setBusy(false);
    }
  };
  const apply = async () => {
    if (
      !review ||
      review.response.result.kind !== "EDIT_PROPOSAL" ||
      stale ||
      guarded ||
      busy
    )
      return;
    const token = ++sequence.current;
    setBusy(true);
    setMessage(undefined);
    try {
      // Ordinary read only: no parsing/provider call during deterministic application.
      const persisted = await api.getProject(project.id);
      if (sequence.current !== token) return;
      const current = store.getState().projectEditor;
      if (
        current.mode !== "edit" ||
        current.projectId !== project.id ||
        current.dirty ||
        current.transient.interaction ||
        current.baseRevision !== review.response.projectRevision ||
        persisted.project.revision !== review.response.projectRevision ||
        JSON.stringify(current.draft) !== review.snapshot
      )
        throw new Error(
          "This proposal is stale. Save or reload, then request a new proposal."
        );
      const context = deriveFurnitureEditContext(
        current.draft!,
        review.request
      );
      const result = validateFurnitureEditResult(
        current.draft!,
        context,
        review.response.result
      );
      if (result.kind !== "EDIT_PROPOSAL") return;
      const next = applyFurnitureCommands(
        current.draft!,
        result.operations,
        () => `furniture-${crypto.randomUUID().toLowerCase()}`
      );
      dispatch(editingDraftReplaced(next));
      setReview(undefined);
      setMessage("Furniture edit applied. Use Undo, Redo and Save normally.");
    } catch (error) {
      if (sequence.current === token)
        setMessage(
          error instanceof Error
            ? error.message
            : "Furniture edit could not be applied."
        );
    } finally {
      if (sequence.current === token) setBusy(false);
    }
  };
  const cancel = () => {
    sequence.current++;
    setBusy(false);
    setReview(undefined);
    setMessage(undefined);
  };
  return (
    <Accordion
      slotProps={{ transition: { unmountOnExit: true } }}
      disableGutters
      elevation={0}
      sx={{ borderBottom: 1, borderColor: "divider" }}
    >
      <AccordionSummary>
        <Typography variant="subtitle2">AI Furniture editing</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            Edit the actual Project. Review Furniture commands, then Apply.
            Image design proposals are separate.
          </Typography>
          {editor.dirty && (
            <Alert severity="info">
              Save your Project before requesting or applying an AI edit.
            </Alert>
          )}
          {editor.transient.interaction && (
            <Alert severity="info">
              Finish or cancel the current editor gesture first.
            </Alert>
          )}
          <TextField
            select
            label={props.anchorPoint ? "Anchor Room" : "Editing Room"}
            value={roomId}
            onChange={(event) => {
              setRoomChoice({ key: contextKey, id: event.target.value });
              setReview(undefined);
            }}
          >
            <MenuItem value="">Choose a Room</MenuItem>
            {(props.anchorPoint ? candidates : (level?.rooms ?? [])).map(
              (room) => {
                const id = "roomId" in room ? room.roomId : room.id;
                return (
                  <MenuItem key={id} value={id}>
                    {room.name}
                  </MenuItem>
                );
              }
            )}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              disabled={!props.canPick || guarded || busy}
              onClick={props.onPick}
            >
              {props.picking ? "Cancel anchor picker" : "Set here on 2D plan"}
            </Button>
            {props.anchorPoint && (
              <Button size="small" onClick={props.onClearAnchor}>
                Clear anchor
              </Button>
            )}
          </Stack>
          {props.picking && (
            <Alert severity="info">
              Click the plan to set a canonical placement anchor.
            </Alert>
          )}
          {props.anchorPoint && (
            <Typography variant="caption">
              Here: X {props.anchorPoint.x.toFixed(1)}, Z{" "}
              {props.anchorPoint.z.toFixed(1)} cm
            </Typography>
          )}
          {!props.canPick && (
            <Typography variant="caption">
              Set a “here” anchor in 2D, then return to 3D if needed.
            </Typography>
          )}
          <TextField
            label="Furniture edit instruction"
            multiline
            minRows={2}
            value={instructions}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
            onChange={(event) => {
              setInstructions(event.target.value);
              setReview(undefined);
            }}
            disabled={busy}
          />
          <Button
            variant="outlined"
            disabled={guarded || busy || props.picking || !instructions.trim()}
            onClick={() => void requestProposal()}
          >
            Request edit proposal
          </Button>
          {message && <Alert severity="info">{message}</Alert>}
          {review && review.response.result.kind !== "EDIT_PROPOSAL" && (
            <Alert severity="info">
              {review.response.result.kind === "CLARIFICATION_REQUIRED"
                ? "Clarification required: "
                : "Unsupported request: "}
              {review.response.result.message}
            </Alert>
          )}
          {review?.response.result.kind === "EDIT_PROPOSAL" && (
            <Stack spacing={1} data-testid="furniture-edit-review">
              <Typography variant="subtitle2">
                Review canonical changes
              </Typography>
              {review.response.result.operations.map((operation, index) => {
                const before =
                  "furnitureId" in operation
                    ? project.building.furniture.find(
                        (item) => item.id === operation.furnitureId
                      )
                    : undefined;
                const after =
                  "furnitureId" in operation
                    ? review.preview?.building.furniture.find(
                        (item) => item.id === operation.furnitureId
                      )
                    : undefined;
                const describe = (item: typeof before) =>
                  item
                    ? `${roomLabel(item.roomId)}: X ${item.position.x}, Z ${item.position.z} cm, ${item.rotation}°`
                    : "new item";
                return (
                  <Typography key={index} variant="body2">
                    {operation.type.replaceAll("_", " ")} ·{" "}
                    {before?.name ??
                      (before
                        ? (resolveBuiltinFurnitureDefinition(
                            before.definitionId
                          )?.name ?? before.id)
                        : operation.type === "ADD_FURNITURE"
                          ? (resolveBuiltinFurnitureDefinition(
                              operation.definitionId
                            )?.name ?? operation.definitionId)
                          : "Furniture")}
                    <br />
                    {before && (
                      <>
                        Current: {describe(before)}
                        <br />
                      </>
                    )}
                    Proposed:{" "}
                    {operation.type === "ADD_FURNITURE"
                      ? `${operation.definitionId} in ${roomLabel(operation.roomId)}: X ${operation.position.x}, Z ${operation.position.z} cm, ${operation.rotation}° (catalog dimensions)`
                      : describe(after)}
                  </Typography>
                );
              })}
              {stale && (
                <Alert severity="warning">
                  This proposal is stale. Request a new proposal after saving.
                </Alert>
              )}
              <Button
                variant="contained"
                disabled={stale || guarded || busy}
                onClick={() => void apply()}
              >
                Apply changes
              </Button>
            </Stack>
          )}
          {(review || busy) && <Button onClick={cancel}>Cancel edit</Button>}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
