export { BoundaryEdge } from "./boundary-edge";
export { BoundaryEdgeUse, type BoundaryEdgeUseDirection } from "./boundary-edge-use";
export { GeometryModel } from "./geometry-model";
export { LevelGeometry } from "./level-geometry";
export { Loop, type LoopKind } from "./loop";
export { Polygon } from "./polygon";
export { Vertex } from "./vertex";

/**
 * Deterministic identifier assigned to one runtime geometry object.
 *
 * Runtime IDs are unique within a `GeometryModel`, stable for identical source
 * input, useful for diagnostics, and never persisted as domain identifiers.
 */
export type GeometryId = string;
