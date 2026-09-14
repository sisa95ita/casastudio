import type { Point2D, StairFlight } from "@casastudio/schema";

import type { GeometryId } from "./index.js";

/** Derived renderer-neutral geometry for one architectural stair flight. */
export class StairFlightGeometry {
  readonly startPosition: Readonly<Point2D>;
  readonly endPosition: Readonly<Point2D>;
  readonly length: number;
  readonly rise: number;

  /** Creates immutable stair-flight geometry in Project length units. */
  constructor(
    readonly id: GeometryId,
    readonly sourceFlightId: StairFlight["id"],
    startPosition: Point2D,
    endPosition: Point2D,
    readonly width: StairFlight["width"],
    readonly stepCount: StairFlight["stepCount"],
    readonly startElevation: StairFlight["startElevation"],
    readonly endElevation: StairFlight["endElevation"]
  ) {
    this.startPosition = Object.freeze({ ...startPosition });
    this.endPosition = Object.freeze({ ...endPosition });
    this.length = Math.hypot(
      endPosition.x - startPosition.x,
      endPosition.z - startPosition.z
    );
    this.rise = endElevation - startElevation;
    Object.freeze(this);
  }
}
