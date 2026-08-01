import type { Wall } from "@casastudio/schema";

import type { GeometryId } from "./index";
import type { Vertex } from "./vertex";

/**
 * Represents one shared physical wall boundary in runtime topology.
 *
 * A `BoundaryEdge` derives from one persisted `Wall` and preserves that wall's
 * canonical `start -> end` orientation. Room traversal direction is modeled by
 * `BoundaryEdgeUse`, not by duplicating or reversing this physical edge.
 */
export class BoundaryEdge {
  /**
   * Creates an immutable boundary edge from a source wall and two runtime
   * endpoint vertices.
   */
  constructor(
    readonly id: GeometryId,
    readonly sourceWallId: Wall["id"],
    readonly startVertex: Vertex,
    readonly endVertex: Vertex,
    readonly thickness: Wall["thickness"],
    readonly height: Wall["height"]
  ) {
    Object.freeze(this);
  }
}
