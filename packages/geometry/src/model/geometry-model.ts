import type { Project } from "@casastudio/schema";

import type { GeometryId } from "./index.js";
import type { LevelGeometry } from "./level-geometry.js";

/**
 * Root aggregate of derived runtime geometry for one Project revision.
 *
 * The model retains source project identity and revision for traceability, and
 * owns immutable level geometry. Runtime topology is derived from source
 * schema objects but does not expose those persisted objects as the topology
 * itself.
 */
export class GeometryModel {
  readonly levels: readonly LevelGeometry[];

  /**
   * Creates an immutable geometry model.
   */
  constructor(
    readonly id: GeometryId,
    readonly sourceProjectId: Project["id"],
    readonly sourceRevision: Project["revision"],
    levels: readonly LevelGeometry[]
  ) {
    this.levels = Object.freeze([...levels]);
    Object.freeze(this);
  }
}
