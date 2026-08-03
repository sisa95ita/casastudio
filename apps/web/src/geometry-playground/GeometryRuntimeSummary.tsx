import type { LevelGeometry } from "@casastudio/geometry";
import { Divider, Stack, Typography } from "@mui/material";

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
  const items = [
    { label: "Source level", value: level.sourceLevelId },
    { label: "Vertices", value: `${level.vertices.length} vertices` },
    { label: "Boundary edges", value: `${level.boundaryEdges.length} boundary edges` },
    {
      label: "Boundary edge uses",
      value: `${level.boundaryEdgeUses.length} boundary edge uses`
    },
    { label: "Loops", value: `${level.loops.length} loops` },
    { label: "Polygons", value: `${level.polygons.length} polygons` }
  ];

  return (
    <Stack component="section" spacing={1} aria-labelledby="geometry-summary-heading">
      <Typography variant="subtitle2" component="h2" id="geometry-summary-heading">
        Runtime Summary
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
