import type { Level, Staircase } from "@casastudio/schema";

import type { GeometryId } from "./index.js";
import type { StairFlightGeometry } from "./stair-flight-geometry.js";
import type { StairLandingGeometry } from "./stair-landing-geometry.js";

/** Derived runtime geometry for one architectural staircase. */
export class StairGeometry {
  readonly flights: readonly StairFlightGeometry[];
  readonly landings: readonly StairLandingGeometry[];

  /** Creates one immutable root-owned staircase geometry object. */
  constructor(
    readonly id: GeometryId,
    readonly sourceStaircaseId: Staircase["id"],
    readonly owningLevelId: Level["id"],
    readonly fromLevelId: Staircase["fromLevelId"],
    readonly toLevelId: Staircase["toLevelId"],
    readonly fromRoomId: Staircase["fromRoomId"],
    readonly toRoomId: Staircase["toRoomId"],
    readonly width: Staircase["width"],
    flights: readonly StairFlightGeometry[],
    landings: readonly StairLandingGeometry[]
  ) {
    this.flights = Object.freeze([...flights]);
    this.landings = Object.freeze([...landings]);
    Object.freeze(this);
  }

  /** Connected Level identities in canonical from/to order. */
  get connectedLevelIds(): readonly string[] {
    return Object.freeze([this.fromLevelId, this.toLevelId]);
  }
}
