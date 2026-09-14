import type { Point2D, StairLanding } from "@casastudio/schema";

import type { GeometryId } from "./index.js";

/** Derived renderer-neutral geometry for one architectural stair landing. */
export class StairLandingGeometry {
  readonly position: Readonly<Point2D>;

  /** Creates immutable stair-landing geometry in Project length units. */
  constructor(
    readonly id: GeometryId,
    readonly sourceLandingId: StairLanding["id"],
    position: Point2D,
    readonly width: StairLanding["width"],
    readonly depth: StairLanding["depth"],
    readonly elevation: StairLanding["elevation"]
  ) {
    this.position = Object.freeze({ ...position });
    Object.freeze(this);
  }
}
