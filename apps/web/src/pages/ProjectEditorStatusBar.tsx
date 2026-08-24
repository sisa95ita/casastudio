import FitScreenRoundedIcon from "@mui/icons-material/FitScreenRounded";
import ZoomInRoundedIcon from "@mui/icons-material/ZoomInRounded";
import ZoomOutRoundedIcon from "@mui/icons-material/ZoomOutRounded";
import {
  Box,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tooltip,
  Typography
} from "@mui/material";
import {
  architecturalScaleDenominators,
  type ArchitecturalScaleDenominator
} from "@casastudio/geometry";
import type { Project } from "@casastudio/schema";
import type { ReactNode } from "react";

import { useCasaTranslation } from "../i18n";

/** Presentation and viewport values displayed by the Project editor status bar. */
export type ProjectEditorStatusBarProps = {
  readonly scale: ArchitecturalScaleDenominator;
  readonly units: Project["units"];
  readonly gridVisible: boolean;
  readonly snapToGrid: boolean;
  readonly gridSpacing: number;
  readonly zoom: number;
  readonly editing: boolean;
  readonly onScaleChange: (scale: ArchitecturalScaleDenominator) => void;
  readonly onGridVisibleChange: (visible: boolean) => void;
  readonly onSnapToGridChange: (enabled: boolean) => void;
  readonly onGridSpacingChange: (spacing: number) => void;
  readonly onZoom: (factor: number) => void;
  readonly onFit: () => void;
};

/** Renders one compact row of document-presentation and viewport controls. */
export function ProjectEditorStatusBar({
  scale,
  units,
  gridVisible,
  snapToGrid,
  gridSpacing,
  zoom,
  editing,
  onScaleChange,
  onGridVisibleChange,
  onSnapToGridChange,
  onGridSpacingChange,
  onZoom,
  onFit
}: ProjectEditorStatusBarProps) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <Box className="project-editor-status" aria-label={t("statusBar.label")}>
      <Stack direction="row" className="project-editor-status__document">
        <StatusSelect
          label={t("statusBar.scale")}
          value={scale}
          disabled={!editing}
          onChange={(value) => onScaleChange(value as ArchitecturalScaleDenominator)}
          options={architecturalScaleDenominators.map((denominator) => ({
            value: denominator,
            label: `1:${denominator}`
          }))}
        />
        <StatusValue label={t("statusBar.units")} value={t(`statusBar.unitValues.${units.length}`)} />
        <StatusSwitch
          label={t("statusBar.grid")}
          checked={gridVisible}
          disabled={!editing}
          onChange={onGridVisibleChange}
        />
        {editing && gridVisible ? (
          <StatusSelect
            label={t("statusBar.spacing")}
            value={gridSpacing}
            onChange={(value) => onGridSpacingChange(Number(value))}
            options={[25, 50, 100, 250, 500].map((spacing) => ({
              value: spacing,
              label: `${spacing} ${units.length}`
            }))}
          />
        ) : null}
        <StatusSwitch
          label={t("statusBar.snap")}
          checked={snapToGrid}
          disabled={!editing}
          onChange={onSnapToGridChange}
        />
      </Stack>

      <Stack direction="row" className="project-editor-status__viewport">
        <StatusIconButton label={t("toolbar.zoomOut")} onClick={() => onZoom(0.85)}>
          <ZoomOutRoundedIcon fontSize="small" />
        </StatusIconButton>
        <Typography className="project-editor-status__zoom" variant="body2">
          {Math.round(zoom * 100)}%
        </Typography>
        <StatusIconButton label={t("toolbar.zoomIn")} onClick={() => onZoom(1.18)}>
          <ZoomInRoundedIcon fontSize="small" />
        </StatusIconButton>
        <StatusIconButton label={t("toolbar.fit")} onClick={onFit}>
          <FitScreenRoundedIcon fontSize="small" />
        </StatusIconButton>
      </Stack>
    </Box>
  );
}

/** Props shared by compact select controls in the status bar. */
type StatusSelectProps = {
  readonly label: string;
  readonly value: string | number;
  readonly options: readonly { readonly value: string | number; readonly label: string }[];
  readonly disabled?: boolean;
  readonly onChange: (value: string | number) => void;
};

/** Renders a labelled select without text-field chrome. */
function StatusSelect({ label, value, options, disabled, onChange }: StatusSelectProps) {
  return (
    <Stack direction="row" className="project-editor-status__item">
      <Typography variant="caption" color="text.secondary">{label}:</Typography>
      <FormControl size="small" variant="standard">
        <Select
          aria-label={label}
          value={value}
          disabled={disabled}
          disableUnderline
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}

/** Renders one read-only status value. */
function StatusValue({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Stack direction="row" className="project-editor-status__item">
      <Typography variant="caption" color="text.secondary">{label}:</Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}

/** Renders a compact local-presentation switch in the status bar. */
function StatusSwitch({ label, checked, disabled, onChange }: {
  readonly label: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  return (
    <Stack direction="row" className="project-editor-status__item">
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Switch
        size="small"
        checked={checked}
        disabled={disabled}
        onChange={(_event, next) => onChange(next)}
        slotProps={{ input: { "aria-label": label } }}
      />
      <Typography variant="caption">
        {t(checked ? "statusBar.on" : "statusBar.off")}
      </Typography>
    </Stack>
  );
}

/** Renders one tooltip-labelled viewport action. */
function StatusIconButton({ label, onClick, children }: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Tooltip title={label}>
      <IconButton size="small" aria-label={label} onClick={onClick}>{children}</IconButton>
    </Tooltip>
  );
}
