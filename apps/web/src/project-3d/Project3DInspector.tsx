import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";

import { useCasaTranslation } from "../i18n";
import {
  getVisibleLevelReferences3D,
  type ArchitecturalScene3DModel,
  type LevelVisibility3D
} from "./architectural-scene-3d-model";
import type { ArchitecturalSelection3D } from "./architectural-selection-3d";

/** Inputs for the read-only 3D Project inspector summary. */
export type Project3DInspectorProps = {
  readonly projectName: string;
  readonly model: ArchitecturalScene3DModel;
  readonly visibility: LevelVisibility3D;
  readonly activeLevelId?: string;
  readonly selection?: ArchitecturalSelection3D;
};

/** Renders coherent Project and Level status without exposing 2D edit controls. */
export function Project3DInspector({
  projectName,
  model,
  visibility,
  activeLevelId,
  selection
}: Project3DInspectorProps) {
  const { t } = useCasaTranslation("project-viewer");
  const visibleLevels = getVisibleLevelReferences3D(model, visibility, activeLevelId);

  return (
    <Stack className="project-3d-inspector" spacing={2.25} sx={{ p: 2.5 }}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
          <ViewInArRoundedIcon color="primary" fontSize="small" />
          <Typography component="h2" variant="h3">{t("threeD.inspector.title")}</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t("threeD.inspector.readOnly")}
        </Typography>
      </Box>
      <Divider />
      {selection ? (
        <SelectionDetails3D selection={selection} />
      ) : (
        <Stack spacing={1} data-testid="project-3d-empty-selection">
          <Typography variant="overline" color="text.secondary">
            {t("threeD.inspector.selection")}
          </Typography>
          <Typography variant="body2">{t("threeD.inspector.nothingSelected")}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t("threeD.inspector.selectionHint")}
          </Typography>
        </Stack>
      )}
      <Divider />
      <Stack spacing={1}>
        <Typography variant="overline" color="text.secondary">
          {t("threeD.inspector.project")}
        </Typography>
        <Typography variant="body2">{projectName}</Typography>
        <Chip
          size="small"
          variant="outlined"
          label={model.hasArchitecturalGeometry
            ? t("threeD.inspector.referenceReady")
            : t("threeD.inspector.empty")}
        />
      </Stack>
      <Divider />
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <LayersOutlinedIcon fontSize="small" color="action" />
          <Typography variant="overline" color="text.secondary">
            {t("threeD.inspector.visibleLevels")}
          </Typography>
        </Stack>
        {visibleLevels.length > 0 ? visibleLevels.map((level) => (
          <Stack key={level.id} direction="row" sx={{ justifyContent: "space-between" }}>
            <Typography variant="body2">{level.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {level.y.toFixed(2)} m
            </Typography>
          </Stack>
        )) : (
          <Typography variant="body2" color="text.secondary">
            {t("threeD.inspector.noVisibleLevels")}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}

/** Renders canonical read-only metadata for the selected architectural entity. */
function SelectionDetails3D({ selection }: { readonly selection: ArchitecturalSelection3D }) {
  const { t } = useCasaTranslation("project-viewer");
  const rows: readonly (readonly [string, string])[] = selection.kind === "wall"
    ? [
        [t("threeD.inspector.fields.type"), t("threeD.inspector.types.wall")],
        [t("threeD.inspector.fields.length"), formatMeters(selection.wall!.length)],
        [t("threeD.inspector.fields.thickness"), formatMeters(selection.wall!.thickness)],
        [t("threeD.inspector.fields.height"), formatMeters(selection.wall!.height)],
        [t("threeD.inspector.fields.level"), selection.levelName]
      ]
    : selection.kind === "door"
      ? [
          [t("threeD.inspector.fields.type"), t("threeD.inspector.types.door")],
          [t("threeD.inspector.fields.width"), formatMeters(selection.door!.frame.width)],
          [t("threeD.inspector.fields.height"), formatMeters(selection.door!.frame.height)],
          [t("threeD.inspector.fields.hingeSide"), selection.door!.hingeSide],
          [t("threeD.inspector.fields.swingSide"), selection.door!.swingSide],
          [t("threeD.inspector.fields.wall"), selection.wallId!],
          [t("threeD.inspector.fields.level"), selection.levelName]
        ]
      : selection.kind === "window"
        ? [
            [t("threeD.inspector.fields.type"), t("threeD.inspector.types.window")],
            [t("threeD.inspector.fields.width"), formatMeters(selection.window!.frame.width)],
            [t("threeD.inspector.fields.height"), formatMeters(selection.window!.frame.height)],
            [t("threeD.inspector.fields.elevation"), formatMeters(selection.window!.frame.elevation)],
            [t("threeD.inspector.fields.wall"), selection.wallId!],
            [t("threeD.inspector.fields.level"), selection.levelName]
          ]
        : selection.kind === "wall-opening"
          ? [
              [t("threeD.inspector.fields.type"), t("threeD.inspector.types.wallOpening")],
              [t("threeD.inspector.fields.width"), formatMeters(selection.wallOpening!.frame.width)],
              [t("threeD.inspector.fields.height"), formatMeters(selection.wallOpening!.frame.height)],
              [t("threeD.inspector.fields.elevation"), formatMeters(selection.wallOpening!.frame.elevation)],
              [t("threeD.inspector.fields.wall"), selection.wallId!],
              [t("threeD.inspector.fields.level"), selection.levelName]
            ]
          : [
              [t("threeD.inspector.fields.type"), t("threeD.inspector.types.room")],
              ...(selection.floor!.roomName
                ? [[t("threeD.inspector.fields.name"), selection.floor!.roomName] as const]
                : []),
              ...(selection.floor!.roomType
                ? [[
                    t("threeD.inspector.fields.roomType"),
                    formatRoomType(selection.floor!.roomType)
                  ] as const]
                : []),
              [t("threeD.inspector.fields.area"), `${selection.floor!.area.toFixed(2)} m²`],
              [t("threeD.inspector.fields.level"), selection.levelName]
            ];

  return (
    <Stack spacing={1} data-testid="project-3d-selection-details" aria-live="polite">
      <Typography variant="overline" color="text.secondary">
        {t("threeD.inspector.selection")}
      </Typography>
      <Typography variant="subtitle2">{rows[0]![1]}</Typography>
      <Box component="dl" sx={{ m: 0 }}>
        {rows.map(([label, value]) => (
          <Stack
            component="div"
            direction="row"
            key={label}
            sx={{ justifyContent: "space-between", gap: 2, py: 0.35 }}
          >
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, textAlign: "right" }}>
              {value}
            </Typography>
          </Stack>
        ))}
      </Box>
    </Stack>
  );
}

/** Formats renderer-neutral meter dimensions for the read-only Inspector. */
function formatMeters(value: number): string {
  return `${value.toFixed(2)} m`;
}

/** Formats canonical Room enum values without reinterpreting their semantics. */
function formatRoomType(value: string): string {
  return value.toLowerCase().split("_").map(
    (word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`
  ).join(" ");
}
