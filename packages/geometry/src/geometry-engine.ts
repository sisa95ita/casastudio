import type { Project } from "@casastudio/schema";

import type { GeometryBuildResult } from "./geometry-build-result.js";
import { GeometryModelBuilder } from "./internal/index.js";

/**
 * Stateless facade for deriving renderer-neutral runtime geometry.
 *
 * `build` expects an already canonical typed `Project` using the latest schema
 * representation, including ordered and oriented `Room.boundary` entries. It
 * does not parse, migrate legacy data, call schema validators, mutate the
 * source Project, or produce renderer-specific meshes, triangulation,
 * extrusion, or Three.js data.
 *
 * Valid canonical input returns a deterministic immutable `GeometryModel`.
 * Expected build-time problems return an `ok: false` result with geometry-build
 * diagnostics instead of throwing.
 */
export class GeometryEngine {
  private constructor() {}

  /**
   * Builds an immutable runtime `GeometryModel` from a canonical Project.
   */
  static build(project: Project): GeometryBuildResult {
    return new GeometryModelBuilder(project).build();
  }
}
