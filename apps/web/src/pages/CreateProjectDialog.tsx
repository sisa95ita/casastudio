import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiRequestError } from "../api/CasaStudioApiClient";
import { useCasaTranslation } from "../i18n";
import { useCreateProjectMutation } from "../queries/project-mutations";
import {
  ProjectInformationForm,
  validateProjectInformation
} from "./ProjectInformationForm";

/** Project creation dialog backed by the authoritative create mutation. */
export function CreateProjectDialog({
  open,
  existingNames,
  onClose
}: {
  readonly open: boolean;
  readonly existingNames: readonly string[];
  readonly onClose: () => void;
}) {
  const { t } = useCasaTranslation("common");
  const navigate = useNavigate();
  const mutation = useCreateProjectMutation();
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const messages = {
    required: t("routes.home.create.required"),
    tooLong: t("routes.home.create.tooLong"),
    duplicate: t("routes.home.create.duplicate")
  };
  const validation = validateProjectInformation(name, existingNames, messages);
  const backendDuplicate =
    mutation.error instanceof ApiRequestError &&
    mutation.error.problem?.code === "PROJECT_NAME_CONFLICT";
  const error = backendDuplicate
    ? messages.duplicate
    : submitted || name.length > 0
      ? validation.error
      : undefined;
  const close = () => {
    if (mutation.isPending) return;
    setName("");
    setSubmitted(false);
    mutation.reset();
    onClose();
  };
  const submit = () => {
    setSubmitted(true);
    if (validation.error || mutation.isPending) return;
    mutation.mutate(validation.preparedName, {
      onSuccess: (response) => navigate(`/app/projects/${response.project.id}`)
    });
  };
  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>{t("routes.home.create.title")}</DialogTitle>
      <DialogContent>
        <ProjectInformationForm
          name={name}
          onNameChange={(value) => {
            setName(value);
            if (mutation.error) mutation.reset();
          }}
          error={error}
          disabled={mutation.isPending}
          label={t("routes.home.create.nameLabel")}
        />
        {mutation.isError && !backendDuplicate ? (
          <div role="alert">{t("routes.home.create.failed")}</div>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={mutation.isPending}>
          {t("routes.home.create.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={Boolean(validation.error) || mutation.isPending}
        >
          {mutation.isPending
            ? t("routes.home.create.pending")
            : t("routes.home.create.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
