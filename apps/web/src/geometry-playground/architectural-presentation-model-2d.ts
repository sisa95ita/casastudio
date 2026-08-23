import {
  createArchitecturalWallBodyShapes,
  createDoorPlanGeometry,
  createWindowPlanGeometry
} from "@casastudio/geometry";
import type { Level, Point2D } from "@casastudio/schema";

import { formatSvgNumber } from "./geometry-svg-helpers";
import { isGeometrySelectionMatch, type GeometrySelectionState } from "./geometry-selection-state";
import type { ScreenPoint, ViewportTransform2D } from "./viewport-transform-2d";

/** Screen-oriented physical Wall body used only by the architectural renderer. */
export type ArchitecturalWallPresentation2D = {
  readonly kind: "WALL";
  readonly geometryId: string;
  readonly bodySvgPoints: readonly string[];
  readonly start: ScreenPoint;
  readonly end: ScreenPoint;
  readonly hitWidth: number;
  readonly selected: boolean;
  readonly hovered: boolean;
};

/** Screen-oriented architectural Door symbol. */
export type DoorPresentation2D = {
  readonly kind: "DOOR";
  readonly geometryId: string;
  readonly wallId: string;
  readonly spanStart: ScreenPoint;
  readonly spanEnd: ScreenPoint;
  readonly hinge: ScreenPoint;
  readonly leafEnd: ScreenPoint;
  readonly arcPath: string;
  readonly jambs: readonly [readonly [ScreenPoint, ScreenPoint], readonly [ScreenPoint, ScreenPoint]];
  readonly selected: boolean;
  readonly hovered: boolean;
};

/** Screen-oriented architectural Window symbol. */
export type WindowPresentation2D = {
  readonly kind: "WINDOW";
  readonly geometryId: string;
  readonly wallId: string;
  readonly spanStart: ScreenPoint;
  readonly spanEnd: ScreenPoint;
  readonly glazingLines: readonly [readonly [ScreenPoint, ScreenPoint], readonly [ScreenPoint, ScreenPoint]];
  readonly jambs: readonly [readonly [ScreenPoint, ScreenPoint], readonly [ScreenPoint, ScreenPoint]];
  readonly selected: boolean;
  readonly hovered: boolean;
};

/** Product-plan presentation kept separate from diagnostic runtime geometry. */
export type ArchitecturalPresentationModel2D = {
  readonly walls: readonly ArchitecturalWallPresentation2D[];
  readonly doors: readonly DoorPresentation2D[];
  readonly windows: readonly WindowPresentation2D[];
  readonly joins: readonly { readonly point: ScreenPoint; readonly radius: number }[];
};

/** Adapts canonical Wall/Openings into screen geometry without reconstructing topology. */
export function createArchitecturalPresentationModel2D(
  level: Pick<Level, "walls">,
  transform: ViewportTransform2D,
  selection: GeometrySelectionState
): ArchitecturalPresentationModel2D {
  const walls = level.walls.map((wall): ArchitecturalWallPresentation2D => ({
    kind: "WALL",
    geometryId: wall.id,
    bodySvgPoints: createArchitecturalWallBodyShapes(wall).map((shape) =>
      shape.points.map((point) => svgPoint(transform.worldToScreen(point))).join(" ")
    ),
    start: transform.worldToScreen(wall.start),
    end: transform.worldToScreen(wall.end),
    hitWidth: Math.max(12, transform.scaleLength(wall.thickness)),
    selected: isGeometrySelectionMatch(selection.selected, "WALL", wall.id),
    hovered: isGeometrySelectionMatch(selection.hovered, "WALL", wall.id)
  }));
  const doors: DoorPresentation2D[] = [];
  const windows: WindowPresentation2D[] = [];
  for (const wall of level.walls) {
    for (const opening of wall.openings) {
      if (opening.type === "DOOR") {
        const geometry = createDoorPlanGeometry(wall, opening);
        const arcStart = transform.worldToScreen(geometry.arcStart);
        const arcEnd = transform.worldToScreen(geometry.arcEnd);
        doors.push({
          kind: "DOOR",
          geometryId: opening.id,
          wallId: wall.id,
          spanStart: transform.worldToScreen(geometry.span.start),
          spanEnd: transform.worldToScreen(geometry.span.end),
          hinge: transform.worldToScreen(geometry.hinge),
          leafEnd: transform.worldToScreen(geometry.openLeafEnd),
          arcPath: `M ${svgPoint(arcStart)} A ${formatSvgNumber(transform.scaleLength(geometry.arcRadius))} ${formatSvgNumber(transform.scaleLength(geometry.arcRadius))} 0 0 ${geometry.arcSweep === 1 ? 0 : 1} ${svgPoint(arcEnd)}`,
          jambs: mapLines(geometry.jambs, transform),
          selected: isGeometrySelectionMatch(selection.selected, "DOOR", opening.id),
          hovered: isGeometrySelectionMatch(selection.hovered, "DOOR", opening.id)
        });
      } else {
        const geometry = createWindowPlanGeometry(wall, opening);
        windows.push({
          kind: "WINDOW",
          geometryId: opening.id,
          wallId: wall.id,
          spanStart: transform.worldToScreen(geometry.span.start),
          spanEnd: transform.worldToScreen(geometry.span.end),
          glazingLines: mapLines(geometry.glazingLines, transform),
          jambs: mapLines(geometry.jambs, transform),
          selected: isGeometrySelectionMatch(selection.selected, "WINDOW", opening.id),
          hovered: isGeometrySelectionMatch(selection.hovered, "WINDOW", opening.id)
        });
      }
    }
  }
  const junctions = new Map<string, { point: Point2D; count: number; thickness: number; blockedByOpening: boolean }>();
  for (const wall of level.walls) {
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    for (const [endpoint, point] of [["start", wall.start], ["end", wall.end]] as const) {
      const key = `${point.x}:${point.z}`;
      const current = junctions.get(key);
      const blockedByOpening = wall.openings.some((opening) =>
        endpoint === "start"
          ? opening.offsetFromStart === 0
          : opening.offsetFromStart + opening.width === length
      );
      junctions.set(key, {
        point,
        count: (current?.count ?? 0) + 1,
        thickness: Math.max(current?.thickness ?? 0, wall.thickness),
        blockedByOpening: (current?.blockedByOpening ?? false) || blockedByOpening
      });
    }
  }
  return {
    walls,
    doors,
    windows,
    joins: [...junctions.values()]
      .filter((junction) => junction.count > 1 && !junction.blockedByOpening)
      .map((junction) => ({ point: transform.worldToScreen(junction.point), radius: transform.scaleLength(junction.thickness / 2) }))
  };
}

function mapLines(
  lines: readonly [readonly [Point2D, Point2D], readonly [Point2D, Point2D]],
  transform: ViewportTransform2D
): readonly [readonly [ScreenPoint, ScreenPoint], readonly [ScreenPoint, ScreenPoint]] {
  return lines.map((line) => line.map((point) => transform.worldToScreen(point))) as unknown as readonly [readonly [ScreenPoint, ScreenPoint], readonly [ScreenPoint, ScreenPoint]];
}

const svgPoint = (point: ScreenPoint): string => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`;
