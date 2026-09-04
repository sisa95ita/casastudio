import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { Alert, Button, Divider, FormControl, InputAdornment, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import {
  formatArchitecturalLength,
  type Level,
  type Project,
  type StairFlight,
  type StairLanding,
  type Staircase
} from "@casastudio/schema";

import { useCasaTranslation } from "../../../../core/i18n";
import {
  inferStairTemplate,
  measureStaircase,
  type StairAuthoringParameters,
  type StairParameterChanges,
  type StairProposal,
  type StairTemplate
} from "../../../editor-2d/tools/stair/project-stair-authoring";

type StairSelection = {
  readonly staircase: Staircase;
  readonly part?: StairFlight | StairLanding;
};

/** Semantic Staircase/Flight/Landing summary with aggregate delete behavior. */
export function ProjectStairSelectionDetails({
  selection,
  units,
  editable,
  onDelete
}: {
  readonly selection: StairSelection;
  readonly units: Project["units"];
  readonly editable: boolean;
  readonly onDelete: () => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const metrics = measureStaircase(selection.staircase);
  const partType = !selection.part
    ? t("stair.types.staircase")
    : "stepCount" in selection.part
      ? t("stair.types.flight")
      : t("stair.types.landing");
  const rows: readonly (readonly [string, string])[] = [
    [t("stair.labels.type"), partType],
    [t("stair.labels.template"), t(`stair.templates.${inferStairTemplate(selection.staircase)}`)],
    [t("stair.labels.width"), formatArchitecturalLength(metrics.width, units.length)],
    ...metrics.flightStepCounts.map((count, index) => [
      index === 0 ? t("stair.labels.flight1Steps") : t("stair.labels.flight2Steps"),
      String(count)
    ] as const),
    ...(metrics.flightStepCounts.length > 1
      ? [[t("stair.labels.stepCount"), String(metrics.stepCount)] as const]
      : []),
    [t("stair.labels.riserHeight"), formatArchitecturalLength(metrics.riserHeight, units.length)],
    [t("stair.labels.treadDepth"), formatArchitecturalLength(metrics.treadDepth, units.length)],
    [t("stair.labels.totalRise"), formatArchitecturalLength(metrics.totalRise, units.length)],
    [t("stair.labels.totalRun"), formatArchitecturalLength(metrics.totalRun, units.length)],
    [t("stair.labels.startElevation"), formatArchitecturalLength(metrics.startElevation, units.length)],
    [t("stair.labels.endElevation"), formatArchitecturalLength(metrics.endElevation, units.length)]
  ];
  return (
    <Stack component="section" spacing={1.25}>
      <Typography variant="subtitle2">{t("stair.selectionTitle")}</Typography>
      <Typography variant="caption" color="text.secondary">
        {selection.part ? t("stair.ownedPart", { staircase: selection.staircase.name ?? selection.staircase.id }) : selection.staircase.name}
      </Typography>
      <Stack component="dl" spacing={0} sx={{ m: 0 }}>
        {rows.map(([label, value]) => (
          <Stack key={label} spacing={0.75}>
            <Divider />
            <Stack className="geometry-summary-item" direction="row" spacing={1.5} sx={{ justifyContent: "space-between" }}>
              <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
              <Typography component="dd" variant="caption" sx={{ fontWeight: 700, m: 0, textAlign: "right" }}>{value}</Typography>
            </Stack>
          </Stack>
        ))}
      </Stack>
      {editable ? (
        <Button color="error" variant="outlined" size="small" startIcon={<DeleteOutlineRoundedIcon />} onClick={onDelete}>
          {t("stair.delete")}
        </Button>
      ) : null}
    </Stack>
  );
}

/** Assisted numeric controls; elevations and aggregate metrics remain derived. */
export function ProjectStairPropertiesDetails({
  staircase,
  units,
  onUpdate
}: {
  readonly staircase: Staircase;
  readonly units: Project["units"];
  readonly onUpdate: (changes: StairParameterChanges) => boolean;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const metrics = measureStaircase(staircase);
  return (
    <Stack component="section" spacing={1.5}>
      <Typography variant="subtitle2">{t("stair.propertiesTitle")}</Typography>
      <StairNumberField label={t("stair.labels.width")} value={metrics.width} unit={units.length} onCommit={(value) => onUpdate({ width: value })} />
      {metrics.flightStepCounts.length <= 1 ? (
        <StairNumberField label={t("stair.labels.flight1Steps")} value={metrics.flightStepCounts[0] ?? 0} integer onCommit={(value) => onUpdate({ flightStepCount: value })} />
      ) : (
        <>
          <StairNumberField label={t("stair.labels.flight1Steps")} value={metrics.flightStepCounts[0] ?? 0} integer onCommit={(value) => onUpdate({ firstFlightStepCount: value })} />
          <StairNumberField label={t("stair.labels.flight2Steps")} value={metrics.flightStepCounts[1] ?? 0} integer onCommit={(value) => onUpdate({ secondFlightStepCount: value })} />
          <Typography variant="caption" color="text.secondary">
            {t("stair.totalSteps", { count: metrics.stepCount })}
          </Typography>
        </>
      )}
      <StairNumberField label={t("stair.labels.treadDepth")} value={metrics.treadDepth} unit={units.length} onCommit={(value) => onUpdate({ treadDepth: value })} />
      <Typography variant="caption" color="text.secondary">
        {t("stair.derivedHelp", {
          rise: formatArchitecturalLength(metrics.totalRise, units.length),
          riser: formatArchitecturalLength(metrics.riserHeight, units.length)
        })}
      </Typography>
    </Stack>
  );
}

/** Focused transient Stair editor kept in the existing Properties Inspector. */
export function ProjectStairAuthoringDetails({
  levels,
  owningLevelId,
  targetLevelId,
  targetRoomId,
  template,
  parameters,
  proposal,
  locked,
  units,
  onTemplateChange,
  onParametersChange,
  onConfirm,
  onCancel
}: {
  readonly levels: readonly Level[];
  readonly owningLevelId: string;
  readonly targetLevelId: string;
  readonly targetRoomId?: string;
  readonly template: StairTemplate;
  readonly parameters: StairAuthoringParameters;
  readonly proposal?: StairProposal;
  readonly locked: boolean;
  readonly units: Project["units"];
  readonly onTemplateChange: (template: StairTemplate) => void;
  readonly onParametersChange: (parameters: StairAuthoringParameters) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const fromLevel = levels.find((level) => level.id === owningLevelId);
  const toLevel = levels.find((level) => level.id === targetLevelId);
  const toRoom = toLevel?.rooms.find((room) => room.id === targetRoomId);
  const setNumber = (field: string, value: number) => {
    onParametersChange({ ...parameters, [field]: value } as StairAuthoringParameters);
  };
  const rows = proposal ? [
    [t("stair.labels.totalRise"), formatArchitecturalLength(proposal.totalRise, units.length)],
    [t("stair.labels.riserHeight"), formatArchitecturalLength(proposal.riserHeight, units.length)],
    [t("stair.labels.totalRun"), formatArchitecturalLength(proposal.totalRun, units.length)],
    [t("stair.labels.startElevation"), formatArchitecturalLength(proposal.staircase.flights[0]?.startElevation ?? 0, units.length)],
    [t("stair.labels.endElevation"), formatArchitecturalLength(proposal.staircase.flights.at(-1)?.endElevation ?? 0, units.length)]
  ] as const : [];

  return (
    <Stack component="section" spacing={1.5} data-testid="stair-authoring-inspector">
      <Typography variant="subtitle2">{t("stairAuthoring.title")}</Typography>
      <Typography variant="caption" color="text.secondary">
        {t("stairAuthoring.connectionSummary", {
          from: fromLevel?.name ?? owningLevelId,
          to: toRoom ? `${toLevel?.name} · ${toRoom.name}` : toLevel?.name ?? targetLevelId
        })}
      </Typography>
      <FormControl size="small">
        <InputLabel id="stair-inspector-template-label">{t("stairAuthoring.template")}</InputLabel>
        <Select
          labelId="stair-inspector-template-label"
          label={t("stairAuthoring.template")}
          value={template}
          onChange={(event) => onTemplateChange(event.target.value as StairTemplate)}
        >
          <MenuItem value="STRAIGHT">{t("stairAuthoring.templates.straight")}</MenuItem>
          <MenuItem value="L_SHAPED">{t("stairAuthoring.templates.lShaped")}</MenuItem>
          <MenuItem value="U_SHAPED">{t("stairAuthoring.templates.uShaped")}</MenuItem>
        </Select>
      </FormControl>
      <StairLiveNumberField label={t("stair.labels.width")} value={parameters.width} unit={units.length} onChange={(value) => setNumber("width", value)} />
      <StairLiveNumberField label={t("stair.labels.treadDepth")} value={parameters.treadDepth} unit={units.length} onChange={(value) => setNumber("treadDepth", value)} />
      {parameters.kind === "STRAIGHT" ? (
        <StairLiveNumberField label={t("stair.labels.flight1Steps")} value={parameters.flightStepCount} integer onChange={(value) => setNumber("flightStepCount", value)} />
      ) : (
        <>
          <StairLiveNumberField label={t("stair.labels.flight1Steps")} value={parameters.firstFlightStepCount} integer onChange={(value) => setNumber("firstFlightStepCount", value)} />
          <StairLiveNumberField label={t("stair.labels.flight2Steps")} value={parameters.secondFlightStepCount} integer onChange={(value) => setNumber("secondFlightStepCount", value)} />
        </>
      )}
      {rows.length > 0 ? (
        <Stack component="dl" spacing={0} sx={{ m: 0 }}>
          {rows.map(([label, value]) => (
            <Stack key={label} direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
              <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
              <Typography component="dd" variant="caption" sx={{ m: 0, fontWeight: 700 }}>{value}</Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}
      <Alert severity={proposal?.valid ? "success" : proposal ? "warning" : "info"}>
        {proposal
          ? proposal.valid
            ? locked ? t("stairAuthoring.ready") : t("stairAuthoring.clickToLock")
            : t(`stairAuthoring.invalid.${proposal.invalidReason ?? "INVALID_PARAMETERS"}`)
          : t("stairAuthoring.placeHint")}
      </Alert>
      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
        <Button size="small" onClick={onCancel}>{t("stairAuthoring.cancel")}</Button>
        <Button size="small" variant="contained" disabled={!locked || !proposal?.valid} onClick={onConfirm}>
          {t("stairAuthoring.confirm")}
        </Button>
      </Stack>
    </Stack>
  );
}

function StairNumberField({
  label,
  value,
  unit,
  integer = false,
  onCommit
}: {
  readonly label: string;
  readonly value: number;
  readonly unit?: string;
  readonly integer?: boolean;
  readonly onCommit: (value: number) => boolean;
}) {
  return (
    <TextField
      key={`${label}:${value}`}
      label={label}
      defaultValue={Number(value.toFixed(3))}
      type="number"
      size="small"
      onBlur={(event) => {
        const next = Number(event.currentTarget.value);
        if (!onCommit(next)) event.currentTarget.value = String(Number(value.toFixed(3)));
      }}
      slotProps={{
        htmlInput: { min: 1, step: integer ? 1 : "any" },
        input: unit ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } : undefined
      }}
    />
  );
}

function StairLiveNumberField({
  label,
  value,
  unit,
  integer = false,
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly unit?: string;
  readonly integer?: boolean;
  readonly onChange: (value: number) => void;
}) {
  return (
    <TextField
      label={label}
      value={Number.isFinite(value) ? value : ""}
      type="number"
      size="small"
      onChange={(event) => onChange(Number(event.target.value))}
      slotProps={{
        htmlInput: { min: 1, step: integer ? 1 : "any" },
        input: unit ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } : undefined
      }}
    />
  );
}
