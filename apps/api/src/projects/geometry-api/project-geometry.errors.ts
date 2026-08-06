import { HttpStatus } from "@nestjs/common";

import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import { ApiProblemError } from "../../common/problem-details/problem-details-exception";

/**
 * Raised when a persisted Project cannot produce valid Geometry Engine output.
 *
 * The read request did not submit the invalid source state, so the response is
 * a sanitized server-responsibility failure. Geometry diagnostics remain in
 * the internal cause chain for logs and tests.
 */
export class ProjectGeometryInvalidError extends ApiProblemError {
  constructor(projectId: string, cause: unknown) {
    super({
      type: "/problems/project-geometry-invalid",
      title: "Project geometry invalid",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: `Project "${projectId}" could not produce valid geometry.`,
      code: ApiErrorCode.ProjectGeometryInvalid,
      cause
    });
    this.name = "ProjectGeometryInvalidError";
  }
}

/**
 * Raised when Geometry Engine execution throws unexpectedly.
 *
 * Internal exception details stay attached as the cause and are logged by the
 * shared Problem Details filter without being copied into the HTTP response.
 */
export class ProjectGeometryBuildFailedError extends ApiProblemError {
  constructor(projectId: string, cause: unknown) {
    super({
      type: "/problems/project-geometry-build-failed",
      title: "Project geometry build failed",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: `Geometry for project "${projectId}" could not be built.`,
      code: ApiErrorCode.ProjectGeometryBuildFailed,
      cause
    });
    this.name = "ProjectGeometryBuildFailedError";
  }
}

/**
 * Raised when the runtime GeometryModel cannot be safely serialized as a DTO.
 *
 * This protects the public API from non-finite numbers, cyclic runtime graphs,
 * private implementation fields, and other snapshot invariant failures.
 */
export class ProjectGeometrySerializationFailedError extends ApiProblemError {
  constructor(projectId: string, cause: unknown) {
    super({
      type: "/problems/project-geometry-serialization-failed",
      title: "Project geometry serialization failed",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: `Geometry for project "${projectId}" could not be serialized safely.`,
      code: ApiErrorCode.ProjectGeometrySerializationFailed,
      cause
    });
    this.name = "ProjectGeometrySerializationFailedError";
  }
}
