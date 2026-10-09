import {
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
import { useCasaTranslation } from "../../core/i18n";
import { ProposalArtifactView } from "./ProposalArtifactView";
import type {
  useRoomDesignHistory,
  useDesignArtifact
} from "./useRoomDesignHistory";

/** Bounded Room metadata list and one selected preview; no artifact fetching of its own. */
export function RoomDesignHistory({
  open,
  roomLabel,
  history,
  proposal,
  image,
  projectRevision,
  onClose,
  onSelect,
  onReview,
  onDelete
}: {
  readonly open: boolean;
  readonly roomLabel: string;
  readonly history: ReturnType<typeof useRoomDesignHistory>;
  readonly proposal?: DesignProposal;
  readonly image: ReturnType<typeof useDesignArtifact>;
  readonly projectRevision?: number;
  readonly onClose: () => void;
  readonly onSelect: (id: string) => void;
  readonly onReview: () => void;
  readonly onDelete: (proposal: DurableDesignProposal) => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      data-editor-shortcut-scope="true"
      aria-labelledby="room-design-history-title"
    >
      <DialogTitle id="room-design-history-title">
        {t("threeD.ai.history.reviewTitle", { room: roomLabel })}
      </DialogTitle>
      <DialogContent dividers>
        {history.loading ? (
          <Typography role="status">
            {t("threeD.ai.history.loading")}
          </Typography>
        ) : null}
        {history.error ? (
          <Alert severity="error">{t("threeD.ai.history.failed")}</Alert>
        ) : null}
        {!history.loading && !history.error && !history.proposals.length ? (
          <Typography>{t("threeD.ai.history.empty")}</Typography>
        ) : null}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "minmax(0, 1fr) minmax(0, 1fr)"
            },
            gap: 2
          }}
        >
          <Stack
            spacing={1}
            role="group"
            aria-label={t("threeD.ai.history.title")}
          >
            {history.proposals.map((p) => (
              <Button
                key={p.id}
                size="small"
                variant={proposal?.id === p.id ? "contained" : "outlined"}
                aria-pressed={proposal?.id === p.id}
                onClick={() => onSelect(p.id)}
                sx={{
                  justifyContent: "flex-start",
                  textAlign: "left",
                  textTransform: "none",
                  overflowWrap: "anywhere"
                }}
              >
                <Box>
                  <Typography variant="caption" component="div">
                    {new Date(p.createdAt).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" component="div">
                    {p.instructions}
                  </Typography>
                  <Typography variant="caption" component="div">
                    {t(
                      projectRevision !== undefined &&
                        p.projectRevision !== projectRevision
                        ? "threeD.ai.history.historical"
                        : "threeD.ai.history.current",
                      { revision: p.projectRevision }
                    )}
                  </Typography>
                </Box>
              </Button>
            ))}
          </Stack>
          <Stack spacing={1}>
            {proposal && history.proposals.some((p) => p.id === proposal.id) ? (
              <>
                <ProposalArtifactView
                  proposal={proposal}
                  uri={image.uri}
                  error={image.error}
                  retry={image.retry}
                />
                <Button onClick={() => onReview()}>
                  {t("threeD.ai.openPreview")}
                </Button>
                <Button
                  color="error"
                  onClick={() => onDelete(proposal as DurableDesignProposal)}
                >
                  {t("threeD.ai.history.delete")}
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t("threeD.ai.history.select")}
              </Typography>
            )}
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap" }}>
        <Button disabled={history.loading} onClick={() => void history.load()}>
          {t("threeD.ai.history.refresh")}
        </Button>
        {history.nextCursor ? (
          <Button
            disabled={history.loading}
            onClick={() => void history.load(history.nextCursor)}
          >
            {t("threeD.ai.history.older")}
          </Button>
        ) : null}
        <Button autoFocus onClick={onClose}>
          {t("threeD.ai.closePreview")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
