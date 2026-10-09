import type { DurableDesignProposal } from "@casastudio/ai";
import {
  Alert,
  Button,
  LinearProgress,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useState } from "react";
import { useCasaTranslation } from "../../core/i18n";
import type { ProposalLineage } from "./useProposalLineage";

export function useProposalLabel() {
  const { t } = useCasaTranslation("project-viewer");
  return (proposal: DurableDesignProposal) =>
    t(
      proposal.lineage
        ? "threeD.ai.revisions.number"
        : "threeD.ai.revisions.root",
      { number: proposal.lineage?.turnNumber }
    );
}

export function ProposalRevisions({
  proposal,
  lineage,
  onSelect
}: {
  readonly proposal: DurableDesignProposal;
  readonly lineage: ProposalLineage;
  readonly onSelect: (proposal: DurableDesignProposal) => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const label = useProposalLabel();
  const selector = (p: DurableDesignProposal) => (
    <Button
      key={p.id}
      aria-pressed={p.id === proposal.id}
      variant={p.id === proposal.id ? "contained" : "outlined"}
      onClick={() => onSelect(p)}
      title={p.instructions}
      sx={{
        maxWidth: "100%",
        textTransform: "none",
        justifyContent: "flex-start"
      }}
    >
      <Typography component="span" noWrap>
        {label(p)}
        {p.lineage ? ` · ${p.instructions}` : ""}
      </Typography>
    </Button>
  );
  return (
    <Stack spacing={1} sx={{ mt: 2, minWidth: 0 }}>
      {lineage.loading ? (
        <Typography role="status">
          {t("threeD.ai.revisions.loading")}
        </Typography>
      ) : null}
      {lineage.error ? (
        <Alert
          severity="error"
          action={
            <Button onClick={lineage.refresh}>
              {t("threeD.ai.revisions.retry")}
            </Button>
          }
        >
          {t("threeD.ai.revisions.failed")}
        </Alert>
      ) : null}
      <Typography variant="subtitle2">
        {t("threeD.ai.revisions.path")}
      </Typography>
      <Stack
        spacing={1}
        role="group"
        aria-label={t("threeD.ai.revisions.path")}
      >
        {lineage.path.map(selector)}
      </Stack>
      {proposal.lineage && lineage.path.length > 1 ? (
        <Typography variant="body2">
          {t("threeD.ai.revisions.derived", {
            parent: label(lineage.path.at(-2) ?? lineage.path[0]!)
          })}
        </Typography>
      ) : null}
      {lineage.children.length ? (
        <>
          <Typography variant="subtitle2">
            {t("threeD.ai.revisions.children")}
          </Typography>
          <Stack
            spacing={1}
            role="group"
            aria-label={t("threeD.ai.revisions.children")}
          >
            {lineage.children.map(selector)}
          </Stack>
        </>
      ) : null}
    </Stack>
  );
}

/** Drafts are local to the selected base; the parent keys this area by Proposal ID. */
export function ProposalRefinement({
  proposal,
  blocked,
  pending,
  failure,
  onRefine
}: {
  readonly proposal: DurableDesignProposal;
  readonly blocked?: string;
  readonly pending?: string;
  readonly failure?: string;
  readonly onRefine: (instructions: string) => Promise<boolean>;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const label = useProposalLabel();
  const [draft, setDraft] = useState("");
  return (
    <Stack
      component="section"
      aria-labelledby="refine-design-title"
      spacing={1}
      sx={{ mt: 2 }}
    >
      <Typography id="refine-design-title" variant="h6">
        {t("threeD.ai.revisions.refine")}
      </Typography>
      <Typography variant="body2">
        {t("threeD.ai.revisions.base", { proposal: label(proposal) })}
      </Typography>
      <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>
        {proposal.instructions}
      </Typography>
      {blocked ? (
        <Alert severity="info" id="refinement-blocked">
          {blocked}
        </Alert>
      ) : null}
      <TextField
        label={t("threeD.ai.revisions.change")}
        value={draft}
        multiline
        minRows={2}
        maxRows={5}
        fullWidth
        disabled={!!pending || !!blocked}
        onChange={(e) => setDraft(e.target.value)}
        helperText={t("threeD.ai.revisions.hint")}
        slotProps={{
          htmlInput: {
            maxLength: 2000,
            "aria-describedby": blocked ? "refinement-blocked" : undefined
          }
        }}
      />
      <Button
        variant="contained"
        disabled={!draft.trim() || !!pending || !!blocked}
        onClick={() => {
          void onRefine(draft.trim()).then((success) => {
            if (success) setDraft("");
          });
        }}
      >
        {t("threeD.ai.revisions.generate")}
      </Button>
      {pending ? (
        <Stack role="status" aria-live="polite" spacing={1}>
          <LinearProgress aria-label={t("threeD.ai.revisions.generating")} />
          <Typography variant="body2">{pending}</Typography>
          <Typography variant="caption">
            {t("threeD.ai.revisions.closeHint")}
          </Typography>
        </Stack>
      ) : null}
      {failure ? <Alert severity="error">{failure}</Alert> : null}
    </Stack>
  );
}
