import { Injectable } from "@nestjs/common";
import { GeometryEngine, type GeometryBuildResult } from "@casastudio/geometry";
import type { Project } from "@casastudio/schema";

/**
 * Application-facing Geometry Engine boundary for Project-derived snapshots.
 *
 * The interface keeps Nest providers and tests from depending on a static
 * engine call directly. Implementations accept only canonical validated
 * Projects and return the public Geometry Engine build-result union.
 */
export interface ProjectGeometryBuilder {
  build(project: Project): GeometryBuildResult;
}

/**
 * Injection token for the focused Project geometry builder boundary.
 */
export const PROJECT_GEOMETRY_BUILDER = Symbol("PROJECT_GEOMETRY_BUILDER");

/**
 * Stateless adapter around the public `GeometryEngine.build(project)` entry point.
 *
 * The adapter has no persistence, HTTP, request, cache, background-job, or
 * mutation behavior; each call derives an in-memory runtime model from the
 * supplied canonical Project.
 */
@Injectable()
export class GeometryEngineProjectGeometryBuilder implements ProjectGeometryBuilder {
  /**
   * Builds runtime geometry through the Geometry Engine public API.
   */
  build(project: Project): GeometryBuildResult {
    return GeometryEngine.build(project);
  }
}
