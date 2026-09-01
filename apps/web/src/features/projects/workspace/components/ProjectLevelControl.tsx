import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip
} from "@mui/material";
import { useState } from "react";

import type { GeometryLevel } from "../../../../core/api/api-types";
import { useCasaTranslation } from "../../../../core/i18n";
import type { ProjectWorkspaceMode } from "../../../editor-2d/state/project-editor-slice";

type ProjectLevelControlProps = {
  readonly mode: ProjectWorkspaceMode;
  readonly viewLevels: readonly GeometryLevel[];
  readonly selectedViewLevel?: GeometryLevel;
  readonly draftLevelIds: readonly {
    readonly id: string;
    readonly name: string;
    readonly elevation: number;
  }[];
  readonly projectLevelNames: readonly { readonly id: string; readonly name: string }[];
  readonly activeEditLevelId: string | null;
  readonly onViewLevelChange: (levelId: string) => void;
  readonly onEditLevelChange: (levelId: string) => void;
  readonly onCreateLevel: (properties: { readonly name: string; readonly elevation: number }) => boolean;
  readonly onUpdateActiveLevel: (properties: { readonly name: string; readonly elevation: number }) => boolean;
};

/** Renders the active Project level selector and level editing dialog. */
export function ProjectLevelControl({
  mode,
  viewLevels,
  selectedViewLevel,
  draftLevelIds,
  projectLevelNames,
  activeEditLevelId,
  onViewLevelChange,
  onEditLevelChange,
  onCreateLevel,
  onUpdateActiveLevel
}: ProjectLevelControlProps) {
  const { t } = useCasaTranslation("project-viewer");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [name, setName] = useState("");
  const [elevation, setElevation] = useState("");
  const [invalid, setInvalid] = useState(false);
  const levels =
    mode === "edit"
      ? draftLevelIds
      : viewLevels.map((level) => ({
          id: level.id,
          name: projectLevelNames.find((candidate) => candidate.id === level.sourceLevelId)?.name ??
            level.sourceLevelId,
          elevation: level.elevation
        }));
  const value =
    mode === "edit" ? (activeEditLevelId ?? "") : (selectedViewLevel?.id ?? "");
  const activeDraftLevel = draftLevelIds.find((level) => level.id === activeEditLevelId);

  const openDialog = (nextMode: "create" | "edit") => {
    setDialogMode(nextMode);
    setInvalid(false);
    if (nextMode === "edit" && activeDraftLevel) {
      setName(activeDraftLevel.name);
      setElevation(String(activeDraftLevel.elevation));
      return;
    }
    setName("");
    const highestElevation = draftLevelIds.reduce(
      (highest, level) => Math.max(highest, level.elevation),
      0
    );
    setElevation(String(highestElevation + 300));
  };

  const submit = () => {
    const parsedElevation = Number(elevation);
    const properties = { name: name.trim(), elevation: parsedElevation };
    if (!properties.name || !Number.isFinite(parsedElevation)) {
      setInvalid(true);
      return;
    }
    const accepted = dialogMode === "create"
      ? onCreateLevel(properties)
      : onUpdateActiveLevel(properties);
    setInvalid(!accepted);
    if (accepted) setDialogMode(null);
  };

  if (!value) return null;

  return (
    <>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        {levels.length <= 1 ? (
          <Chip label={levels[0]?.name ?? value} variant="outlined" />
        ) : (
          <FormControl size="small" className="project-level-selector" sx={{ minWidth: 136 }}>
            <InputLabel id="project-geometry-level-selector-label">
              {t("levelSelector.label")}
            </InputLabel>
            <Select
              labelId="project-geometry-level-selector-label"
              label={t("levelSelector.label")}
              value={value}
              onChange={(event) =>
                mode === "edit"
                  ? onEditLevelChange(event.target.value)
                  : onViewLevelChange(event.target.value)
              }
            >
              {levels.map((level) => (
                <MenuItem key={level.id} value={level.id}>
                  {level.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {mode === "edit" ? (
          <>
            <Tooltip title={t("levelSelector.edit")}>
              <IconButton size="small" aria-label={t("levelSelector.edit")} onClick={() => openDialog("edit")}>
                <SettingsRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("levelSelector.create")}>
              <IconButton size="small" aria-label={t("levelSelector.create")} onClick={() => openDialog("create")}>
                <AddRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : null}
      </Stack>
      <Dialog open={dialogMode !== null} onClose={() => setDialogMode(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {t(dialogMode === "create" ? "levelSelector.createTitle" : "levelSelector.editTitle")}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              autoFocus
              label={t("levelSelector.name")}
              value={name}
              onChange={(event) => { setName(event.target.value); setInvalid(false); }}
              error={invalid && !name.trim()}
              fullWidth
            />
            <TextField
              label={t("levelSelector.elevation", { unit: "cm" })}
              type="number"
              value={elevation}
              onChange={(event) => { setElevation(event.target.value); setInvalid(false); }}
              error={invalid && !Number.isFinite(Number(elevation))}
              slotProps={{ htmlInput: { step: "any" } }}
              fullWidth
            />
            {invalid ? <Alert severity="error">{t("levelSelector.invalid")}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogMode(null)}>{t("levelSelector.cancel")}</Button>
          <Button variant="contained" onClick={submit}>
            {t(dialogMode === "create" ? "levelSelector.createAction" : "levelSelector.saveAction")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
