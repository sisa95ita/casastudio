import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
            <Box
              component="img"
              src={proposal.artifact.uri}
              alt={t("threeD.ai.proposalAlt")}
              sx={{ borderRadius: 1, display: "block", mt: 0.5, width: "100%" }}
            />
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}
