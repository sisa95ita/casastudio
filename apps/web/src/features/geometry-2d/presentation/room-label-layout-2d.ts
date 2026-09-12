import type { Point2D } from "@casastudio/schema";
import type { ScreenPoint } from "../viewport/viewport-transform-2d";
import {
  convexPolygonsOverlap,
  polygonContainsPolygon
} from "./plan-footprints-2d";

export type RoomLabelBounds2D = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

export type RoomLabelPlacement2D = {
  readonly anchor: ScreenPoint;
  readonly bounds: RoomLabelBounds2D;
  readonly fallback: boolean;
};

export type RoomLabelPlacementOptions2D = {
  readonly preferredAnchor: ScreenPoint;
  readonly roomPolygon: readonly ScreenPoint[];
  readonly roomName: string;
  readonly formattedArea: string;
  readonly elevationLabel?: string;
  readonly furnitureFootprints: readonly (readonly ScreenPoint[])[];
  readonly stairFootprints: readonly (readonly ScreenPoint[])[];
  readonly architecturalFootprints?: readonly (readonly ScreenPoint[])[];
  readonly occupiedLabelBounds: readonly RoomLabelBounds2D[];
};

/**
 * Chooses the first deterministic compass candidate that remains inside its own
 * Room and clear of physical plan clutter, preferring candidates clear of Stairs.
 */
export function placeRoomLabel2D({
  preferredAnchor,
  roomPolygon,
  roomName,
  formattedArea,
  elevationLabel,
  furnitureFootprints,
  stairFootprints,
  architecturalFootprints = [],
  occupiedLabelBounds
}: RoomLabelPlacementOptions2D): RoomLabelPlacement2D {
  const dimensions = estimateLabelDimensions(
    roomName,
    formattedArea,
    elevationLabel
  );
  const roomBounds = boundsOf(roomPolygon);
  const offsetX = Math.min(
    Math.max(dimensions.width * 0.7, 22),
    roomBounds.width * 0.22
  );
  const offsetY = Math.min(
    Math.max(dimensions.height * 0.7, 20),
    roomBounds.height * 0.22
  );
  const largerOffsetX = Math.min(
    Math.max(dimensions.width * 1.35, 42),
    roomBounds.width * 0.38
  );
  const largerOffsetY = Math.min(
    Math.max(dimensions.height * 1.45, 38),
    roomBounds.height * 0.38
  );
  const candidates = uniqueCandidates([
    preferredAnchor,
    ...candidateRing(preferredAnchor, offsetX, offsetY),
    ...candidateRing(preferredAnchor, largerOffsetX, largerOffsetY)
  ]);
  const usable = candidates.flatMap((anchor) => {
    const bounds = labelBounds(anchor, dimensions.width, dimensions.height);
    const footprint = boundsPolygon(bounds);
    if (
      !polygonContainsPolygon(toWorldPolygon(roomPolygon), footprint) ||
      furnitureFootprints.some((candidate) =>
        convexPolygonsOverlap(footprint, toWorldPolygon(candidate))
      ) ||
      architecturalFootprints.some((candidate) =>
        convexPolygonsOverlap(footprint, toWorldPolygon(candidate))
      ) ||
      occupiedLabelBounds.some((candidate) =>
        convexPolygonsOverlap(footprint, boundsPolygon(candidate))
      )
    )
      return [];
    const stairOverlap = stairFootprints.some((candidate) =>
      convexPolygonsOverlap(footprint, toWorldPolygon(candidate))
    );
    return [{ anchor, bounds, stairOverlap }];
  });
  const chosen =
    usable.find((candidate) => !candidate.stairOverlap) ?? usable[0];
  if (chosen)
    return {
      anchor: Object.freeze(chosen.anchor),
      bounds: Object.freeze(chosen.bounds),
      fallback: false
    };
  return {
    anchor: Object.freeze(preferredAnchor),
    bounds: Object.freeze(
      labelBounds(preferredAnchor, dimensions.width, dimensions.height)
    ),
    fallback: true
  };
}

function candidateRing(
  anchor: ScreenPoint,
  offsetX: number,
  offsetY: number
): readonly ScreenPoint[] {
  return [
    { x: anchor.x, y: anchor.y - offsetY },
    { x: anchor.x, y: anchor.y + offsetY },
    { x: anchor.x + offsetX, y: anchor.y },
    { x: anchor.x - offsetX, y: anchor.y },
    { x: anchor.x + offsetX, y: anchor.y - offsetY },
    { x: anchor.x - offsetX, y: anchor.y - offsetY },
    { x: anchor.x + offsetX, y: anchor.y + offsetY },
    { x: anchor.x - offsetX, y: anchor.y + offsetY }
  ];
}

function uniqueCandidates(
  candidates: readonly ScreenPoint[]
): readonly ScreenPoint[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.x}:${candidate.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function estimateLabelDimensions(
  roomName: string,
  formattedArea: string,
  elevationLabel?: string
): { readonly width: number; readonly height: number } {
  return {
    width:
      Math.max(
        roomName.length * 6.2,
        formattedArea.length * 5.4,
        (elevationLabel?.length ?? 0) * 5.1
      ) + 8,
    height: elevationLabel ? 39 : 27
  };
}

function labelBounds(
  anchor: ScreenPoint,
  width: number,
  height: number
): RoomLabelBounds2D {
  return {
    left: anchor.x - width / 2,
    top: anchor.y - 15,
    right: anchor.x + width / 2,
    bottom: anchor.y - 15 + height
  };
}

function boundsPolygon(bounds: RoomLabelBounds2D): readonly Point2D[] {
  return [
    { x: bounds.left, z: bounds.top },
    { x: bounds.right, z: bounds.top },
    { x: bounds.right, z: bounds.bottom },
    { x: bounds.left, z: bounds.bottom }
  ];
}

function toWorldPolygon(points: readonly ScreenPoint[]): readonly Point2D[] {
  return points.map((point) => ({ x: point.x, z: point.y }));
}

function boundsOf(points: readonly ScreenPoint[]): {
  readonly width: number;
  readonly height: number;
} {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}
