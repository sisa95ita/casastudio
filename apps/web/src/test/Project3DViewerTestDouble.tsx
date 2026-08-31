import {
  collectVisibleSceneBounds3D,
  getVisibleLevelReferences3D
} from "../project-3d/architectural-scene-3d-model";
import type { Project3DViewerProps } from "../project-3d/Project3DViewer";

/** Lightweight renderer boundary for page tests that exercise 2D and 3D mode integration. */
export function Project3DViewerTestDouble({
  model,
  activeLevelId,
  visibility,
  onVisibilityChange
}: Project3DViewerProps) {
  const visibleLevels = getVisibleLevelReferences3D(
    model,
    visibility,
    activeLevelId
  );
  const visibleBounds = collectVisibleSceneBounds3D(
    model,
    visibility,
    activeLevelId
  );

  return (
    <section
      data-testid="project-3d-workspace"
      data-architectural-wall-count={visibleLevels.reduce(
        (count, level) => count + level.walls.length,
        0
      )}
      data-architectural-wall-section-count={visibleLevels.reduce(
        (count, level) =>
          count +
          level.walls.reduce(
            (levelCount, wall) => levelCount + wall.sections.length,
            0
          ),
        0
      )}
      data-architectural-floor-count={visibleLevels.reduce(
        (count, level) => count + level.floors.length,
        0
      )}
      data-architectural-opening-kinds={visibleLevels
        .flatMap((level) =>
          level.walls.flatMap((wall) =>
            wall.openings.map((opening) => opening.kind)
          )
        )
        .join(",")}
      data-architectural-door-count={visibleLevels.reduce(
        (count, level) =>
          count +
          level.walls.reduce(
            (levelCount, wall) => levelCount + wall.doors.length,
            0
          ),
        0
      )}
      data-architectural-window-count={visibleLevels.reduce(
        (count, level) =>
          count +
          level.walls.reduce(
            (levelCount, wall) => levelCount + wall.windows.length,
            0
          ),
        0
      )}
      data-architectural-wall-opening-count={visibleLevels.reduce(
        (count, level) =>
          count +
          level.walls.reduce(
            (levelCount, wall) => levelCount + wall.wallOpenings.length,
            0
          ),
        0
      )}
      data-architectural-door-poses={JSON.stringify(
        visibleLevels.flatMap((level) =>
          level.walls.flatMap((wall) =>
            wall.doors.map((door) => ({
              id: door.id,
              hingeSide: door.hingeSide,
              swingSide: door.swingSide,
              hinge: door.hinge,
              leafEnd: door.leafEnd
            }))
          )
        )
      )}
      data-visible-architectural-bounds={
        visibleBounds
          ? JSON.stringify({ min: visibleBounds.min, max: visibleBounds.max })
          : ""
      }
    >
      <button type="button" onClick={() => onVisibilityChange("all")}>
        All Levels
      </button>
      <button
        type="button"
        disabled={!activeLevelId}
        onClick={() => onVisibilityChange("active")}
      >
        Active Level
      </button>
      <button type="button">Fit to building</button>
      <button type="button">Reset camera</button>
      <div data-testid="project-3d-canvas" />
    </section>
  );
}
