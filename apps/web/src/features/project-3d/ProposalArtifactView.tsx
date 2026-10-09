import type { DesignProposal } from "@casastudio/ai";
import { Alert, Box, Button, Typography } from "@mui/material";
import { useCasaTranslation } from "../../core/i18n";

/** Image artifacts today. Review and Designer do not own the rendering implementation. */
export function ProposalArtifactView({
  proposal,
  uri,
  error,
  retry,
  review = false
}: {
  readonly proposal: DesignProposal;
  readonly uri?: string;
  readonly error?: boolean;
  readonly retry: () => void;
  readonly review?: boolean;
}) {
  const { t } = useCasaTranslation("project-viewer");
  if (error)
    return (
      <Alert
        severity="error"
        action={
          <Button size="small" onClick={retry}>
            {t("threeD.ai.history.retryImage")}
          </Button>
        }
      >
        {t("threeD.ai.history.imageFailed")}
      </Alert>
    );
  if (!uri)
    return (
      <Typography role="status" variant="caption">
        {t("threeD.ai.history.imageLoading")}
      </Typography>
    );
  return (
    <Box
      component="img"
      src={uri}
      alt={t("threeD.ai.proposalAlt")}
      data-proposal-id={proposal.id}
      style={{
        objectFit: "contain",
        maxWidth: "100%",
        maxHeight: review ? "calc(100dvh - 240px)" : "220px"
      }}
      sx={{
        display: "block",
        width: "100%",
        height: "auto",
        minHeight: 0,
        alignSelf: "center"
      }}
    />
  );
}
