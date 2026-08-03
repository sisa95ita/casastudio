import type { LevelGeometry } from "@casastudio/geometry";
import { Divider, Stack, Typography } from "@mui/material";

import { useCasaTranslation } from "../i18n";

/**
 * Props for the compact runtime topology summary.
 */
export type GeometryRuntimeSummaryProps = {
  readonly level: LevelGeometry;
};

/**
 * Summarizes the selected immutable runtime level.
 *
 * Counts are read directly from `LevelGeometry` collections so the playground
 * demonstrates the actual build output: deduplicated vertices, unique physical
 * boundary edges, loop-relative edge uses, loops, and room-derived polygons.
 */
export function GeometryRuntimeSummary({ level }: GeometryRuntimeSummaryProps) {
  const { t } = useCasaTranslation("inspector");
  const items = [
    { label: t("runtimeSummary.sourceLevel"), value: level.sourceLevelId },
    {
      label: t("runtimeSummary.vertices"),
      value: t("runtimeSummary.verticesValue", { count: level.vertices.length })
    },
    {
      label: t("runtimeSummary.boundaryEdges"),
      value: t("runtimeSummary.boundaryEdgesValue", { count: level.boundaryEdges.length })
    },
    {
      label: t("runtimeSummary.boundaryEdgeUses"),
      value: t("runtimeSummary.boundaryEdgeUsesValue", { count: level.boundaryEdgeUses.length })
    },
    {
      label: t("runtimeSummary.loops"),
      value: t("runtimeSummary.loopsValue", { count: level.loops.length })
    },
    {
      label: t("runtimeSummary.polygons"),
      value: t("runtimeSummary.polygonsValue", { count: level.polygons.length })
    }
  ];

  return (
    <Stack component="section" spacing={1} aria-labelledby="geometry-summary-heading">
      <Typography variant="subtitle2" component="h2" id="geometry-summary-heading">
        {t("runtimeSummary.title")}
      </Typography>
      <Stack component="dl" spacing={0} sx={{ m: 0 }}>
        {items.map((item) => (
          <Stack key={item.label} spacing={0.75}>
            <Divider />
            <Stack
              className="geometry-summary-item"
              direction="row"
              spacing={1.5}
              sx={{ justifyContent: "space-between" }}
            >
              <Typography component="dt" variant="caption" color="text.secondary">
                {item.label}
              </Typography>
              <Typography component="dd" variant="caption" sx={{ fontWeight: 700, m: 0 }}>
                {item.value}
              </Typography>
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
