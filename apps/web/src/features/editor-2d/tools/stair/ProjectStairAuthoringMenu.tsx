import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Popper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import type { KeyboardEvent } from "react";
import type { Level, Project } from "@casastudio/schema";

import { useCasaTranslation } from "../../../../core/i18n";
import type { StairTemplate } from "./project-stair-authoring";

/** Connection-first authoring panel for one complete semantic Staircase. */
export function ProjectStairAuthoringMenu({
  anchorEl,
  levels,
  owningLevelId,
  targetLevelId,
  targetRoomId,
  template,
  unit,
  onDestinationChange,
  onTemplateChange,
  onCancel
}: {
  readonly anchorEl: HTMLElement | null;
  readonly levels: readonly Level[];
  readonly owningLevelId?: string;
  readonly targetLevelId?: string;
  readonly targetRoomId?: string;
  readonly template?: StairTemplate;
  readonly unit: Project["units"]["length"];
  readonly onDestinationChange: (levelId: string, roomId?: string) => void;
  readonly onTemplateChange: (template: StairTemplate) => void;
  readonly onCancel: () => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const targetLevel = levels.find((level) => level.id === targetLevelId);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  };

  return (
    <Popper
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      placement="bottom-start"
      sx={{ zIndex: (theme) => theme.zIndex.modal }}
    >
      <Paper
        id="stair-authoring-menu"
        className="project-stair-authoring-menu"
        elevation={5}
        onKeyDown={handleKeyDown}
      >
        <Stack spacing={1.25} sx={{ p: 1.25 }}>
          <Box>
            <Typography variant="subtitle2">{t("stairAuthoring.title")}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t("stairAuthoring.connectionFirst")}
            </Typography>
          </Box>
          <FormControl size="small" fullWidth>
            <InputLabel id="stair-target-level-label">{t("stairAuthoring.targetLevel")}</InputLabel>
            <Select
              labelId="stair-target-level-label"
              label={t("stairAuthoring.targetLevel")}
              value={targetLevelId ?? ""}
              onChange={(event) => onDestinationChange(String(event.target.value))}
            >
              {levels.map((level) => (
                <MenuItem key={level.id} value={level.id}>
                  {level.name}{level.id === owningLevelId ? ` · ${t("stairAuthoring.sameLevel")}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth disabled={!targetLevel}>
            <InputLabel id="stair-target-room-label">{t("stairAuthoring.targetRoom")}</InputLabel>
            <Select
              labelId="stair-target-room-label"
              label={t("stairAuthoring.targetRoom")}
              value={targetRoomId ?? ""}
              onChange={(event) => {
                const roomId = String(event.target.value);
                if (targetLevelId) onDestinationChange(targetLevelId, roomId || undefined);
              }}
            >
              <MenuItem value="">{t("stairAuthoring.noTargetRoom")}</MenuItem>
              {targetLevel?.rooms.map((room) => (
                <MenuItem key={room.id} value={room.id}>
                  {room.name}{room.elevation ? ` · +${room.elevation} ${unit}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t("stairAuthoring.template")}
            </Typography>
            <ToggleButtonGroup
              className="project-stair-authoring-menu__templates"
              value={template ?? null}
              exclusive
              fullWidth
              size="small"
              disabled={!targetLevelId}
              onChange={(_event, value: StairTemplate | null) => {
                if (value) onTemplateChange(value);
              }}
            >
              <ToggleButton value="STRAIGHT">{t("stairAuthoring.templates.straight")}</ToggleButton>
              <ToggleButton value="L_SHAPED">{t("stairAuthoring.templates.lShaped")}</ToggleButton>
              <ToggleButton value="U_SHAPED">{t("stairAuthoring.templates.uShaped")}</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="caption" color="text.secondary">
              {template ? t("stairAuthoring.continueInInspector") : t("stairAuthoring.chooseTemplate")}
            </Typography>
            <Button size="small" onClick={onCancel}>{t("stairAuthoring.cancel")}</Button>
          </Stack>
        </Stack>
      </Paper>
    </Popper>
  );
}
