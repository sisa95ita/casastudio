import type { Point2D, Room } from "@casastudio/schema";

import type { BoundaryEdge } from "./boundary-edge";
import type { BoundaryEdgeUse } from "./boundary-edge-use";
import type { GeometryId } from "./index";
import type { Loop } from "./loop";
import type { BoundingBox, PolygonMetrics, PolygonWinding } from "./polygon-metrics";
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
   * Signed planar area in the level-local XZ plane.
   *
   * Positive values indicate counter-clockwise traversal and negative values
   * indicate clockwise traversal. The value is derived from runtime vertices
   * and is not persisted.
   */
  readonly signedArea: number;
  /**
   * Absolute planar area in square project length units.
   *
   * The current schema uses centimeters, so this value is square centimeters
   * for canonical MVP projects.
   */
  readonly area: number;
  /**
   * Winding derived from the runtime outer-loop traversal order.
   *
   * The Geometry Engine does not normalize winding; this reports the order
   * represented by the source room boundary.
   */
  readonly winding: PolygonWinding;
  /**
   * Immutable XZ bounds derived from the polygon's traversal vertices.
   */
  readonly bounds: BoundingBox;
  /**
   * Immutable centroid for a non-degenerate simple polygon.
   *
   * Degenerate polygons are rejected by the builder, so successful runtime
   * polygons always expose a real centroid.
   */
  readonly centroid: Readonly<Point2D>;

  /**
   * Creates an immutable polygon associated with a source Room.
   */
  constructor(
    readonly id: GeometryId,
    readonly sourceRoomId: Room["id"],
    readonly outerLoop: Loop,
    innerLoops: readonly Loop[],
    metrics: PolygonMetrics & { readonly centroid: Point2D }
  ) {
    this.innerLoops = Object.freeze([...innerLoops]);
    this.signedArea = metrics.signedArea;
    this.area = metrics.area;
    this.winding = metrics.winding;
    this.bounds = Object.freeze({ ...metrics.bounds });
    this.centroid = Object.freeze({ ...metrics.centroid });
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
