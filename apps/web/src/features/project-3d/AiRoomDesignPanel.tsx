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
import { useState } from "react";

import { ApiRequestError } from "../../core/api/CasaStudioApiClient";
import { useCasaStudioApi } from "../../core/api/ApiProvider";
import { useCasaTranslation } from "../../core/i18n";

export type DesignReferenceViewCapture = () => DesignReferenceView;

type AiRoomDesignPanelProps = {
  readonly projectId: string;
  readonly levelId: string;
  readonly roomId: string;
  readonly capture?: DesignReferenceViewCapture;
};

/** Minimal AI-A spike UI for a selected canonical Room. */
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

  const generate = async () => {
    if (!capture || !instructions.trim() || generating) return;
    setGenerating(true);
    setError(undefined);
    try {
      const referenceView = capture();
      const result = await api.generateRoomDesign(projectId, {
        levelId,
        roomId,
        instructions: instructions.trim(),
        referenceView
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
          disabled={!capture || !instructions.trim() || generating}
          onClick={generate}
        >
          {generating ? t("threeD.ai.generating") : t("threeD.ai.generate")}
        </Button>
        {!capture ? (
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
          sx={{ alignItems: "center", display: "flex", justifyContent: "center", p: 1 }}
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
    </Paper>
  );
}
