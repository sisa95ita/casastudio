import { GeometryEngine } from "@casastudio/geometry";
import type { Project } from "@casastudio/schema";
import { useMemo, useState } from "react";

import { GeometryBuildErrorPanel } from "./GeometryBuildErrorPanel";
import { geometryPlaygroundProject } from "./geometry-playground-fixture";
import { GeometryLayerControls } from "./GeometryLayerControls";
import { GeometryRuntimeSummary } from "./GeometryRuntimeSummary";
import { defaultGeometryDisplayOptions, GeometrySvgViewer } from "./GeometrySvgViewer";

/**
 * Props for the read-only geometry playground page.
 */
export type GeometryPlaygroundPageProps = {
  readonly project?: Project;
};

/**
 * Hosts the Phase 1 read-only geometry runtime playground.
 *
 * The page intentionally executes the real pipeline from canonical `Project`
 * through `GeometryEngine.build(project)` into `GeometryModel`, then passes one
 * selected `LevelGeometry` directly to SVG components. No complete editor
 * view-model is introduced in this phase because the page has no editing,
 * selection, commands, or mutable domain operations.
 */
export function GeometryPlaygroundPage({
  project = geometryPlaygroundProject
}: GeometryPlaygroundPageProps) {
  const buildResult = useMemo(() => GeometryEngine.build(project), [project]);
  const [displayOptions, setDisplayOptions] = useState(defaultGeometryDisplayOptions);
  const [selectedLevelId, setSelectedLevelId] = useState(() =>
    buildResult.ok ? (buildResult.model.levels[0]?.id ?? "") : ""
  );

  if (!buildResult.ok) {
    return (
      <main className="geometry-page">
        <PageIntro />
        <GeometryBuildErrorPanel errors={buildResult.errors} />
      </main>
    );
  }

  const selectedLevel =
    buildResult.model.levels.find((level) => level.id === selectedLevelId) ??
    buildResult.model.levels[0];

  if (!selectedLevel) {
    return (
      <main className="geometry-page">
        <PageIntro />
        <div className="geometry-empty-state" role="status">
          GeometryEngine produced a model with no levels.
        </div>
      </main>
    );
  }

  return (
    <main className="geometry-page">
      <PageIntro />

      {buildResult.model.levels.length > 1 ? (
        <label className="geometry-level-selector">
          <span>Level</span>
          <select
            value={selectedLevel.id}
            onChange={(event) => setSelectedLevelId(event.currentTarget.value)}
          >
            {buildResult.model.levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.sourceLevelId}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="geometry-workspace">
        <section className="geometry-viewer-panel" aria-labelledby="geometry-viewer-heading">
          <h2 id="geometry-viewer-heading">SVG Debug Viewer</h2>
          <GeometrySvgViewer level={selectedLevel} options={displayOptions} />
        </section>

        <aside className="geometry-sidebar" aria-label="Geometry diagnostics">
          <GeometryLayerControls
            options={displayOptions}
            onOptionsChange={setDisplayOptions}
          />
          <GeometryRuntimeSummary level={selectedLevel} />
        </aside>
      </div>
    </main>
  );
}

function PageIntro() {
  return (
    <header className="geometry-page-header">
      <p className="geometry-kicker">Technical Runtime Viewer</p>
      <h1>Geometry Playground</h1>
      <p>
        This route renders a canonical Project through GeometryEngine.build into
        an immutable GeometryModel, fitted through a small XZ-to-SVG viewport
        transform.
      </p>
    </header>
  );
}
