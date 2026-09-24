import {
  collectVisibleSceneBounds3D,
  getVisibleLevelReferences3D
} from "../features/project-3d/model/architectural-scene-3d-model";
import type { Project3DViewerProps } from "../features/project-3d/Project3DViewer";
import { threePlanPointToProject } from "../features/project-3d/interaction/furniture-manipulation-3d";
import { useCasaTranslation } from "../core/i18n";

/** Lightweight renderer boundary for page tests that exercise 2D and 3D mode integration. */
export function Project3DViewerTestDouble({
  mode,
  model,
  activeLevelId,
  visibility,
  onVisibilityChange,
  selection,
  onSelectionChange,
  furnitureManipulation
}: Project3DViewerProps) {
  const { t } = useCasaTranslation("project-viewer");
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
      data-furniture-editable={Boolean(furnitureManipulation)}
      data-furniture-preview-valid={
        furnitureManipulation?.preview
          ? furnitureManipulation.previewValid
          : undefined
      }
    >
      <h2>{t("threeD.title")}</h2>
      <p>
        {t(
          mode === "edit" ? "threeD.editDescription" : "threeD.viewDescription"
        )}
      </p>
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
      {visibleLevels.flatMap((level) =>
        level.walls.map((wall) => (
          <button
            key={`${level.id}:wall:${wall.id}`}
            type="button"
            onClick={() =>
              onSelectionChange({
                kind: "wall",
                id: wall.id,
                levelId: level.id
              })
            }
          >
            Select Wall {wall.id}
          </button>
        ))
      )}
      {visibleLevels.flatMap((level) =>
        level.furniture.map((item) => {
          const identity = {
            kind: "furniture" as const,
            id: item.id,
            levelId: level.id
          };
          const selected =
            selection?.kind === "furniture" && selection.id === item.id;
          const center = furnitureManipulation
            ? threePlanPointToProject(
                item.position,
                furnitureManipulation.sourceUnit
              )
            : undefined;
          return (
            <div key={item.id}>
              <button type="button" onClick={() => onSelectionChange(identity)}>
                Select {item.name}
              </button>
              {selected && furnitureManipulation && center ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      furnitureManipulation.onBegin(item.id, "move", center, 1)
                    }
                  >
                    Start moving {item.name}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      furnitureManipulation.onMove(
                        { x: center.x + 20, z: center.z + 10 },
                        1
                      )
                    }
                  >
                    Preview moving {item.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => furnitureManipulation.onEnd(true)}
                  >
                    Finish moving {item.name}
                  </button>
                </>
              ) : null}
            </div>
          );
        })
      )}
      <div data-testid="project-3d-canvas" />
    </section>
  );
}
