import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import type { DesignProposal, DesignReferenceView } from "@casastudio/ai";
import { useCallback, useEffect, useState } from "react";

import { ApiRequestError } from "../../core/api/CasaStudioApiClient";
import { useCasaStudioApi } from "../../core/api/ApiProvider";
import { useCasaTranslation } from "../../core/i18n";

export type DesignReferenceViewCapture = () => Promise<
  readonly DesignReferenceView[]
>;

type AiRoomDesignPanelProps = {
  readonly projectId: string;
  readonly levelId: string;
  readonly roomId: string;
  readonly capture?: DesignReferenceViewCapture;
};

/** Transient AI interior-design UI for a selected canonical Room. */
export function AiRoomDesignPanel({
  projectId,
  levelId,
  roomId,
  capture
}: AiRoomDesignPanelProps) {
  const api = useCasaStudioApi();
  const { t } = useCasaTranslation("project-viewer");
  const [instructions, setInstructions] = useState("");
  const [proposal, setProposal] = useState<DesignProposal>();
  const [error, setError] = useState<string>();
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [referenceViews, setReferenceViews] = useState<
    readonly DesignReferenceView[]
  >([]);
  const [referencePreparing, setReferencePreparing] = useState(false);
  const [referencePreview, setReferencePreview] =
    useState<DesignReferenceView>();

  const refreshReferences = useCallback(async () => {
    if (!capture || referencePreparing) return;
    setReferencePreparing(true);
    setError(undefined);
    try {
      setReferenceViews(await capture());
    } catch {
      setError(t("threeD.ai.referenceFailure"));
    } finally {
      setReferencePreparing(false);
    }
  }, [capture, referencePreparing, t]);

  useEffect(() => {
    setReferenceViews([]);
    setReferencePreview(undefined);
    if (capture) void refreshReferences();
    // Capture identity is the meaningful Room/project invalidation boundary.
  }, [capture]);

  const generate = async () => {
    if (referenceViews.length === 0 || !instructions.trim() || generating)
      return;
    setGenerating(true);
    setError(undefined);
    try {
      const result = await api.generateRoomDesign(projectId, {
        levelId,
        roomId,
        instructions: instructions.trim(),
        referenceViews
      });
      setProposal(result);
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError && cause.problem
          ? cause.problem.detail
          : t("threeD.ai.failure")
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Paper
      className="project-3d-ai-panel"
      elevation={6}
      role="region"
      aria-label={t("threeD.ai.title")}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <AutoAwesomeRoundedIcon color="primary" fontSize="small" />
          <Box>
            <Typography variant="subtitle2">{t("threeD.ai.title")}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t("threeD.ai.roomTarget")}
            </Typography>
          </Box>
        </Stack>
        <Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography variant="caption" color="text.secondary">
              {t("threeD.ai.references")}
            </Typography>
            <Button
              size="small"
              disabled={!capture || referencePreparing}
              onClick={() => void refreshReferences()}
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
        </Box>
        <TextField
          size="small"
          multiline
          minRows={2}
          maxRows={4}
          value={instructions}
          label={t("threeD.ai.instructions")}
          placeholder={t("threeD.ai.placeholder")}
          slotProps={{ htmlInput: { maxLength: 2000 } }}
          onChange={(event) => setInstructions(event.target.value)}
        />
        <Button
          variant="contained"
          size="small"
          startIcon={
            generating ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <AutoAwesomeRoundedIcon />
            )
          }
          disabled={
            referenceViews.length === 0 || !instructions.trim() || generating
          }
          onClick={generate}
        >
          {generating ? t("threeD.ai.generating") : t("threeD.ai.generate")}
        </Button>
        {!capture || referencePreparing ? (
          <Typography variant="caption" color="text.secondary">
            {t("threeD.ai.referencePreparing")}
          </Typography>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {proposal ? (
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t("threeD.ai.proposal")}
            </Typography>
            <ButtonBase
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
                src={proposal.artifact.uri}
                alt={t("threeD.ai.proposalAlt")}
                sx={{ display: "block", width: "100%" }}
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
              <Box
                aria-label={t("threeD.ai.telemetry.title")}
                sx={{
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  mt: 0.75,
                  px: 1,
                  py: 0.75
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {t("threeD.ai.telemetry.title")}
                </Typography>
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
                      amount: proposal.telemetry.estimatedCost.amount.toFixed(4),
                      currency: proposal.telemetry.estimatedCost.currency
                    })}
                  </Typography>
                ) : null}
              </Box>
            ) : null}
          </Box>
        ) : null}
      </Stack>
      <Dialog
        open={previewOpen}
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
              src={proposal.artifact.uri}
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
          <Button autoFocus onClick={() => setPreviewOpen(false)}>
            {t("threeD.ai.closePreview")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(referencePreview)}
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
