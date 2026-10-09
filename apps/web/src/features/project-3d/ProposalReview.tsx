import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from "@mui/material";
import type { DesignProposal, DurableDesignProposal } from "@casastudio/ai";
import { useState } from "react";
import { useCasaTranslation } from "../../core/i18n";
import { ProposalArtifactView } from "./ProposalArtifactView";

export type ProposalComparison = Readonly<{
  number: number;
  proposal: DesignProposal;
  direction: string;
}>;

/** Focused proposal review; artifact rendering is a separate presentation boundary. */
export function ProposalReview({
  open,
  proposal,
  uri,
  error,
  retry,
  entries,
  activeNumber,
  direction,
  projectRevision,
  onSelect,
  onClose,
  onDelete
}: {
  readonly open: boolean;
  readonly proposal?: DesignProposal;
  readonly uri?: string;
  readonly error?: boolean;
  readonly retry: () => void;
  readonly entries: readonly ProposalComparison[];
  readonly activeNumber?: number;
  readonly direction?: string;
  readonly projectRevision?: number;
  readonly onSelect: (number: number) => void;
  readonly onClose: () => void;
  readonly onDelete: (proposal: DurableDesignProposal) => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const saved =
    proposal && "projectRevision" in proposal
      ? (proposal as DurableDesignProposal)
      : undefined;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      data-editor-shortcut-scope="true"
      aria-labelledby="proposal-review-title"
      sx={{
        "& .MuiDialog-paper": {
          m: { xs: 1, sm: 2 },
          width: "calc(100% - 16px)",
          maxHeight: "calc(100dvh - 16px)"
        }
      }}
    >
      <DialogTitle id="proposal-review-title">
        {t("threeD.ai.previewTitle")}
        {proposal
          ? ` · ${activeNumber !== undefined ? t("threeD.ai.proposalNumber", { number: activeNumber }) : t("threeD.ai.history.selected")}`
          : ""}
      </DialogTitle>
      <DialogContent dividers>
        {proposal ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                md: "minmax(0, 1fr) 280px"
              },
              gap: 2
            }}
          >
            <ProposalArtifactView
              proposal={proposal}
              uri={uri}
              error={error}
              retry={retry}
              review
            />
            <Stack spacing={1} sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
              <Typography variant="subtitle2">
                {t("threeD.ai.proposalDetails")}
              </Typography>
              <Typography variant="caption">
                {new Date(proposal.createdAt).toLocaleString()}
              </Typography>
              <Typography variant="subtitle2">
                {t("threeD.ai.instructions")}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {saved?.instructions ?? direction}
              </Typography>
              {saved ? (
                <>
                  <Typography variant="caption">
                    {t("threeD.ai.history.revision", {
                      revision: saved.projectRevision
                    })}
                  </Typography>
                  <Alert severity="info">
                    {t(
                      projectRevision !== undefined &&
                        saved.projectRevision !== projectRevision
                        ? "threeD.ai.history.historical"
                        : "threeD.ai.history.current",
                      { revision: saved.projectRevision }
                    )}
                  </Alert>
                </>
              ) : null}
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
                          cached:
                            proposal.telemetry.usage.cachedInputTokens ?? 0,
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
            </Stack>
          </Box>
        ) : (
          <Typography>{t("threeD.ai.reviewUnavailable")}</Typography>
        )}
        {proposal && entries.length > 1 ? (
          <Stack
            direction="row"
            spacing={1}
            role="group"
            aria-label={t("threeD.ai.compare")}
            sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}
          >
            {entries.map((entry) => (
              <Button
                key={entry.proposal.id}
                size="small"
                variant={
                  entry.proposal.id === proposal.id ? "contained" : "outlined"
                }
                aria-pressed={entry.proposal.id === proposal.id}
                onClick={() => onSelect(entry.number)}
              >
                {t("threeD.ai.proposalNumber", { number: entry.number })}
              </Button>
            ))}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        {saved ? (
          <Button color="error" onClick={() => onDelete(saved)}>
            {t("threeD.ai.history.delete")}
          </Button>
        ) : null}
        <Button autoFocus onClick={onClose}>
          {t("threeD.ai.closePreview")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function formatDuration(durationMs: number): string {
  return durationMs < 1000
    ? `${durationMs} ms`
    : `${(durationMs / 1000).toFixed(1)} s`;
}
