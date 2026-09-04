import type { Wall } from "@casastudio/schema";

import type { GeometryId } from "./index.js";
import type { Vertex } from "./vertex.js";

/**
 * Represents one Wall-backed or free Room boundary segment in runtime topology.
 *
 * Wall-backed edges preserve the source Wall's canonical orientation and may be
 * shared. Free edges preserve their persisted direction and belong to one Room
 * loop. Room traversal is modeled by `BoundaryEdgeUse`.
 */
export class BoundaryEdge {
  /** Creates an immutable boundary edge from its canonical source and endpoints. */
  constructor(
    readonly id: GeometryId,
    readonly sourceWallId: Wall["id"] | undefined,
    readonly startVertex: Vertex,
    readonly endVertex: Vertex,
    readonly thickness: Wall["thickness"],
    readonly height: Wall["height"],
    /** Canonical source kind represented by this runtime boundary segment. */
    readonly sourceKind: "WALL" | "FREE" = "WALL"
  ) {
    Object.freeze(this);
  }
}
