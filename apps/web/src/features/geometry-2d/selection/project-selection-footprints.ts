import {
  createArchitecturalWallBodyShapes,
  createDoorPlanGeometry,
  createWallOpeningPlanGeometry,
  createWindowPlanGeometry
} from "@casastudio/geometry";
import type { FurnitureItem, Level, Point2D } from "@casastudio/schema";

import type { GeometryPresentationModel2D } from "../presentation/geometry-presentation-model-2d";
import {
  createFurnitureFootprint2D,
  createStairFootprints2D
} from "../presentation/plan-footprints-2d";
import type { GeometrySelectionFootprint } from "./geometry-selection-spatial";
import { sortGeometrySelectionFootprints } from "./geometry-selection-spatial";

/** Builds exact Project-space selection geometry in stable product precedence. */
export function createProjectSelectionFootprints(
  level: Pick<Level, "walls" | "staircases">,
  geometry: GeometryPresentationModel2D,
  furniture: readonly FurnitureItem[]
): readonly GeometrySelectionFootprint[] {
  const footprints: GeometrySelectionFootprint[] = [];

  for (const wall of level.walls) {
    footprints.push({
      selection: { kind: "WALL", geometryId: wall.id },
      polygons: [createWallEnvelope(wall.start, wall.end, wall.thickness)]
    });
    for (const opening of wall.openings) {
      const selection = { kind: opening.type, geometryId: opening.id } as const;
      if (opening.type === "DOOR") {
        const plan = createDoorPlanGeometry(wall, opening);
        footprints.push({
          selection,
          polygons: [
            createWallEnvelope(plan.span.start, plan.span.end, wall.thickness),
            [plan.hinge, plan.span.end, plan.openLeafEnd]
          ]
        });
      } else {
        const plan =
          opening.type === "WINDOW"
            ? createWindowPlanGeometry(wall, opening)
            : createWallOpeningPlanGeometry(wall, opening);
        footprints.push({
          selection,
          polygons: [
            createWallEnvelope(plan.span.start, plan.span.end, wall.thickness)
          ]
        });
      }
    }
  }

  for (const staircase of level.staircases) {
    footprints.push({
      selection: { kind: "STAIRCASE", geometryId: staircase.id },
      polygons: createStairFootprints2D({ staircases: [staircase] })
    });
  }

  for (const item of furniture) {
    footprints.push({
      selection: { kind: "FURNITURE", geometryId: item.id },
      polygons: [createFurnitureFootprint2D(item)]
    });
  }

  for (const polygon of geometry.polygons) {
    footprints.push({
      selection: { kind: "POLYGON", geometryId: polygon.geometryId },
      polygons: [polygon.points.map((point) => point.world)]
    });
  }

  return sortGeometrySelectionFootprints(footprints);
}

function createWallEnvelope(
  start: Point2D,
  end: Point2D,
  thickness: number
): readonly Point2D[] {
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  if (length === 0)
    return createArchitecturalWallBodyShapes({
      id: "selection-envelope",
      name: "Selection envelope",
      start,
      end,
      height: 1,
      thickness,
      roomIds: [],
      openings: []
    }).flatMap((shape) => shape.points);
  const normal = {
    x: ((-(end.z - start.z) / length) * thickness) / 2,
    z: (((end.x - start.x) / length) * thickness) / 2
  };
  return [
    { x: start.x + normal.x, z: start.z + normal.z },
    { x: end.x + normal.x, z: end.z + normal.z },
    { x: end.x - normal.x, z: end.z - normal.z },
    { x: start.x - normal.x, z: start.z - normal.z }
  ];
}
