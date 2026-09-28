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
import { VisualChoiceStrip } from "../../../editor-2d/components/VisualChoiceStrip";
import { StairTemplateThumbnail } from "../../../editor-2d/components/AuthoringChoiceThumbnails";
import {
  getStaircaseRotation,
  inferStairTemplate,
  measureStaircase,
  type StairAuthoringParameters,
  type StairParameterChanges,
  type StairProposal,
  type StairSourceRoomCandidate,
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
  levels = [],
  editable,
  onDelete
}: {
  readonly selection: StairSelection;
  readonly units: Project["units"];
  readonly levels?: readonly Level[];
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
    [t("stair.labels.from"), formatConnectionSurface(levels, selection.staircase.fromLevelId, selection.staircase.fromRoomId, units)],
    [t("stair.labels.to"), formatConnectionSurface(levels, selection.staircase.toLevelId, selection.staircase.toRoomId, units)],
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
  levels = [],
  onUpdate
}: {
  readonly staircase: Staircase;
  readonly units: Project["units"];
  readonly levels?: readonly Level[];
  readonly onUpdate: (changes: StairParameterChanges) => boolean;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const metrics = measureStaircase(staircase);
  const rotation = getStaircaseRotation(staircase);
  return (
    <Stack component="section" spacing={1.5}>
      <Typography variant="subtitle2">{t("stair.propertiesTitle")}</Typography>
      <Typography variant="caption" color="text.secondary">
        {t("stairAuthoring.from")} · {formatConnectionSurface(levels, staircase.fromLevelId, staircase.fromRoomId, units)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t("stairAuthoring.to")} · {formatConnectionSurface(levels, staircase.toLevelId, staircase.toRoomId, units)}
      </Typography>
      {rotation !== undefined ? (
        <StairNumberField label={t("stair.labels.rotation")} value={rotation} unit="°" positive={false} onCommit={(value) => onUpdate({ rotation: value })} />
      ) : null}
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
  sourceRoomCandidates,
  sourceRoomId,
  sourceRoomAmbiguous,
  rotation,
  template,
  turnDirection,
  parameters,
  proposal,
  units,
  onDestinationChange,
  onSourceRoomChange,
  onRotationChange,
  onTurnDirectionChange,
  onTemplateChange,
  onParametersChange,
  onConfirm,
  onCancel
}: {
  readonly levels: readonly Level[];
  readonly owningLevelId: string;
  readonly targetLevelId: string;
  readonly targetRoomId?: string;
  readonly sourceRoomCandidates: readonly StairSourceRoomCandidate[];
  readonly sourceRoomId?: string;
  readonly sourceRoomAmbiguous: boolean;
  readonly rotation: number;
  readonly template: StairTemplate;
  readonly turnDirection: "LEFT" | "RIGHT";
  readonly parameters: StairAuthoringParameters;
  readonly proposal?: StairProposal;
  readonly units: Project["units"];
  readonly onDestinationChange: (levelId: string, roomId?: string) => void;
  readonly onSourceRoomChange: (roomId?: string) => void;
  readonly onRotationChange: (rotation: number) => void;
  readonly onTurnDirectionChange: (turn: "LEFT" | "RIGHT") => void;
  readonly onTemplateChange: (template: StairTemplate) => void;
  readonly onParametersChange: (parameters: StairAuthoringParameters) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const fromLevel = levels.find((level) => level.id === owningLevelId);
  const toLevel = levels.find((level) => level.id === targetLevelId);
  const sourceValue = sourceRoomAmbiguous
    ? ""
    : sourceRoomId
      ? sourceRoomId
      : "__LEVEL_FLOOR__";
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
        {t("stairAuthoring.from")} · {formatConnectionSurface(levels, owningLevelId, sourceRoomId, units)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t("stairAuthoring.to")} · {formatConnectionSurface(levels, targetLevelId, targetRoomId, units)}
      </Typography>
      <FormControl size="small" fullWidth>
        <InputLabel id="stair-source-room-label">{t("stairAuthoring.sourceRoom")}</InputLabel>
        <Select
          labelId="stair-source-room-label"
          label={t("stairAuthoring.sourceRoom")}
          value={sourceValue}
          onChange={(event) => onSourceRoomChange(event.target.value === "__LEVEL_FLOOR__" ? undefined : String(event.target.value))}
          inputProps={{
            "data-testid": "stair-source-room-control",
            "data-room-state": sourceRoomAmbiguous ? "choice" : sourceRoomId ? "resolved" : "level"
          }}
        >
          {sourceRoomAmbiguous ? <MenuItem value="" disabled>{t("stairAuthoring.chooseSourceRoom")}</MenuItem> : null}
          <MenuItem value="__LEVEL_FLOOR__">
            {fromLevel?.name ?? owningLevelId} · {t("stairAuthoring.levelFloor")}
          </MenuItem>
          {sourceRoomCandidates.map((room) => (
            <MenuItem key={room.roomId} value={room.roomId}>
              {room.name} · {formatSignedElevation(room.floorElevation, units)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" fullWidth>
        <InputLabel id="stair-inspector-level-label">{t("stairAuthoring.targetLevel")}</InputLabel>
        <Select labelId="stair-inspector-level-label" label={t("stairAuthoring.targetLevel")} value={targetLevelId} onChange={(event) => onDestinationChange(String(event.target.value))}>
          {levels.map((level) => <MenuItem key={level.id} value={level.id}>{level.name}{level.id === owningLevelId ? ` · ${t("stairAuthoring.sameLevel")}` : ""}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl size="small" fullWidth disabled={!toLevel}>
        <InputLabel id="stair-inspector-room-label">{t("stairAuthoring.targetRoom")}</InputLabel>
        <Select labelId="stair-inspector-room-label" label={t("stairAuthoring.targetRoom")} value={targetRoomId ?? ""} onChange={(event) => onDestinationChange(targetLevelId, String(event.target.value) || undefined)}>
          <MenuItem value="">{t("stairAuthoring.noTargetRoom")}</MenuItem>
          {toLevel?.rooms.map((room) => <MenuItem key={room.id} value={room.id}>{room.name}</MenuItem>)}
        </Select>
      </FormControl>
      <VisualChoiceStrip
        label={t("stairAuthoring.template")}
        value={template}
        onChange={onTemplateChange}
        options={([
          ["STRAIGHT", "straight"],
          ["L_SHAPED", "lShaped"],
          ["U_SHAPED", "uShaped"]
        ] as const).map(([value, key]) => ({
          value,
          label: t(`stairAuthoring.templates.${key}`),
          caption: t(`stairAuthoring.templates.${key}`),
          thumbnail: <StairTemplateThumbnail template={value} />
        }))}
      />
      {template === "L_SHAPED" ? (
        <FormControl size="small" fullWidth>
          <InputLabel id="stair-turn-label">{t("stairAuthoring.turn")}</InputLabel>
          <Select labelId="stair-turn-label" label={t("stairAuthoring.turn")} value={turnDirection} onChange={(event) => onTurnDirectionChange(event.target.value as "LEFT" | "RIGHT")}>
            <MenuItem value="LEFT">{t("stairAuthoring.left")}</MenuItem>
            <MenuItem value="RIGHT">{t("stairAuthoring.right")}</MenuItem>
          </Select>
        </FormControl>
      ) : null}
      <StairLiveNumberField label={t("stair.labels.rotation")} value={rotation} unit="°" positive={false} onChange={onRotationChange} />
      <Typography variant="caption" color="text.secondary">{t("stairAuthoring.rotationHelp")}</Typography>
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
            ? t("stairAuthoring.ready")
            : t(`stairAuthoring.invalid.${proposal.invalidReason ?? "INVALID_PARAMETERS"}`)
          : t("stairAuthoring.placeHint")}
      </Alert>
      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
        <Button size="small" onClick={onCancel}>{t("stairAuthoring.cancel")}</Button>
        <Button size="small" variant="contained" disabled={!proposal?.valid} onClick={onConfirm}>
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
  positive = true,
  onCommit
}: {
  readonly label: string;
  readonly value: number;
  readonly unit?: string;
  readonly integer?: boolean;
  readonly positive?: boolean;
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
        htmlInput: { ...(positive ? { min: 1 } : {}), step: integer ? 1 : "any" },
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
  positive = true,
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly unit?: string;
  readonly integer?: boolean;
  readonly positive?: boolean;
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
        htmlInput: { ...(positive ? { min: 1 } : {}), step: integer ? 1 : "any" },
        input: unit ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } : undefined
      }}
    />
  );
}

function formatSignedElevation(elevation: number, units: Project["units"]): string {
  return `${elevation > 0 ? "+" : ""}${formatArchitecturalLength(elevation, units.length)}`;
}

function formatConnectionSurface(
  levels: readonly Level[],
  levelId: string,
  roomId: string | undefined,
  units: Project["units"]
): string {
  const level = levels.find((candidate) => candidate.id === levelId);
  const room = roomId ? level?.rooms.find((candidate) => candidate.id === roomId) : undefined;
  const label = room
    ? `${level?.name ?? levelId} · ${room.name}`
    : level?.name ?? levelId;
  return `${label} · ${formatSignedElevation((level?.elevation ?? 0) + (room?.elevation ?? 0), units)}`;
}
