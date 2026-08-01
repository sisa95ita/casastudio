import type { BoundaryEdge } from "./boundary-edge";
import type { GeometryId } from "./index";

/**
 * Represents one deduplicated position in a level-local XZ plane.
 *
 * Vertices are shared by all runtime boundary edges whose persisted wall
 * endpoints have exactly equal coordinates on the same source level. Level
 * elevation is stored by `LevelGeometry`, so vertices intentionally do not
 * duplicate a Y coordinate.
 */
export class Vertex {
  private readonly getIncidentEdges: () => readonly BoundaryEdge[];

  /**
   * Creates an immutable runtime vertex.
   *
   * Incident-edge adjacency is supplied by the internal builder and exposed as
   * a defensive frozen copy so public callers cannot mutate topology.
   */
  constructor(
    readonly id: GeometryId,
    readonly x: number,
    readonly z: number,
    getIncidentEdges: () => readonly BoundaryEdge[]
  ) {
    this.getIncidentEdges = getIncidentEdges;
    Object.freeze(this);
  }

  /**
   * Boundary edges incident to this level-local position.
   */
  get incidentEdges(): readonly BoundaryEdge[] {
    return Object.freeze([...this.getIncidentEdges()]);
  }
}
