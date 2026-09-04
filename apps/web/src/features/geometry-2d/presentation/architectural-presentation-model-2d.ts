import {
  createArchitecturalWallBodyShapes,
  createDoorPlanGeometry,
  createWallOpeningPlanGeometry,
  createWindowPlanGeometry
} from "@casastudio/geometry";
import type { Level, Point2D, StairFlight, StairLanding, Staircase } from "@casastudio/schema";

import { formatSvgNumber } from "../viewport/geometry-svg-helpers";
import { isGeometrySelectionMatch, type GeometrySelectionState } from "../selection/geometry-selection-state";
import type { ScreenPoint, ViewportTransform2D } from "../viewport/viewport-transform-2d";

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

/** Screen-oriented unadorned Wall Opening symbol. */
export type WallOpeningPresentation2D = {
  readonly kind: "OPENING";
  readonly geometryId: string;
  readonly wallId: string;
  readonly spanStart: ScreenPoint;
  readonly spanEnd: ScreenPoint;
  readonly jambs: readonly [readonly [ScreenPoint, ScreenPoint], readonly [ScreenPoint, ScreenPoint]];
  readonly selected: boolean;
  readonly hovered: boolean;
};

/** Screen-oriented measured StairFlight with derived plan treads. */
export type StairFlightPresentation2D = {
  readonly kind: "STAIR_FLIGHT";
  readonly geometryId: string;
  readonly staircaseId: string;
  readonly start: ScreenPoint;
  readonly end: ScreenPoint;
  readonly bodySvgPoints: string;
  readonly treadLines: readonly { readonly start: ScreenPoint; readonly end: ScreenPoint }[];
  readonly directionLine: { readonly start: ScreenPoint; readonly end: ScreenPoint };
  readonly directionArrow: string;
  readonly selected: boolean;
  readonly hovered: boolean;
};

/** Screen-oriented canonical StairLanding footprint. */
export type StairLandingPresentation2D = {
  readonly kind: "STAIR_LANDING";
  readonly geometryId: string;
  readonly staircaseId: string;
  readonly bodySvgPoints: string;
  readonly selected: boolean;
  readonly hovered: boolean;
};

/** Root Staircase presentation that owns rendered Flights and Landings. */
export type StaircasePresentation2D = {
  readonly kind: "STAIRCASE";
  readonly geometryId: string;
  readonly flights: readonly StairFlightPresentation2D[];
  readonly landings: readonly StairLandingPresentation2D[];
  readonly selected: boolean;
  readonly hovered: boolean;
};

/** Product-plan presentation kept separate from diagnostic runtime geometry. */
export type ArchitecturalPresentationModel2D = {
  readonly walls: readonly ArchitecturalWallPresentation2D[];
  readonly doors: readonly DoorPresentation2D[];
  readonly windows: readonly WindowPresentation2D[];
  readonly openings: readonly WallOpeningPresentation2D[];
  readonly staircases: readonly StaircasePresentation2D[];
  readonly joins: readonly { readonly point: ScreenPoint; readonly radius: number }[];
};

/** Adapts canonical Wall/Openings into screen geometry without reconstructing topology. */
export function createArchitecturalPresentationModel2D(
  level: Pick<Level, "walls" | "staircases">,
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
  const openings: WallOpeningPresentation2D[] = [];
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
      } else if (opening.type === "WINDOW") {
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
      } else {
        const geometry = createWallOpeningPlanGeometry(wall, opening);
        openings.push({
          kind: "OPENING",
          geometryId: opening.id,
          wallId: wall.id,
          spanStart: transform.worldToScreen(geometry.span.start),
          spanEnd: transform.worldToScreen(geometry.span.end),
          jambs: mapLines(geometry.jambs, transform),
          selected: isGeometrySelectionMatch(selection.selected, "OPENING", opening.id),
          hovered: isGeometrySelectionMatch(selection.hovered, "OPENING", opening.id)
        });
      }
    }
  }
  const staircases = level.staircases.map((staircase) =>
    createStaircasePresentation2D(staircase, transform, selection)
  );
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
    openings,
    staircases,
    joins: [...junctions.values()]
      .filter((junction) => junction.count > 1 && !junction.blockedByOpening)
      .map((junction) => ({ point: transform.worldToScreen(junction.point), radius: transform.scaleLength(junction.thickness / 2) }))
  };
}

/** Builds the shared architectural plan geometry used by committed and preview Stairs. */
export function createStaircasePresentation2D(
  staircase: Staircase,
  transform: ViewportTransform2D,
  selection: GeometrySelectionState = { selected: [] }
): StaircasePresentation2D {
  return {
    kind: "STAIRCASE",
    geometryId: staircase.id,
    selected: isGeometrySelectionMatch(selection.selected, "STAIRCASE", staircase.id),
    hovered: isGeometrySelectionMatch(selection.hovered, "STAIRCASE", staircase.id),
    flights: staircase.flights.map((flight): StairFlightPresentation2D => {
      const start = transform.worldToScreen(flight.start);
      const end = transform.worldToScreen(flight.end);
      const direction = createDirectionGraphic(start, end);
      return {
        kind: "STAIR_FLIGHT",
        geometryId: flight.id,
        staircaseId: staircase.id,
        start,
        end,
        bodySvgPoints: createFlightBodyPoints(flight, transform),
        treadLines: createTreadLines(flight).map((line) => ({
          start: transform.worldToScreen(line[0]),
          end: transform.worldToScreen(line[1])
        })),
        directionLine: direction.line,
        directionArrow: direction.arrow,
        selected: isGeometrySelectionMatch(selection.selected, "STAIR_FLIGHT", flight.id),
        hovered: isGeometrySelectionMatch(selection.hovered, "STAIR_FLIGHT", flight.id)
      };
    }),
    landings: staircase.landings.map((landing, index): StairLandingPresentation2D => ({
      kind: "STAIR_LANDING",
      geometryId: landing.id,
      staircaseId: staircase.id,
      bodySvgPoints: createLandingBodyPoints(staircase, landing, index, transform),
      selected: isGeometrySelectionMatch(selection.selected, "STAIR_LANDING", landing.id),
      hovered: isGeometrySelectionMatch(selection.hovered, "STAIR_LANDING", landing.id)
    }))
  };
}

function createFlightBodyPoints(
  flight: StairFlight,
  transform: ViewportTransform2D
): string {
  const delta = { x: flight.end.x - flight.start.x, z: flight.end.z - flight.start.z };
  const length = Math.hypot(delta.x, delta.z);
  const normal = { x: -delta.z / length * flight.width / 2, z: delta.x / length * flight.width / 2 };
  return [
    { x: flight.start.x + normal.x, z: flight.start.z + normal.z },
    { x: flight.end.x + normal.x, z: flight.end.z + normal.z },
    { x: flight.end.x - normal.x, z: flight.end.z - normal.z },
    { x: flight.start.x - normal.x, z: flight.start.z - normal.z }
  ].map((point) => svgPoint(transform.worldToScreen(point))).join(" ");
}

function createTreadLines(flight: StairFlight): readonly [Point2D, Point2D][] {
  const delta = { x: flight.end.x - flight.start.x, z: flight.end.z - flight.start.z };
  const length = Math.hypot(delta.x, delta.z);
  const normal = { x: -delta.z / length * flight.width / 2, z: delta.x / length * flight.width / 2 };
  return Array.from({ length: flight.stepCount }, (_, index) => {
    const ratio = (index + 1) / (flight.stepCount + 1);
    const center = { x: flight.start.x + delta.x * ratio, z: flight.start.z + delta.z * ratio };
    return [
      { x: center.x + normal.x, z: center.z + normal.z },
      { x: center.x - normal.x, z: center.z - normal.z }
    ];
  });
}

function createLandingBodyPoints(
  staircase: Staircase,
  landing: StairLanding,
  landingIndex: number,
  transform: ViewportTransform2D
): string {
  const adjacentFlight = staircase.flights[Math.min(landingIndex, staircase.flights.length - 1)];
  const direction = adjacentFlight ? worldDirection(adjacentFlight.start, adjacentFlight.end) : { x: 1, z: 0 };
  const normal = { x: -direction.z, z: direction.x };
  const longitudinal = { x: direction.x * landing.depth / 2, z: direction.z * landing.depth / 2 };
  const lateral = { x: normal.x * landing.width / 2, z: normal.z * landing.width / 2 };
  return [
    addWorld(landing.position, longitudinal, lateral),
    addWorld(landing.position, longitudinal, { x: -lateral.x, z: -lateral.z }),
    addWorld(landing.position, { x: -longitudinal.x, z: -longitudinal.z }, { x: -lateral.x, z: -lateral.z }),
    addWorld(landing.position, { x: -longitudinal.x, z: -longitudinal.z }, lateral)
  ].map((point) => svgPoint(transform.worldToScreen(point))).join(" ");
}

function createDirectionGraphic(start: ScreenPoint, end: ScreenPoint): {
  readonly line: { readonly start: ScreenPoint; readonly end: ScreenPoint };
  readonly arrow: string;
} {
  const delta = { x: end.x - start.x, y: end.y - start.y };
  const length = Math.hypot(delta.x, delta.y) || 1;
  const direction = { x: delta.x / length, y: delta.y / length };
  const normal = { x: -direction.y, y: direction.x };
  const lineStart = { x: start.x + delta.x * 0.18, y: start.y + delta.y * 0.18 };
  const lineEnd = { x: start.x + delta.x * 0.82, y: start.y + delta.y * 0.82 };
  const arrowBack = { x: lineEnd.x - direction.x * 9, y: lineEnd.y - direction.y * 9 };
  const left = { x: arrowBack.x + normal.x * 4.5, y: arrowBack.y + normal.y * 4.5 };
  const right = { x: arrowBack.x - normal.x * 4.5, y: arrowBack.y - normal.y * 4.5 };
  return {
    line: { start: lineStart, end: lineEnd },
    arrow: `M ${svgPoint(left)} L ${svgPoint(lineEnd)} L ${svgPoint(right)}`
  };
}

function worldDirection(start: Point2D, end: Point2D): Point2D {
  const length = Math.hypot(end.x - start.x, end.z - start.z) || 1;
  return { x: (end.x - start.x) / length, z: (end.z - start.z) / length };
}

function addWorld(origin: Point2D, first: Point2D, second: Point2D): Point2D {
  return { x: origin.x + first.x + second.x, z: origin.z + first.z + second.z };
}

function mapLines(
  lines: readonly [readonly [Point2D, Point2D], readonly [Point2D, Point2D]],
  transform: ViewportTransform2D
): readonly [readonly [ScreenPoint, ScreenPoint], readonly [ScreenPoint, ScreenPoint]] {
  return lines.map((line) => line.map((point) => transform.worldToScreen(point))) as unknown as readonly [readonly [ScreenPoint, ScreenPoint], readonly [ScreenPoint, ScreenPoint]];
}

const svgPoint = (point: ScreenPoint): string => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`;
