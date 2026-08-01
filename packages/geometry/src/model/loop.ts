import type { BoundaryEdge } from "./boundary-edge";
import type { BoundaryEdgeUse } from "./boundary-edge-use";
import type { GeometryId } from "./index";
import type { Polygon } from "./polygon";
import type { Vertex } from "./vertex";

/**
 * Role of a loop inside a polygon.
 */
export type LoopKind = "OUTER" | "INNER";

/**
 * Represents one closed, ordered boundary traversal.
 *
 * A loop owns ordered `BoundaryEdgeUse` objects rather than physical
 * `BoundaryEdge` objects directly. The order mirrors canonical `Room.boundary`
 * order for room-derived outer loops.
 */
export class Loop {
  readonly edgeUses: readonly BoundaryEdgeUse[];

  private readonly getOwningPolygon: () => Polygon;

  /**
   * Creates an immutable loop.
   *
   * `edgeUses` is defensively copied so the public traversal order cannot be
   * mutated by callers after construction.
   */
  constructor(
    readonly id: GeometryId,
    readonly kind: LoopKind,
    edgeUses: readonly BoundaryEdgeUse[],
    getOwningPolygon: () => Polygon
  ) {
    this.edgeUses = Object.freeze([...edgeUses]);
    this.getOwningPolygon = getOwningPolygon;
    Object.freeze(this);
  }

  /**
   * Polygon that owns this loop.
   */
  get polygon(): Polygon {
    return this.getOwningPolygon();
  }

  /**
   * Physical boundary edges in loop order.
   *
   * This convenience view intentionally discards traversal direction; consumers
   * that need ordered coordinates should use `edgeUses`.
   */
  get boundaryEdges(): readonly BoundaryEdge[] {
    return Object.freeze(this.edgeUses.map((edgeUse) => edgeUse.boundaryEdge));
  }

  /**
   * Traversal-relative vertices in loop order.
   */
  get vertices(): readonly Vertex[] {
    return Object.freeze(this.edgeUses.map((edgeUse) => edgeUse.startVertex));
  }
}
