import type { Room } from "@casastudio/schema";

import type { BoundaryEdge } from "./boundary-edge";
import type { BoundaryEdgeUse } from "./boundary-edge-use";
import type { GeometryId } from "./index";
import type { Loop } from "./loop";
import type { Vertex } from "./vertex";

/**
 * Represents one room-derived geometric region.
 *
 * The current MVP creates exactly one outer loop per buildable room and keeps
 * `innerLoops` as a stable empty collection. No triangulation, mesh faces, or
 * renderer-specific data belongs to this object.
 */
export class Polygon {
  readonly innerLoops: readonly Loop[];

  /**
   * Creates an immutable polygon associated with a source Room.
   */
  constructor(
    readonly id: GeometryId,
    readonly sourceRoomId: Room["id"],
    readonly outerLoop: Loop,
    innerLoops: readonly Loop[]
  ) {
    this.innerLoops = Object.freeze([...innerLoops]);
    Object.freeze(this);
  }

  /**
   * All loops owned by this polygon, with the outer loop first.
   */
  get loops(): readonly Loop[] {
    return Object.freeze([this.outerLoop, ...this.innerLoops]);
  }

  /**
   * Ordered traversal uses from all current polygon loops.
   */
  get edgeUses(): readonly BoundaryEdgeUse[] {
    return Object.freeze(this.loops.flatMap((loop) => loop.edgeUses));
  }

  /**
   * Physical boundary edges from all current polygon loops.
   */
  get boundaryEdges(): readonly BoundaryEdge[] {
    return Object.freeze(this.edgeUses.map((edgeUse) => edgeUse.boundaryEdge));
  }

  /**
   * Traversal-relative vertices from all current polygon loops.
   */
  get vertices(): readonly Vertex[] {
    return Object.freeze(this.edgeUses.map((edgeUse) => edgeUse.startVertex));
  }
}
