import type { Level } from "@casastudio/schema";

import type { BoundaryEdge } from "./boundary-edge.js";
import type { BoundaryEdgeUse } from "./boundary-edge-use.js";
import type { GeometryId } from "./index.js";
import type { Loop } from "./loop.js";
import type { Polygon } from "./polygon.js";
import type { Vertex } from "./vertex.js";

/**
 * Groups all planar runtime topology derived for one source Level.
 *
 * Level geometry owns vertices, physical boundary edges, loop-relative edge
 * uses, loops, and room-derived polygons. Every public collection is a frozen
 * defensive copy finalized after internal mutable construction completes.
 */
export class LevelGeometry {
  readonly vertices: readonly Vertex[];
  readonly boundaryEdges: readonly BoundaryEdge[];
  readonly boundaryEdgeUses: readonly BoundaryEdgeUse[];
  readonly loops: readonly Loop[];
  readonly polygons: readonly Polygon[];

  /**
   * Creates immutable runtime geometry for one source Level.
   */
  constructor(
    readonly id: GeometryId,
    readonly sourceLevelId: Level["id"],
    readonly elevation: Level["elevation"],
    vertices: readonly Vertex[],
    boundaryEdges: readonly BoundaryEdge[],
    boundaryEdgeUses: readonly BoundaryEdgeUse[],
    loops: readonly Loop[],
    polygons: readonly Polygon[]
  ) {
    this.vertices = Object.freeze([...vertices]);
    this.boundaryEdges = Object.freeze([...boundaryEdges]);
    this.boundaryEdgeUses = Object.freeze([...boundaryEdgeUses]);
    this.loops = Object.freeze([...loops]);
    this.polygons = Object.freeze([...polygons]);
    Object.freeze(this);
  }
}
