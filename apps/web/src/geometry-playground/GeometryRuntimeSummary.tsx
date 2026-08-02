import type { LevelGeometry } from "@casastudio/geometry";

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
    <section className="geometry-summary" aria-labelledby="geometry-summary-heading">
      <h2 id="geometry-summary-heading">Runtime Summary</h2>
      <dl>
        {items.map((item) => (
          <div key={item.label} className="geometry-summary-item">
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
