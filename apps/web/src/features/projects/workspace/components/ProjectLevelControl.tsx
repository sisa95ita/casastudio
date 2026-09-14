import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField
} from "@mui/material";
import { useState, type MouseEvent } from "react";

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
  readonly projectLevelNames: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly activeEditLevelId: string | null;
  readonly onViewLevelChange: (levelId: string) => void;
  readonly onEditLevelChange: (levelId: string) => void;
  readonly onCreateLevel: (properties: {
    readonly name: string;
    readonly elevation: number;
  }) => boolean;
  readonly onUpdateActiveLevel: (properties: {
    readonly name: string;
    readonly elevation: number;
  }) => boolean;
};

/** Renders level selection with structural actions available only while editing. */
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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [name, setName] = useState("");
  const [elevation, setElevation] = useState("");
  const [invalid, setInvalid] = useState(false);
  const levels =
    mode === "edit"
      ? draftLevelIds
      : viewLevels.map((level) => ({
          id: level.id,
          name:
            projectLevelNames.find(
              (candidate) => candidate.id === level.sourceLevelId
            )?.name ?? level.sourceLevelId,
          elevation: level.elevation
        }));
  const value =
    mode === "edit" ? (activeEditLevelId ?? "") : (selectedViewLevel?.id ?? "");
  const activeLevel = levels.find((level) => level.id === value);
  const activeDraftLevel = draftLevelIds.find(
    (level) => level.id === activeEditLevelId
  );

  const closeMenu = () => setAnchorEl(null);
  const selectLevel = (levelId: string) => {
    if (mode === "edit") onEditLevelChange(levelId);
    else onViewLevelChange(levelId);
    closeMenu();
  };
  const openDialog = (nextMode: "create" | "edit") => {
    closeMenu();
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
    const accepted =
      dialogMode === "create"
      ? onCreateLevel(properties)
      : onUpdateActiveLevel(properties);
    setInvalid(!accepted);
    if (accepted) setDialogMode(null);
  };

  if (!value || !activeLevel) return null;

  return (
    <>
      <Button
        className="project-level-control"
        variant="outlined"
        color="inherit"
        size="small"
        endIcon={<ExpandMoreRoundedIcon />}
        aria-label={t("levelSelector.current", { level: activeLevel.name })}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        aria-controls={anchorEl ? "project-level-menu" : undefined}
        onClick={(event: MouseEvent<HTMLButtonElement>) =>
          setAnchorEl(event.currentTarget)
              }
      >
        {activeLevel.name}
      </Button>
      <Menu
        id="project-level-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        slotProps={{ list: { "aria-label": t("levelSelector.menuLabel") } }}
            >
              {levels.map((level) => (
          <MenuItem
            key={level.id}
            selected={level.id === value}
            onClick={() => selectLevel(level.id)}
          >
            <ListItemIcon>
              {level.id === value ? (
                <CheckRoundedIcon fontSize="small" />
              ) : null}
            </ListItemIcon>
            <ListItemText>{level.name}</ListItemText>
                </MenuItem>
              ))}
        {mode === "edit" ? <Divider /> : null}
        {mode === "edit" ? (
          <MenuItem onClick={() => openDialog("create")}>
            <ListItemIcon>
                <AddRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("levelSelector.add")}</ListItemText>
          </MenuItem>
        ) : null}
        {mode === "edit" ? (
          <MenuItem onClick={() => openDialog("edit")}>
            <ListItemIcon>
              <SettingsRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("levelSelector.manage")}</ListItemText>
          </MenuItem>
        ) : null}
      </Menu>
      <Dialog
        open={dialogMode !== null}
        onClose={() => setDialogMode(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {t(
            dialogMode === "create"
              ? "levelSelector.createTitle"
              : "levelSelector.editTitle"
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              autoFocus
              label={t("levelSelector.name")}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setInvalid(false);
              }}
              error={invalid && !name.trim()}
              fullWidth
            />
            <TextField
              label={t("levelSelector.elevation", { unit: "cm" })}
              type="number"
              value={elevation}
              onChange={(event) => {
                setElevation(event.target.value);
                setInvalid(false);
              }}
              error={invalid && !Number.isFinite(Number(elevation))}
              slotProps={{ htmlInput: { step: "any" } }}
              fullWidth
            />
            {invalid ? (
              <Alert severity="error">{t("levelSelector.invalid")}</Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogMode(null)}>
            {t("levelSelector.cancel")}
          </Button>
          <Button variant="contained" onClick={submit}>
            {t(
              dialogMode === "create"
                ? "levelSelector.createAction"
                : "levelSelector.saveAction"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
