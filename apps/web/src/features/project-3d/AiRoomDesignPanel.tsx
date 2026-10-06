import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  ButtonBase,
  LinearProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
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
};

type ReferenceState =
  | { readonly status: "preparing" }
  | { readonly status: "ready"; readonly views: readonly DesignReferenceView[] }
  | { readonly status: "failure" };

type ProposalEntry = Readonly<{ number: number; proposal: DesignProposal }>;
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
  generation: sharedGeneration
}: AiRoomDesignPanelProps) {
  const api = useCasaStudioApi();
  const history = useRoomDesignHistory(projectId, levelId, roomId);
  const [historicalId, setHistoricalId] = useState<string>();
  const [deleteTarget, setDeleteTarget] = useState<DesignProposal>();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const deletePending = useRef(false);
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
  const [referencesExpanded, setReferencesExpanded] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const epoch = useRef(0);
  const captureEpoch = useRef(0);
  const capturePending = useRef(false);
  const mounted = useRef(false);
  const referenceViews =
    current.references.status === "ready" ? current.references.views : [];
  const referencePreparing = current.references.status === "preparing";
  const active = current.proposals.find(
    (entry) => entry.number === current.activeNumber
  );
  const proposal =
    (historicalId
      ? history.proposals.find((p) => p.id === historicalId)
      : undefined) ?? active?.proposal;
  const selectedProposal = useRef(proposal);
  selectedProposal.current = proposal;
  const saved =
    proposal && "projectRevision" in proposal
      ? (proposal as DurableDesignProposal)
      : undefined;
  const image = useDesignArtifact(proposal);
  const sessionIds = new Set(
    current.proposals.map((entry) => entry.proposal.id)
  );
  const historyOnly = history.proposals.filter((p) => !sessionIds.has(p.id));
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
    setPreviewOpen(false);
    setHistoricalId(undefined);
    setDeleteTarget(undefined);
    setDeleteError(false);
    setReferencePreview(undefined);
    setReferencesExpanded(true);
    setDetailsExpanded(false);
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
    setPreviewOpen(false);
    setReferencePreview(undefined);
    setReferencesExpanded(true);
    setDetailsExpanded(false);
    void prepareReferences(context, ticket);
  };

  const changeInstructions = (value: string) => {
    if (value.trim() !== instructions.trim()) {
      // Direction edits invalidate proposals, but do not recapture evidence or submit.
      // A pending paid request keeps its lock; its obsolete completion is ignored.
      ++epoch.current;
      setSession((previous) => ({
        ...previous,
        proposals: [],
        activeNumber: undefined,
        nextNumber: 1,
        outcome: "idle",
        error: undefined
      }));
      setPreviewOpen(false);
      setDetailsExpanded(false);
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
      setSession((value) =>
        value.context === context
          ? {
              ...value,
              proposals: [
                ...value.proposals,
                { number: value.nextNumber, proposal: result }
              ].slice(-3),
              activeNumber: value.nextNumber,
              nextNumber: value.nextNumber + 1,
              outcome: "success"
            }
          : value
      );
      setReferencesExpanded(false);
      setDetailsExpanded(false);
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

  const deleteProposal = async () => {
    if (!deleteTarget || deletePending.current) return;
    const target = deleteTarget;
    const identity = context;
    deletePending.current = true;
    setDeleting(true);
    setDeleteError(false);
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
    } catch {
      if (mounted.current && activeContext.current === identity)
        setDeleteError(true);
    } finally {
      deletePending.current = false;
      if (mounted.current) setDeleting(false);
    }
  };

  return (
    <Paper
      className="project-3d-ai-panel"
      elevation={6}
      role="region"
      aria-label={t("threeD.ai.title")}
      data-generation-state={phase}
      data-editor-shortcut-scope="true"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <AutoAwesomeRoundedIcon color="primary" fontSize="small" />
          <Box>
            <Typography variant="subtitle2">{t("threeD.ai.title")}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t("threeD.ai.roomTarget", { room: roomLabel })}
            </Typography>
          </Box>
        </Stack>
        <Accordion
          disableGutters
          expanded={referencesExpanded}
          onChange={(_, expanded) => setReferencesExpanded(expanded)}
          sx={{
            boxShadow: "none",
            border: "1px solid",
            borderColor: "divider",
            "&:before": { display: "none" }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreRoundedIcon />}
            aria-controls="ai-reference-content"
            id="ai-reference-summary"
          >
            <Typography variant="caption">
              {t("threeD.ai.references")}
            </Typography>
          </AccordionSummary>
          <AccordionDetails id="ai-reference-content" sx={{ p: 1, pt: 0 }}>
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
                      objectFit: "cover",
                      width: "100%"
                    }}
                  />
                </ButtonBase>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
        <TextField
          size="small"
          multiline
          minRows={2}
          maxRows={4}
          value={instructions}
          label={t("threeD.ai.instructions")}
          placeholder={t("threeD.ai.placeholder")}
          helperText={t("threeD.ai.directionHint")}
          slotProps={{ htmlInput: { maxLength: 2000 } }}
          onChange={(event) => changeInstructions(event.target.value)}
        />
        <Button
          variant="contained"
          size="small"
          startIcon={<AutoAwesomeRoundedIcon />}
          disabled={
            current.references.status !== "ready" ||
            !instructions.trim() ||
            generating
          }
          aria-describedby="ai-generation-semantics"
          onClick={() => void generate()}
        >
          {proposal ? t("threeD.ai.tryAnother") : t("threeD.ai.generate")}
        </Button>
        <Typography
          id="ai-generation-semantics"
          variant="caption"
          color="text.secondary"
        >
          {t(proposal ? "threeD.ai.tryAnotherHint" : "threeD.ai.generateHint")}
        </Typography>
        <Box
          role="status"
          aria-label={t("threeD.ai.title")}
          aria-live="polite"
          aria-atomic="true"
          sx={{ minHeight: 44 }}
        >
          {generating ? (
            <LinearProgress
              aria-label={t("threeD.ai.generating")}
              sx={{ mb: 0.75 }}
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
        {current.error ? (
          <Alert severity="error" sx={{ overflowWrap: "anywhere" }}>
            {current.error}
          </Alert>
        ) : null}
        <Box>
          <Typography variant="subtitle2">
            {t("threeD.ai.history.title")}
          </Typography>
          <Typography variant="caption" component="div">
            {t("threeD.ai.history.hint")}
          </Typography>
          {history.loading ? (
            <Typography variant="caption" role="status">
              {t("threeD.ai.history.loading")}
            </Typography>
          ) : null}
          {history.error ? (
            <Alert severity="error">{t("threeD.ai.history.failed")}</Alert>
          ) : null}
          {!history.loading &&
          !history.error &&
          history.proposals.length === 0 ? (
            <Typography variant="caption">
              {t("threeD.ai.history.empty")}
            </Typography>
          ) : null}
          <Stack
            spacing={0.5}
            sx={{ maxHeight: 160, overflowY: "auto", mt: 0.5 }}
          >
            {historyOnly.map((p) => (
              <Button
                key={p.id}
                size="small"
                variant={historicalId === p.id ? "contained" : "outlined"}
                aria-pressed={historicalId === p.id}
                onClick={() => {
                  setHistoricalId(p.id);
                  setPreviewOpen(false);
                  setDetailsExpanded(false);
                }}
                sx={{
                  justifyContent: "flex-start",
                  textAlign: "left",
                  textTransform: "none"
                }}
              >
                <Box>
                  <Typography variant="caption" component="div">
                    {new Date(p.createdAt).toLocaleString()}
                  </Typography>
                  <Typography
                    variant="caption"
                    component="div"
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {p.instructions}
                  </Typography>
                  {projectRevision !== undefined &&
                  p.projectRevision !== projectRevision ? (
                    <Typography variant="caption" component="div">
                      {t("threeD.ai.history.historical", {
                        revision: p.projectRevision
                      })}
                    </Typography>
                  ) : null}
                </Box>
              </Button>
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              disabled={history.loading}
              onClick={() => void history.load()}
            >
              {t("threeD.ai.history.refresh")}
            </Button>
            {history.nextCursor ? (
              <Button
                size="small"
                disabled={history.loading}
                onClick={() => void history.load(history.nextCursor)}
              >
                {t("threeD.ai.history.older")}
              </Button>
            ) : null}
          </Stack>
        </Box>
        {proposal ? (
          <Box>
            <Typography variant="caption" color="text.secondary">
              {historicalId
                ? t("threeD.ai.history.selected")
                : t("threeD.ai.proposalNumber", { number: active?.number })}
            </Typography>
            {current.proposals.length > 1 ? (
              <Stack
                direction="row"
                spacing={0.5}
                role="group"
                aria-label={t("threeD.ai.compare")}
                sx={{ mt: 0.5 }}
              >
                {current.proposals.map((entry) => (
                  <Button
                    key={entry.number}
                    size="small"
                    sx={{ flex: 1, minWidth: 0 }}
                    variant={
                      entry.number === active?.number ? "contained" : "outlined"
                    }
                    aria-pressed={entry.number === active?.number}
                    onClick={() => {
                      setHistoricalId(undefined);
                      setSession((value) => ({
                        ...value,
                        activeNumber: entry.number
                      }));
                      setDetailsExpanded(false);
                    }}
                  >
                    {t("threeD.ai.proposalNumber", { number: entry.number })}
                  </Button>
                ))}
              </Stack>
            ) : null}
            <Typography
              variant="caption"
              component="div"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              {historicalId
                ? t("threeD.ai.history.saved")
                : t("threeD.ai.transientHint")}
            </Typography>
            {saved ? (
              <Box sx={{ my: 0.5 }}>
                <Typography variant="caption" component="div">
                  {new Date(saved.createdAt).toLocaleString()} ·{" "}
                  {t("threeD.ai.history.revision", {
                    revision: saved.projectRevision
                  })}
                </Typography>
                <Typography
                  variant="caption"
                  component="div"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {saved.instructions}
                </Typography>
                {projectRevision !== undefined &&
                saved.projectRevision !== projectRevision ? (
                  <Alert severity="info">
                    {t("threeD.ai.history.historical", {
                      revision: saved.projectRevision
                    })}
                  </Alert>
                ) : null}
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    setDeleteTarget(saved);
                    setDeleteError(false);
                  }}
                >
                  {t("threeD.ai.history.delete")}
                </Button>
              </Box>
            ) : null}
            {image.error ? (
              <Alert
                severity="error"
                action={
                  <Button size="small" onClick={image.retry}>
                    {t("threeD.ai.history.retryImage")}
                  </Button>
                }
              >
                {t("threeD.ai.history.imageFailed")}
              </Alert>
            ) : null}
            {!image.uri && !image.error ? (
              <Typography variant="caption" role="status">
                {t("threeD.ai.history.imageLoading")}
              </Typography>
            ) : null}
            <ButtonBase
              disabled={!image.uri}
              aria-label={t("threeD.ai.openPreview")}
              onClick={() => setPreviewOpen(true)}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                display: "block",
                mt: 0.5,
                overflow: "hidden",
                position: "relative",
                width: "100%",
                "&.Mui-focusVisible": {
                  outline: "3px solid",
                  outlineColor: "primary.main",
                  outlineOffset: 2
                }
              }}
            >
              <Box
                component="img"
                src={image.uri}
                alt={t("threeD.ai.proposalAlt")}
                sx={{
                  display: "block",
                  width: "100%",
                  maxHeight: "35dvh",
                  objectFit: "contain"
                }}
              />
              <Box
                sx={{
                  alignItems: "center",
                  backgroundColor: "rgba(17, 24, 39, 0.82)",
                  borderRadius: 0.75,
                  bottom: 8,
                  color: "common.white",
                  display: "flex",
                  gap: 0.5,
                  px: 1,
                  py: 0.5,
                  position: "absolute",
                  right: 8
                }}
              >
                <OpenInFullRoundedIcon sx={{ fontSize: 15 }} />
                <Typography component="span" variant="caption">
                  {t("threeD.ai.openPreview")}
                </Typography>
              </Box>
            </ButtonBase>
            {proposal.telemetry ? (
              <Accordion
                disableGutters
                expanded={detailsExpanded}
                onChange={(_, expanded) => setDetailsExpanded(expanded)}
                aria-label={t("threeD.ai.telemetry.title")}
                sx={{
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  mt: 0.75,
                  px: 1,
                  py: 0.75
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreRoundedIcon />}
                  aria-controls="ai-telemetry-content"
                  id="ai-telemetry-summary"
                  sx={{ px: 0 }}
                >
                  <Typography variant="caption">
                    {t("threeD.ai.telemetry.title")}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails
                  id="ai-telemetry-content"
                  sx={{ p: 0, overflowWrap: "anywhere" }}
                >
                  <Typography variant="caption" component="div">
                    {t("threeD.ai.telemetry.generatedAt", {
                      timestamp: proposal.telemetry.generatedAt
                    })}
                  </Typography>
                  {proposal.telemetry.generationMode ? (
                    <Typography variant="caption" component="div">
                      {t("threeD.ai.telemetry.mode", {
                        mode: proposal.telemetry.generationMode
                      })}
                    </Typography>
                  ) : null}
                  <Typography variant="caption" component="div">
                    {t("threeD.ai.telemetry.models", {
                      provider: proposal.telemetry.provider,
                      model: proposal.telemetry.orchestrationModel ?? "—",
                      imageModel: proposal.telemetry.imageModel ?? "—"
                    })}
                  </Typography>
                  <Typography variant="caption" component="div">
                    {t("threeD.ai.telemetry.output", {
                      duration: formatDuration(proposal.telemetry.durationMs),
                      dimensions:
                        proposal.telemetry.image.width &&
                        proposal.telemetry.image.height
                          ? `${proposal.telemetry.image.width}×${proposal.telemetry.image.height}`
                          : "—",
                      format: proposal.telemetry.image.format.toUpperCase(),
                      quality: proposal.telemetry.image.quality ?? "—"
                    })}
                  </Typography>
                  {proposal.telemetry.usage ? (
                    <Typography variant="caption" component="div">
                      {t("threeD.ai.telemetry.usage", {
                        input: proposal.telemetry.usage.inputTokens,
                        output: proposal.telemetry.usage.outputTokens,
                        cached: proposal.telemetry.usage.cachedInputTokens ?? 0,
                        total: proposal.telemetry.usage.totalTokens
                      })}
                    </Typography>
                  ) : null}
                  {proposal.telemetry.estimatedCost ? (
                    <Typography variant="caption" component="div">
                      {t("threeD.ai.telemetry.estimatedCost", {
                        amount:
                          proposal.telemetry.estimatedCost.amount.toFixed(4),
                        currency: proposal.telemetry.estimatedCost.currency
                      })}
                    </Typography>
                  ) : null}
                </AccordionDetails>
              </Accordion>
            ) : null}
          </Box>
        ) : null}
      </Stack>
      <Dialog
        data-editor-shortcut-scope="true"
        open={previewOpen && Boolean(proposal)}
        onClose={() => setPreviewOpen(false)}
        aria-labelledby="ai-design-preview-title"
        maxWidth={false}
        sx={{
          "& .MuiDialog-paper": {
            maxHeight: "calc(100dvh - 32px)",
            maxWidth: "calc(100vw - 32px)",
            width: "auto"
          }
        }}
      >
        <DialogTitle id="ai-design-preview-title">
          {t("threeD.ai.previewTitle")}
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            alignItems: "center",
            display: "flex",
            justifyContent: "center",
            p: 1
          }}
        >
          {proposal ? (
            <Box
              component="img"
              src={image.uri}
              alt={t("threeD.ai.proposalAlt")}
              style={{
                maxHeight: "calc(100dvh - 160px)",
                maxWidth: "calc(100vw - 64px)",
                objectFit: "contain"
              }}
              sx={{
                display: "block",
                height: "auto",
                width: "auto"
              }}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          {saved ? (
            <Button
              color="error"
              onClick={() => {
                setDeleteTarget(saved);
                setDeleteError(false);
              }}
            >
              {t("threeD.ai.history.delete")}
            </Button>
          ) : null}
          <Button autoFocus onClick={() => setPreviewOpen(false)}>
            {t("threeD.ai.closePreview")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(undefined);
        }}
        data-editor-shortcut-scope="true"
        aria-labelledby="delete-design-title"
        aria-describedby="delete-design-description"
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
          {deleteError ? (
            <Alert severity="error">
              {t("threeD.ai.history.deleteFailed")}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
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
    </Paper>
  );
}

function formatDuration(durationMs: number): string {
  return durationMs < 1_000
    ? `${durationMs} ms`
    : `${(durationMs / 1_000).toFixed(1)} s`;
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
