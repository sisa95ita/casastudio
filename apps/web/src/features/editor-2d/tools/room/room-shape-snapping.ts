import {
  deriveRoomShapeVertices,
  type Level,
  type Point2D,
  type RoomShapeDefinition
} from "@casastudio/schema";

import type { GeometryPresentationModel2D } from "../../../geometry-2d/presentation/geometry-presentation-model-2d";
import { precisionTolerance } from "../../../geometry-2d/precision/precision-assistance-2d";
import type { ViewportTransform2D } from "../../../geometry-2d/viewport/viewport-transform-2d";
import type {
  DrawWallSnapCandidate,
  ReferenceLevelSnapTarget
} from "../wall/project-wall-snapping";

/** One preview vertex that coincides with a precision target after translation. */
export type RoomShapeSnapMatch = {
  readonly sourceVertexIndex: number;
  readonly snapCandidate: DrawWallSnapCandidate;
  readonly wallIds?: string[];
  readonly primary: boolean;
};

/** Consecutive preview vertices aligned to both endpoints of one Wall. */
export type RoomShapeEdgeAlignment = {
  readonly sourceVertexIndices: readonly [number, number];
  readonly wallIds: readonly string[];
  readonly kind: "current-wall" | "reference-wall";
};

/** One rigid Room-shape translation and every coincidence it produces. */
export type RoomShapeSnapResult = {
  readonly origin: Point2D;
  readonly primaryMatch: RoomShapeSnapMatch;
  readonly matches: readonly RoomShapeSnapMatch[];
  readonly edgeAlignments: readonly RoomShapeEdgeAlignment[];
};

type RoomShapeSnapTarget = {
  readonly priority: number;
  readonly kind: "vertex" | "wall-endpoint" | "reference-vertex";
  readonly geometryId: string;
  readonly point: Point2D;
  readonly screenPoint: { readonly x: number; readonly y: number };
  readonly wallIds: readonly string[];
};

type RankedRoomShapeCandidate = {
  readonly priority: number;
  readonly sourceVertexIndex: number;
  readonly snapCandidate: DrawWallSnapCandidate;
  readonly targetWallIds: readonly string[];
  readonly origin: Point2D;
  readonly matches: readonly Omit<RoomShapeSnapMatch, "primary">[];
  readonly edgeAlignments: readonly RoomShapeEdgeAlignment[];
};

const coordinateTolerance = 1e-7;

/**
 * Resolves one rigid translation from every final rotated shape vertex, then
 * reports every target coincidence produced by that unchanged translation.
 *
 * Canonical endpoints from the active draft Level take precedence over generic
 * runtime vertices and lower-Level positional targets. Complete current-Level
 * Wall or Wall-chain alignment and additional matching vertices refine
 * otherwise compatible candidates. The shape definition is never changed.
 */
export function resolveRoomShapeVertexSnap(
  origin: Point2D,
  shape: RoomShapeDefinition,
  model: GeometryPresentationModel2D,
  transform: Pick<ViewportTransform2D, "worldToScreen">,
  options: {
    readonly currentLevel: Pick<Level, "id" | "walls">;
    readonly cssPixelsPerSvgUnit?: number;
    readonly tolerancePixels?: number;
    readonly referenceTargets?: readonly ReferenceLevelSnapTarget[];
  }
): RoomShapeSnapResult | undefined {
  const sources = deriveRoomShapeVertices(origin, shape);
  if (!sources) return undefined;
  const cssScale = options.cssPixelsPerSvgUnit ?? 1;
  const tolerance =
    options.tolerancePixels ?? precisionTolerance.activationPixels;
  const currentVertices: RoomShapeSnapTarget[] = model.vertices.flatMap(
    (vertex) =>
      vertex.wallBacked === true
        ? [
            {
              priority: 1,
              kind: "vertex" as const,
              geometryId: vertex.geometryId,
              point: vertex.coordinates,
              screenPoint: vertex.point,
              wallIds: []
            }
          ]
        : []
  );
  const currentEndpoints = createCurrentWallEndpointTargets(
    options.currentLevel,
    transform
  );
  const referenceVertices = (options.referenceTargets ?? []).map((target) => ({
    priority: 2,
    kind: "reference-vertex" as const,
    geometryId: target.geometryId,
    point: target.point,
    screenPoint: target.screenPoint,
    wallIds: target.wallIds ?? [target.wallId]
  }));
  const targets = [
    ...currentVertices,
    ...currentEndpoints,
    ...referenceVertices
  ];
  const candidates: RankedRoomShapeCandidate[] = [];

  sources.forEach((source, sourceVertexIndex) => {
    const sourceScreen = transform.worldToScreen(source);
    for (const target of targets) {
      const visualDistancePixels =
        Math.hypot(
          target.screenPoint.x - sourceScreen.x,
          target.screenPoint.y - sourceScreen.y
        ) * cssScale;
      if (visualDistancePixels > tolerance) continue;
      const base = {
        geometryId: target.geometryId,
        point: target.point,
        visualDistancePixels
      };
      const snapCandidate: DrawWallSnapCandidate =
        target.kind === "vertex"
          ? { ...base, kind: target.kind }
          : { ...base, kind: target.kind, wallId: target.wallIds[0]! };
      const translatedOrigin = {
        x: origin.x + target.point.x - source.x,
        z: origin.z + target.point.z - source.z
      };
      const analysis = analyzeTranslation(
        translatedOrigin,
        shape,
        targets,
        options.currentLevel
      );
      candidates.push({
        priority: target.priority,
        sourceVertexIndex,
        snapCandidate,
        targetWallIds: target.wallIds,
        origin: translatedOrigin,
        ...analysis
      });
    }
  });

  const winner = candidates.sort((first, second) => {
    const priorityDifference = first.priority - second.priority;
    if (priorityDifference !== 0) return priorityDifference;
    const firstCompleteEdge = first.edgeAlignments.some(
      (alignment) => alignment.kind === "current-wall"
    );
    const secondCompleteEdge = second.edgeAlignments.some(
      (alignment) => alignment.kind === "current-wall"
    );
    if (firstCompleteEdge !== secondCompleteEdge)
      return firstCompleteEdge ? -1 : 1;
    const matchCountDifference = second.matches.length - first.matches.length;
    if (matchCountDifference !== 0) return matchCountDifference;
    const distanceDifference =
      first.snapCandidate.visualDistancePixels -
      second.snapCandidate.visualDistancePixels;
    if (Math.abs(distanceDifference) > precisionTolerance.distanceTiePixels)
      return distanceDifference;
    return (
      first.sourceVertexIndex - second.sourceVertexIndex ||
      first.snapCandidate.geometryId.localeCompare(
        second.snapCandidate.geometryId
      )
    );
  })[0];
  if (!winner) return undefined;

  const primaryMatch: RoomShapeSnapMatch = {
    sourceVertexIndex: winner.sourceVertexIndex,
    snapCandidate: winner.snapCandidate,
    ...(winner.targetWallIds.length > 0
      ? { wallIds: [...winner.targetWallIds] }
      : {}),
    primary: true
  };
  const matches = winner.matches.map((match) =>
    match.sourceVertexIndex === primaryMatch.sourceVertexIndex &&
    match.snapCandidate.geometryId === primaryMatch.snapCandidate.geometryId
      ? primaryMatch
      : { ...match, primary: false }
  );
  if (!matches.some((match) => match.primary)) matches.push(primaryMatch);
  matches.sort(
    (first, second) =>
      first.sourceVertexIndex - second.sourceVertexIndex ||
      first.snapCandidate.geometryId.localeCompare(
        second.snapCandidate.geometryId
      )
  );

  return {
    origin: winner.origin,
    primaryMatch,
    matches,
    edgeAlignments: winner.edgeAlignments
  };
}

function createCurrentWallEndpointTargets(
  level: Pick<Level, "id" | "walls">,
  transform: Pick<ViewportTransform2D, "worldToScreen">
): readonly RoomShapeSnapTarget[] {
  const targets = new Map<string, RoomShapeSnapTarget>();
  for (const wall of level.walls) {
    for (const point of [wall.start, wall.end]) {
      const key = `${point.x}:${point.z}`;
      const existing = targets.get(key);
      targets.set(key, {
        priority: 0,
        kind: "wall-endpoint",
        geometryId: `room-wall-endpoint:${level.id}:${key}`,
        point,
        screenPoint: transform.worldToScreen(point),
        wallIds: [...new Set([...(existing?.wallIds ?? []), wall.id])].sort()
      });
    }
  }
  return [...targets.values()].sort((first, second) =>
    first.geometryId.localeCompare(second.geometryId)
  );
}

function analyzeTranslation(
  origin: Point2D,
  shape: RoomShapeDefinition,
  targets: readonly RoomShapeSnapTarget[],
  currentLevel: Pick<Level, "walls">
): Pick<RankedRoomShapeCandidate, "matches" | "edgeAlignments"> {
  const translatedVertices = deriveRoomShapeVertices(origin, shape) ?? [];
  const targetMatches = translatedVertices.map((vertex) =>
    targets
      .filter((target) => samePoint(vertex, target.point))
      .sort(compareTargets)
  );
  const matches = targetMatches.flatMap((matchedTargets, sourceVertexIndex) => {
    const target = matchedTargets[0];
    if (!target) return [];
    const base = {
      geometryId: target.geometryId,
      point: target.point,
      visualDistancePixels: 0
    };
    const snapCandidate: DrawWallSnapCandidate =
      target.kind === "vertex"
        ? { ...base, kind: target.kind }
        : { ...base, kind: target.kind, wallId: target.wallIds[0]! };
    return [
      {
        sourceVertexIndex,
        snapCandidate,
        ...(target.wallIds.length > 0 ? { wallIds: [...target.wallIds] } : {})
      }
    ];
  });
  const edgeAlignments: RoomShapeEdgeAlignment[] = [];
  translatedVertices.forEach((start, sourceVertexIndex) => {
    const nextVertexIndex = (sourceVertexIndex + 1) % translatedVertices.length;
    const end = translatedVertices[nextVertexIndex]!;
    const currentWallIds = resolveExactWallChain(
      start,
      end,
      currentLevel.walls
    );
    if (currentWallIds) {
      edgeAlignments.push({
        sourceVertexIndices: [sourceVertexIndex, nextVertexIndex],
        wallIds: currentWallIds,
        kind: "current-wall"
      });
    }
    const firstReferenceWallIds = new Set(
      targetMatches[sourceVertexIndex]
        ?.filter((target) => target.kind === "reference-vertex")
        .flatMap((target) => target.wallIds) ?? []
    );
    const secondReferenceWallIds = new Set(
      targetMatches[nextVertexIndex]
        ?.filter((target) => target.kind === "reference-vertex")
        .flatMap((target) => target.wallIds) ?? []
    );
    for (const wallId of [...firstReferenceWallIds].sort()) {
      if (!secondReferenceWallIds.has(wallId)) continue;
      edgeAlignments.push({
        sourceVertexIndices: [sourceVertexIndex, nextVertexIndex],
        wallIds: [wallId],
        kind: "reference-wall"
      });
    }
  });
  return { matches, edgeAlignments };
}

function resolveExactWallChain(
  start: Point2D,
  end: Point2D,
  walls: Pick<Level, "walls">["walls"]
): readonly string[] | undefined {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (lengthSquared === 0) return undefined;
  const parameter = (point: Point2D) =>
    ((point.x - start.x) * deltaX + (point.z - start.z) * deltaZ) /
    lengthSquared;
  const cross = (point: Point2D) =>
    deltaX * (point.z - start.z) - deltaZ * (point.x - start.x);
  const contacts = walls
    .flatMap((wall) => {
      if (
        Math.abs(cross(wall.start)) > coordinateTolerance ||
        Math.abs(cross(wall.end)) > coordinateTolerance
      )
        return [];
      const first = parameter(wall.start);
      const second = parameter(wall.end);
      const rawStart = Math.min(first, second);
      const rawEnd = Math.max(first, second);
      const contactStart = Math.max(0, rawStart);
      const contactEnd = Math.min(1, rawEnd);
      return contactEnd - contactStart > coordinateTolerance
        ? [{ wallId: wall.id, rawStart, rawEnd, contactStart, contactEnd }]
        : [];
    })
    .sort(
      (first, second) =>
        first.contactStart - second.contactStart ||
        first.wallId.localeCompare(second.wallId)
    );
  if (contacts.length === 0) return undefined;
  let cursor = 0;
  const wallIds: string[] = [];
  for (const contact of contacts) {
    if (
      contact.rawStart < -coordinateTolerance ||
      contact.rawEnd > 1 + coordinateTolerance ||
      Math.abs(contact.contactStart - cursor) > coordinateTolerance
    )
      return undefined;
    cursor = contact.contactEnd;
    wallIds.push(contact.wallId);
  }
  return Math.abs(cursor - 1) <= coordinateTolerance ? wallIds : undefined;
}

function compareTargets(
  first: RoomShapeSnapTarget,
  second: RoomShapeSnapTarget
): number {
  return (
    first.priority - second.priority ||
    first.geometryId.localeCompare(second.geometryId)
  );
}

function samePoint(first: Point2D, second: Point2D): boolean {
  return (
    Math.abs(first.x - second.x) <= coordinateTolerance &&
    Math.abs(first.z - second.z) <= coordinateTolerance
  );
}
