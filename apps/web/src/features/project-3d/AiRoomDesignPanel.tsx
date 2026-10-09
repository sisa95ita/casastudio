import { useProposalLineage } from "./useProposalLineage";
import { RoomDesignHistory } from "./RoomDesignHistory";
import { ProposalReview, type ProposalComparison } from "./ProposalReview";
import { ProposalArtifactView } from "./ProposalArtifactView";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Divider,
  LinearProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import type {
  DesignProposal,
  DesignReferenceView,
  DurableDesignProposal
} from "@casastudio/ai";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiRequestError } from "../../core/api/CasaStudioApiClient";
import { useCasaStudioApi } from "../../core/api/ApiProvider";
import { useCasaTranslation } from "../../core/i18n";
import {
  useDesignGeneration,
  type DesignGeneration
} from "./useDesignGeneration";
import {
  useDesignArtifact,
  useRoomDesignHistory
} from "./useRoomDesignHistory";

export type DesignReferenceViewCapture = () => Promise<
  readonly DesignReferenceView[]
>;

type AiRoomDesignPanelProps = {
  readonly projectId: string;
  readonly levelId: string;
  readonly roomId: string;
  readonly capture?: DesignReferenceViewCapture;
  readonly roomName?: string;
  /** Immutable canonical scene identity; also catches unsaved geometry changes. */
  readonly sceneContext?: object;
  readonly generation?: DesignGeneration;
  readonly projectRevision?: number;
  readonly unsavedChanges?: boolean;
  readonly visible?: boolean;
};

type ReferenceState =
  | { readonly status: "preparing" }
  | { readonly status: "ready"; readonly views: readonly DesignReferenceView[] }
  | { readonly status: "failure" };

type ProposalEntry = ProposalComparison;
type DesignContextIdentity = Readonly<{
  projectId: string;
  levelId: string;
  roomId: string;
  capture?: DesignReferenceViewCapture;
  sceneContext?: object;
}>;

type DesignSession = {
  context: DesignContextIdentity;
  references: ReferenceState;
  proposals: readonly ProposalEntry[];
  activeNumber?: number;
  nextNumber: number;
  outcome: "idle" | "success" | "failure";
  error?: string;
};

const emptySession = (context: DesignContextIdentity): DesignSession => ({
  context,
  references: { status: "preparing" },
  proposals: [],
  nextNumber: 1,
  outcome: "idle"
});

/** Session comparisons and durable Room history for a selected canonical Room. */
export function AiRoomDesignPanel({
  projectId,
  levelId,
  roomId,
  capture,
  roomName,
  sceneContext,
  projectRevision,
  unsavedChanges = false,
  visible = true,
  generation: sharedGeneration
}: AiRoomDesignPanelProps) {
  const api = useCasaStudioApi();
  const history = useRoomDesignHistory(projectId, levelId, roomId);
  const [historicalId, setHistoricalId] = useState<string>();
  const [deleteTarget, setDeleteTarget] = useState<DesignProposal>();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const deletePending = useRef(false);
  const deleteCancelButton = useRef<HTMLButtonElement>(null);
  const { t } = useCasaTranslation("project-viewer");
  const localGeneration = useDesignGeneration();
  // The viewer owns the guard so deselecting/reselecting a Room cannot overlap requests.
  const generation = sharedGeneration ?? localGeneration;
  const generating = generation.state.status === "generating";
  const roomLabel = roomName || roomId;
  const context = useMemo(
    () => ({ projectId, levelId, roomId, capture, sceneContext }),
    [projectId, levelId, roomId, capture, sceneContext]
  );
  const activeContext = useRef(context);
  activeContext.current = context;
  const [instructions, setInstructions] = useState("");
  const [session, setSession] = useState<DesignSession>(() =>
    emptySession(context)
  );
  // Suppress old evidence/results immediately, even before the context effect runs.
  const current = session.context === context ? session : emptySession(context);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [referencePreview, setReferencePreview] =
    useState<DesignReferenceView>();
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const epoch = useRef(0);
  const captureEpoch = useRef(0);
  const capturePending = useRef(false);
  const mounted = useRef(false);
  const referenceViews =
    current.references.status === "ready" ? current.references.views : [];
  const referencePreparing = current.references.status === "preparing";
  const sessionActive = current.proposals.find(
    (entry) => entry.number === current.activeNumber
  );
  const [focused, setFocused] = useState<{
    context: object;
    proposal: DurableDesignProposal;
  }>();
  const [refinementError, setRefinementError] = useState<string>();
  const [staleContext, setStaleContext] = useState<{
    context: object;
    revision: number;
  }>();
  const [refinementPending, setRefinementPending] = useState<string>();
  const selectionEpoch = useRef(0);
  const refinementLock = useRef(false);
  const proposal =
    focused?.context === context
      ? focused.proposal
      : historicalId
        ? history.proposals.find((p) => p.id === historicalId)
        : sessionActive?.proposal;
  const active =
    focused?.context === context
      ? {
          proposal: focused.proposal,
          number: undefined,
          direction: focused.proposal.instructions
        }
      : sessionActive;
  const selectedProposal = useRef(proposal);
  selectedProposal.current = proposal;
  const image = useDesignArtifact(proposal);
  const lineage = useProposalLineage(
    proposal,
    previewOpen || historyOpen,
    context
  );
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    if (!visible) {
      ++selectionEpoch.current;
      setPreviewOpen(false);
      setHistoryOpen(false);
    }
  }, [visible]);
  const openReview = () => {
    lineage.refresh();
    setPreviewOpen(true);
  };
  const navigate = (p: DurableDesignProposal) => {
    ++selectionEpoch.current;
    setRefinementError(undefined);
    setFocused({ context, proposal: p });
  };
  const phase = generating
    ? "generating"
    : referencePreparing
      ? "preparing"
      : current.references.status === "failure" || current.outcome === "failure"
        ? "failure"
        : proposal
          ? "success"
          : "ready";

  async function prepareReferences(
    identity: DesignContextIdentity,
    ticket: number
  ) {
    if (!identity.capture) return;
    capturePending.current = true;
    try {
      const views = await identity.capture();
      const requiredKinds = [
        "room-axonometric",
        "room-interior-a",
        "room-interior-b"
      ];
      if (
        requiredKinds.some(
          (kind) => views.filter((view) => view.kind === kind).length !== 1
        ) ||
        views.some(
          (view) =>
            !view.image.dataUrl ||
            view.target.projectId !== identity.projectId ||
            view.target.levelId !== identity.levelId ||
            view.target.roomId !== identity.roomId
        )
      ) {
        throw new Error("Incomplete or mismatched Room references");
      }
      if (mounted.current && captureEpoch.current === ticket) {
        setSession((value) =>
          value.context === identity
            ? { ...value, references: { status: "ready", views } }
            : value
        );
      }
    } catch {
      if (mounted.current && captureEpoch.current === ticket) {
        setSession((value) =>
          value.context === identity
            ? { ...value, references: { status: "failure" } }
            : value
        );
      }
    } finally {
      if (captureEpoch.current === ticket) capturePending.current = false;
    }
  }

  useEffect(() => {
    mounted.current = true;
    ++epoch.current;
    const ticket = ++captureEpoch.current;
    capturePending.current = false;
    setSession(emptySession(context));
    ++selectionEpoch.current;
    setFocused(undefined);
    setRefinementError(undefined);
    setPreviewOpen(false);
    setHistoricalId(undefined);
    setDeleteTarget(undefined);
    setDeleteError(undefined);
    setReferencePreview(undefined);
    setReferencesOpen(false);
    setHistoryOpen(false);
    void prepareReferences(context, ticket);
    return () => {
      mounted.current = false;
      ++epoch.current;
      ++captureEpoch.current;
    };
  }, [context]);

  const refreshReferences = () => {
    if (!capture || capturePending.current || generating) return;
    ++epoch.current;
    const ticket = ++captureEpoch.current;
    setSession(emptySession(context));
    setFocused(undefined);
    setPreviewOpen(false);
    setReferencePreview(undefined);

    void prepareReferences(context, ticket);
  };

  const changeInstructions = (value: string) => {
    if (value.trim() !== instructions.trim()) {
      // Direction edits invalidate proposals, but do not recapture evidence or submit.
      // A pending paid request keeps its lock; its obsolete completion is ignored.
      ++epoch.current;
      ++selectionEpoch.current;
      setFocused(undefined);
      setSession((previous) => ({
        ...previous,
        proposals: [],
        activeNumber: undefined,
        nextNumber: 1,
        outcome: "idle",
        error: undefined
      }));
      setPreviewOpen(false);
    }
    setInstructions(value);
  };

  const generate = async () => {
    if (
      current.references.status !== "ready" ||
      !instructions.trim() ||
      generating
    )
      return;
    const ticket = epoch.current;
    setSession((value) => ({ ...value, error: undefined, outcome: "idle" }));
    try {
      const result = await generation.run(roomLabel, () =>
        api.generateRoomDesign(projectId, {
          levelId,
          roomId,
          instructions: instructions.trim(),
          referenceViews
        })
      );
      if (!result || !mounted.current) return;
      // The server has persisted even a completion invalidated by a direction edit.
      history.add(result);
      if (ticket !== epoch.current) return;
      setHistoricalId(undefined);
      setFocused(undefined);
      setSession((value) =>
        value.context === context
          ? {
              ...value,
              proposals: [
                ...value.proposals,
                {
                  number: value.nextNumber,
                  proposal: result,
                  direction: instructions.trim()
                }
              ].slice(-3),
              activeNumber: value.nextNumber,
              nextNumber: value.nextNumber + 1,
              outcome: "success"
            }
          : value
      );
    } catch (cause) {
      if (!mounted.current || ticket !== epoch.current) return;
      let message = t("threeD.ai.failure");
      if (cause instanceof ApiRequestError) {
        const code = cause.problem?.code;
        if (code === "AI_RATE_LIMITED") message = cause.problem!.detail;
        else if (code && Object.hasOwn(generationErrorKeys, code))
          message = t(`threeD.ai.errors.${generationErrorKeys[code]}`);
        else if (cause.kind === "network")
          message = t("threeD.ai.errors.connection");
        else if (cause.status === 408 || cause.status === 504)
          message = t("threeD.ai.errors.timeout");
        else if (cause.kind === "invalid-response")
          message = t("threeD.ai.errors.invalidResponse");
      }
      setSession((value) =>
        value.context === context
          ? { ...value, outcome: "failure", error: message }
          : value
      );
    }
  };

  const refine = async (change: string): Promise<boolean> => {
    if (
      !proposal ||
      !("projectRevision" in proposal) ||
      !change.trim() ||
      generating ||
      refinementLock.current ||
      unsavedChanges ||
      (staleContext?.context === context &&
        staleContext.revision === proposal.projectRevision) ||
      projectRevision === undefined ||
      proposal.projectRevision !== projectRevision ||
      current.references.status !== "ready" ||
      deleting
    )
      return false;
    refinementLock.current = true;
    const base = proposal as DurableDesignProposal;
    const identity = context;
    const selection = selectionEpoch.current;
    setRefinementError(undefined);
    setRefinementPending(
      t("threeD.ai.revisions.waiting", {
        room: roomLabel,
        proposal: base.instructions
      })
    );
    try {
      const result = await generation.run(roomLabel, () =>
        api.refineRoomDesign(projectId, base.id, {
          levelId,
          roomId,
          instructions: change.trim(),
          referenceViews
        })
      );
      if (!result || !mounted.current) return false;
      history.add(result);
      if (activeContext.current !== identity) return true;
      lineage.refresh();
      if (
        selection === selectionEpoch.current &&
        selectedProposal.current?.id === base.id &&
        visibleRef.current
      ) {
        setFocused({
          context: identity,
          proposal: result as DurableDesignProposal
        });
      }
      return true;
    } catch (cause) {
      if (
        mounted.current &&
        activeContext.current === identity &&
        selection === selectionEpoch.current
      ) {
        let message = t("threeD.ai.revisions.failure");
        if (cause instanceof ApiRequestError) {
          const code = cause.problem?.code;
          if (code === "AI_STALE_CONTEXT") {
            message = t("threeD.ai.revisions.stale");
            setStaleContext({
              context: identity,
              revision: base.projectRevision
            });
          } else if (code === "AI_RATE_LIMITED")
            message = cause.problem!.detail;
          else if (code && Object.hasOwn(generationErrorKeys, code))
            message = t(`threeD.ai.errors.${generationErrorKeys[code]}`);
          else if (cause.kind === "network")
            message = t("threeD.ai.errors.connection");
          else if (cause.status === 408 || cause.status === 504)
            message = t("threeD.ai.errors.timeout");
          else if (cause.kind === "invalid-response")
            message = t("threeD.ai.errors.invalidResponse");
        }
        setRefinementError(message);
      }
      return false;
    } finally {
      refinementLock.current = false;
      if (mounted.current) setRefinementPending(undefined);
    }
  };

  const deleteProposal = async () => {
    if (!deleteTarget || deletePending.current) return;
    const target = deleteTarget;
    const identity = context;
    deletePending.current = true;
    setDeleting(true);
    setDeleteError(undefined);
    try {
      await api.deleteDesignProposal(target.target.projectId, target.id);
      if (
        !mounted.current ||
        activeContext.current.projectId !== identity.projectId ||
        activeContext.current.levelId !== identity.levelId ||
        activeContext.current.roomId !== identity.roomId
      )
        return;
      history.remove(target.id);
      lineage.refresh();
      if (focused?.proposal.id === target.id) setFocused(undefined);
      setSession((value) => {
        if (value.context !== identity) return value;
        const proposals = value.proposals.filter(
          (entry) => entry.proposal.id !== target.id
        );
        return {
          ...value,
          proposals,
          activeNumber: proposals.some(
            (entry) => entry.number === value.activeNumber
          )
            ? value.activeNumber
            : proposals.at(-1)?.number
        };
      });
      setHistoricalId((value) => (value === target.id ? undefined : value));
      if (selectedProposal.current?.id === target.id) setPreviewOpen(false);
      setDeleteTarget((value) => (value?.id === target.id ? undefined : value));
    } catch (cause) {
      if (mounted.current && activeContext.current === identity)
        setDeleteError(
          t(
            cause instanceof ApiRequestError &&
              cause.problem?.code === "AI_PROPOSAL_HAS_DESCENDANTS"
              ? "threeD.ai.revisions.deleteConflict"
              : "threeD.ai.history.deleteFailed"
          )
        );
    } finally {
      deletePending.current = false;
      if (mounted.current) setDeleting(false);
    }
  };

  const selectSessionProposal = (number: number) => {
    ++selectionEpoch.current;
    setFocused(undefined);
    setRefinementError(undefined);
    setHistoricalId(undefined);
    setSession((value) => ({ ...value, activeNumber: number }));
  };
  const closeReview = () => {
    ++selectionEpoch.current;
    setPreviewOpen(false);
    if (!historyOpen) setHistoricalId(undefined);
  };
  const showDelete = (target: DurableDesignProposal) => {
    setDeleteTarget(target);
    setDeleteError(undefined);
  };

  return (
    <Box
      className="project-3d-designer"
      role="region"
      aria-label={t("threeD.ai.title")}
      data-generation-state={phase}
      data-editor-shortcut-scope="true"
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <AutoAwesomeRoundedIcon color="primary" fontSize="small" />
          <Box>
            <Typography component="h2" variant="h3">
              {t("threeD.ai.title")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("threeD.ai.roomTarget", { room: roomLabel })}
            </Typography>
          </Box>
        </Stack>
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={3}
          maxRows={6}
          value={instructions}
          label={t("threeD.ai.instructions")}
          placeholder={t("threeD.ai.placeholder")}
          helperText={t("threeD.ai.directionHint")}
          slotProps={{ htmlInput: { maxLength: 2000 } }}
          onChange={(event) => changeInstructions(event.target.value)}
        />
        <Button
          variant="contained"
          startIcon={<AutoAwesomeRoundedIcon />}
          disabled={
            current.references.status !== "ready" ||
            !instructions.trim() ||
            generating
          }
          aria-describedby="ai-generation-semantics"
          onClick={() => void generate()}
        >
          {active ? t("threeD.ai.tryAnother") : t("threeD.ai.generate")}
        </Button>
        <Typography
          id="ai-generation-semantics"
          variant="caption"
          color="text.secondary"
        >
          {t(active ? "threeD.ai.tryAnotherHint" : "threeD.ai.generateHint")}
        </Typography>
        <Box
          role="status"
          aria-label={t("threeD.ai.title")}
          aria-live="polite"
          aria-atomic="true"
        >
          {generating ? (
            <LinearProgress
              aria-label={t("threeD.ai.generating")}
              sx={{ mb: 1 }}
            />
          ) : null}
          <Typography variant="caption" color="text.secondary">
            {generating && generation.state.status === "generating"
              ? t("threeD.ai.waiting", { room: generation.state.roomLabel })
              : t(`threeD.ai.states.${phase}`)}
          </Typography>
        </Box>
        {current.references.status === "failure" ? (
          <Alert severity="error">{t("threeD.ai.referenceFailure")}</Alert>
        ) : null}
        {current.error ? <Alert severity="error">{current.error}</Alert> : null}
        <Divider />
        <Typography variant="subtitle2">
          {t("threeD.ai.currentProposal")}
        </Typography>
        {active ? (
          <>
            <Typography variant="caption">
              {active.number === undefined
                ? t("threeD.ai.revisions.current")
                : t("threeD.ai.proposalNumber", { number: active.number })}
            </Typography>
            {current.proposals.length > 1 ? (
              <Stack
                direction="row"
                spacing={0.5}
                role="group"
                aria-label={t("threeD.ai.compare")}
              >
                {current.proposals.map((entry) => (
                  <Button
                    key={entry.proposal.id}
                    size="small"
                    sx={{ flex: 1, minWidth: 0 }}
                    variant={
                      entry.number === active.number ? "contained" : "outlined"
                    }
                    aria-pressed={entry.number === active.number}
                    onClick={() => selectSessionProposal(entry.number)}
                  >
                    {t("threeD.ai.proposalNumber", { number: entry.number })}
                  </Button>
                ))}
              </Stack>
            ) : null}
            <ButtonBase
              aria-label={t("threeD.ai.openPreview")}
              onClick={() => {
                setHistoricalId(undefined);
                openReview();
              }}
              sx={{
                display: "block",
                width: "100%",
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                p: 1,
                "&.Mui-focusVisible": {
                  outline: "3px solid",
                  outlineColor: "primary.main",
                  outlineOffset: 2
                }
              }}
            >
              <ProposalArtifactView
                proposal={active.proposal}
                uri={
                  proposal?.id === active.proposal.id ? image.uri : undefined
                }
                retry={image.retry}
              />
              <Typography variant="caption">
                {t("threeD.ai.openPreview")}
              </Typography>
            </ButtonBase>
            {image.error && !historicalId ? (
              <ProposalArtifactView
                proposal={active.proposal}
                error
                retry={image.retry}
              />
            ) : null}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t("threeD.ai.noProposal")}
          </Typography>
        )}
        <Divider />
        <Box>
          <Typography variant="subtitle2">
            {t("threeD.ai.history.title")}
          </Typography>
          <Typography variant="caption" component="div" role="status">
            {history.loading
              ? t("threeD.ai.history.loading")
              : history.error
                ? t("threeD.ai.history.failed")
                : t("threeD.ai.history.count", {
                    count: history.proposals.length
                  })}
            {history.nextCursor ? ` · ${t("threeD.ai.history.more")}` : ""}
          </Typography>
          <Button size="small" onClick={() => setHistoryOpen(true)}>
            {t("threeD.ai.history.open")}
          </Button>
        </Box>
        <Divider />
        <Box>
          <Typography variant="caption" component="div">
            {t(
              current.references.status === "ready"
                ? "threeD.ai.referencesReady"
                : referencePreparing
                  ? "threeD.ai.referencePreparing"
                  : "threeD.ai.referencesUnavailable"
            )}
          </Typography>
          <Button size="small" onClick={() => setReferencesOpen(true)}>
            {t("threeD.ai.inspectReferences")}
          </Button>
        </Box>
      </Stack>
      <Dialog
        open={referencesOpen}
        onClose={() => setReferencesOpen(false)}
        fullWidth
        maxWidth="md"
        data-editor-shortcut-scope="true"
        aria-labelledby="reference-inspection-title"
      >
        <DialogTitle id="reference-inspection-title">
          {t("threeD.ai.references")}
        </DialogTitle>
        <DialogContent dividers>
          {referencePreparing ? (
            <Typography role="status">
              {t("threeD.ai.referencePreparing")}
            </Typography>
          ) : null}
          {current.references.status === "failure" ? (
            <Alert severity="error">{t("threeD.ai.referenceFailure")}</Alert>
          ) : null}
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography
              id="ai-reference-refresh-hint"
              variant="caption"
              color="text.secondary"
            >
              {t("threeD.ai.refreshHint")}
            </Typography>
            <Button
              size="small"
              disabled={!capture || referencePreparing || generating}
              aria-describedby="ai-reference-refresh-hint"
              onClick={refreshReferences}
            >
              {t("threeD.ai.refreshReferences")}
            </Button>
          </Stack>
          <Stack direction="row" spacing={0.75}>
            {referenceViews.map((reference) => (
              <ButtonBase
                key={reference.kind}
                aria-label={t(`threeD.ai.referenceKinds.${reference.kind}`)}
                onClick={() => setReferencePreview(reference)}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  "&.Mui-focusVisible": {
                    outline: "3px solid",
                    outlineColor: "primary.main",
                    outlineOffset: 2
                  }
                }}
              >
                <Box
                  component="img"
                  src={reference.image.dataUrl}
                  alt={t(`threeD.ai.referenceKinds.${reference.kind}`)}
                  sx={{
                    aspectRatio: "4 / 3",
                    display: "block",
                    objectFit: "contain",
                    width: "100%"
                  }}
                />
              </ButtonBase>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => setReferencesOpen(false)}>
            {t("threeD.ai.closePreview")}
          </Button>
        </DialogActions>
      </Dialog>
      <RoomDesignHistory
        open={historyOpen}
        roomLabel={roomLabel}
        history={history}
        proposal={proposal}
        image={image}
        projectRevision={projectRevision}
        onClose={() => {
          setHistoryOpen(false);
          setHistoricalId(undefined);
        }}
        onSelect={(id) => {
          ++selectionEpoch.current;
          setFocused(undefined);
          setRefinementError(undefined);
          setHistoricalId(id);
        }}
        onReview={openReview}
        deleteBlocked={generating || lineage.children.length > 0}
        onDelete={showDelete}
      />
      <ProposalReview
        open={previewOpen}
        proposal={proposal}
        uri={image.uri}
        error={image.error}
        retry={image.retry}
        entries={current.proposals}
        activeNumber={
          focused?.context === context || historicalId
            ? undefined
            : active?.number
        }
        direction={active?.direction}
        projectRevision={projectRevision}
        lineage={lineage}
        onNavigate={navigate}
        onRefine={refine}
        refinementPending={
          generating
            ? (refinementPending ??
              t("threeD.ai.waiting", {
                room:
                  generation.state.status === "generating"
                    ? generation.state.roomLabel
                    : roomLabel
              }))
            : undefined
        }
        refinementError={refinementError}
        refinementBlocked={
          staleContext?.context === context &&
          proposal &&
          "projectRevision" in proposal &&
          staleContext.revision === proposal.projectRevision
            ? t("threeD.ai.revisions.stale")
            : unsavedChanges
              ? t("threeD.ai.revisions.unsaved")
              : undefined
        }
        referencesReady={current.references.status === "ready" && !deleting}
        onSelect={selectSessionProposal}
        onClose={closeReview}
        onDelete={showDelete}
      />
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(undefined);
        }}
        data-editor-shortcut-scope="true"
        aria-labelledby="delete-design-title"
        aria-describedby="delete-design-description"
        slotProps={{
          // Parent modal focus enforcement can intercept React's mount-time
          // autoFocus. Wait until this modal is entered and owns the focus trap.
          transition: {
            onEntered: () => deleteCancelButton.current?.focus()
          }
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="delete-design-title">
          {t("threeD.ai.history.deleteTitle")}
        </DialogTitle>
        <DialogContent>
          <Typography id="delete-design-description">
            {t("threeD.ai.history.deleteDescription")}
          </Typography>
          {deleteError ? <Alert severity="error">{deleteError}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button
            ref={deleteCancelButton}
            autoFocus
            disabled={deleting}
            onClick={() => setDeleteTarget(undefined)}
          >
            {t("threeD.ai.history.cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleting}
            onClick={() => void deleteProposal()}
          >
            {t(
              deleting
                ? "threeD.ai.history.deleting"
                : "threeD.ai.history.confirmDelete"
            )}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        data-editor-shortcut-scope="true"
        open={session.context === context && Boolean(referencePreview)}
        onClose={() => setReferencePreview(undefined)}
        aria-labelledby="ai-reference-preview-title"
        maxWidth={false}
      >
        <DialogTitle id="ai-reference-preview-title">
          {referencePreview
            ? t(`threeD.ai.referenceKinds.${referencePreview.kind}`)
            : t("threeD.ai.references")}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1 }}>
          {referencePreview ? (
            <Box
              component="img"
              src={referencePreview.image.dataUrl}
              alt={t(`threeD.ai.referenceKinds.${referencePreview.kind}`)}
              style={{
                maxHeight: "calc(100dvh - 160px)",
                maxWidth: "calc(100vw - 64px)",
                objectFit: "contain"
              }}
              sx={{ display: "block", height: "auto", width: "auto" }}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => setReferencePreview(undefined)}>
            {t("threeD.ai.closePreview")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Stable normalized categories only; unknown/raw failures never reach the UI.
const generationErrorKeys: Record<string, string> = {
  AI_PROPOSAL_PERSISTENCE_FAILED: "persistence",
  AI_PROVIDER_NOT_CONFIGURED: "notConfigured",
  AI_AUTHENTICATION_FAILED: "authentication",
  AI_MODEL_ACCESS_FAILED: "modelAccess",
  AI_GENERATION_TIMEOUT: "timeout",
  AI_PROVIDER_UNAVAILABLE: "unavailable",
  AI_GENERATION_FAILED: "generation",
  AI_INVALID_PROVIDER_RESPONSE: "invalidResponse",
  AI_MISSING_REFERENCE: "references",
  AI_UNSUPPORTED_TARGET: "target"
};
