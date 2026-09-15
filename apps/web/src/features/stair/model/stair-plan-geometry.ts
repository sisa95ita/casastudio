import type { Point2D, StairFlight, StairLanding, Staircase } from "@casastudio/schema";

const CONNECTION_EPSILON = 1e-7;

/** Plan-space local frame and exact Flight interfaces for one canonical Landing. */
export type StairLandingPlanGeometry = Readonly<{
  landing: StairLanding;
  center: Point2D;
  forward: Point2D;
  lateral: Point2D;
  width: number;
  depth: number;
  entry: Point2D;
  exit: Point2D;
  topology: "TURN" | "RETURN";
}>;

/** Canonical Stair topology with Flight spans normalized to Landing boundaries. */
export type StairPlanGeometry = Readonly<{
  flights: readonly StairFlight[];
  landings: readonly StairLandingPlanGeometry[];
}>;

/**
 * Derives Landing frames from ordered adjacent Flights. `StairLanding.position`
 * is the footprint center for current data. Legacy authoring anchors are
 * recognized from their adjacent endpoints so persisted Stairs need no migration.
 */
export function deriveStairPlanGeometry(staircase: Staircase): StairPlanGeometry {
  const flights = staircase.flights.map((flight) => ({
    ...flight,
    start: { ...flight.start },
    end: { ...flight.end }
  }));
  const landings = staircase.landings.flatMap((landing, index) => {
    const incoming = staircase.flights[index];
    const outgoing = staircase.flights[index + 1];
    if (!incoming || !outgoing) {
      const reference = incoming ?? staircase.flights.at(-1);
      const forward = reference
        ? unitDirection(reference.start, reference.end)
        : { x: 1, z: 0 };
      const lateral = { x: -forward.z, z: forward.x };
      return [Object.freeze({ landing, center: Object.freeze({ ...landing.position }),
        forward: Object.freeze(forward), lateral: Object.freeze(lateral),
        width: landing.width, depth: landing.depth,
        entry: Object.freeze(add(landing.position, scale(forward, -landing.depth / 2))),
        exit: Object.freeze(add(landing.position, scale(forward, landing.depth / 2))),
        topology: "TURN" as const })];
    }
    const forward = unitDirection(incoming.start, incoming.end);
    const outgoingForward = unitDirection(outgoing.start, outgoing.end);
    const lateral = { x: -forward.z, z: forward.x };
    const dot = forward.x * outgoingForward.x + forward.z * outgoingForward.z;
    const topology = dot < -0.7 ? "RETURN" as const : "TURN" as const;
    const laneMidpoint = midpoint(incoming.end, outgoing.start);
    const legacyCenter = topology === "RETURN"
      ? add(laneMidpoint, scale(forward, landing.depth / 2))
      : landing.position;
    const center = topology === "RETURN" && pointsEqual(landing.position, laneMidpoint)
      ? legacyCenter
      : landing.position;

    const entry = topology === "RETURN"
      ? returnInterface(center, forward, lateral, landing, incoming.end, incoming.width)
      : add(center, scale(forward, -landing.depth / 2));
    const exit = topology === "RETURN"
      ? returnInterface(center, forward, lateral, landing, outgoing.start, outgoing.width)
      : add(center, scale(outgoingForward, rectangleRadius(landing, forward, lateral, outgoingForward)));

    flights[index] = { ...flights[index]!, end: entry };
    flights[index + 1] = { ...flights[index + 1]!, start: exit };
    return [Object.freeze({ landing, center: Object.freeze(center),
      forward: Object.freeze(forward), lateral: Object.freeze(lateral),
      width: landing.width, depth: landing.depth,
      entry: Object.freeze(entry), exit: Object.freeze(exit), topology })];
  });
  return Object.freeze({
    flights: Object.freeze(flights.map((flight) => Object.freeze(flight))),
    landings: Object.freeze(landings)
  });
}

function returnInterface(
  center: Point2D,
  forward: Point2D,
  lateral: Point2D,
  landing: StairLanding,
  lanePoint: Point2D,
  flightWidth: number
): Point2D {
  const relative = subtract(lanePoint, center);
  const requestedOffset = relative.x * lateral.x + relative.z * lateral.z;
  const maximumOffset = Math.max(0, (landing.width - flightWidth) / 2);
  const laneOffset = Math.max(-maximumOffset, Math.min(maximumOffset, requestedOffset));
  return add(add(center, scale(forward, -landing.depth / 2)), scale(lateral, laneOffset));
}

function rectangleRadius(
  landing: StairLanding,
  forward: Point2D,
  lateral: Point2D,
  direction: Point2D
): number {
  const along = Math.abs(direction.x * forward.x + direction.z * forward.z);
  const across = Math.abs(direction.x * lateral.x + direction.z * lateral.z);
  const alongRadius = along > CONNECTION_EPSILON ? landing.depth / 2 / along : Infinity;
  const acrossRadius = across > CONNECTION_EPSILON ? landing.width / 2 / across : Infinity;
  return Math.min(alongRadius, acrossRadius);
}

function unitDirection(start: Point2D, end: Point2D): Point2D {
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  return { x: (end.x - start.x) / length, z: (end.z - start.z) / length };
}

function pointsEqual(first: Point2D, second: Point2D): boolean {
  return Math.hypot(first.x - second.x, first.z - second.z) <= CONNECTION_EPSILON;
}

function add(first: Point2D, second: Point2D): Point2D {
  return { x: first.x + second.x, z: first.z + second.z };
}

function subtract(first: Point2D, second: Point2D): Point2D {
  return { x: first.x - second.x, z: first.z - second.z };
}

function scale(point: Point2D, multiplier: number): Point2D {
  return { x: point.x * multiplier, z: point.z * multiplier };
}

function midpoint(first: Point2D, second: Point2D): Point2D {
  return { x: (first.x + second.x) / 2, z: (first.z + second.z) / 2 };
}
