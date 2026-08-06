import type { RoomBoundaryDirection } from "@casastudio/schema";

import type { BoundaryEdge } from "./boundary-edge.js";
import type { GeometryId } from "./index.js";
import type { Loop } from "./loop.js";
import type { Vertex } from "./vertex.js";

/**
 * Direction in which a loop traverses a physical boundary edge.
 */
export type BoundaryEdgeUseDirection = RoomBoundaryDirection;

/**
 * Represents one loop-relative traversal of a shared `BoundaryEdge`.
 *
 * `FORWARD` traverses the referenced edge from its canonical start vertex to
 * end vertex. `REVERSE` traverses the same physical edge from end vertex to
 * start vertex. This keeps shared-wall identity separate from room-boundary
 * traversal direction.
 */
export class BoundaryEdgeUse {
  readonly startVertex: Vertex;
  readonly endVertex: Vertex;

  private readonly getContainingLoop: () => Loop;

  /**
   * Creates an immutable edge use.
   *
   * The containing loop is supplied lazily by the internal builder to avoid
   * circular-construction leaks while still exposing bidirectional topology
   * after finalization.
   */
  constructor(
    readonly id: GeometryId,
    readonly boundaryEdge: BoundaryEdge,
    readonly direction: BoundaryEdgeUseDirection,
    readonly index: number,
    getContainingLoop: () => Loop
  ) {
    this.getContainingLoop = getContainingLoop;
    this.startVertex = direction === "FORWARD" ? boundaryEdge.startVertex : boundaryEdge.endVertex;
    this.endVertex = direction === "FORWARD" ? boundaryEdge.endVertex : boundaryEdge.startVertex;
    Object.freeze(this);
  }

  /**
   * Loop that owns this ordered traversal use.
   */
  get loop(): Loop {
    return this.getContainingLoop();
  }
}
