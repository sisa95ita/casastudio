import { HttpStatus } from "@nestjs/common";

import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import { ApiProblemError } from "../../common/problem-details/problem-details-exception";
import type { ProblemDetailItemDto } from "../../common/problem-details/problem-details.dto";

/** Raised when the route and proposed aggregate identify different Projects. */
export class ProjectAggregateIdMismatchError extends ApiProblemError {
  constructor(routeProjectId: string, bodyProjectId: string) {
    super({
      type: "/problems/project-aggregate-id-mismatch",
      title: "Project aggregate ID mismatch",
      status: HttpStatus.BAD_REQUEST,
      detail: `Route project "${routeProjectId}" does not match body project "${bodyProjectId}".`,
      code: ApiErrorCode.ProjectAggregateIdMismatch,
      errors: [{ path: "project.id", message: "Project ID must match the route Project ID." }]
    });
    this.name = "ProjectAggregateIdMismatchError";
  }
}

/** Raised when a save attempts to rewrite revision or timestamp metadata. */
export class ProjectServerFieldsInvalidError extends ApiProblemError {
  constructor(errors: readonly ProblemDetailItemDto[]) {
    super({
      type: "/problems/project-server-fields-invalid",
      title: "Project server fields invalid",
      status: HttpStatus.BAD_REQUEST,
      detail: "Project revision and timestamps must match the authoritative editing base.",
      code: ApiErrorCode.ProjectServerFieldsInvalid,
      errors
    });
    this.name = "ProjectServerFieldsInvalidError";
  }
}

/** Raised when proposed Project state cannot become authoritative. */
export class ProjectStateInvalidError extends ApiProblemError {
  constructor(errors: readonly ProblemDetailItemDto[], cause?: unknown) {
    super({
      type: "/problems/project-state-invalid",
      title: "Project state invalid",
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail: "The proposed Project cannot be accepted as authoritative state.",
      code: ApiErrorCode.ProjectStateInvalid,
      errors,
      cause
    });
    this.name = "ProjectStateInvalidError";
  }
}

/** Raised when a save is based on a revision that is no longer authoritative. */
export class ProjectRevisionConflictError extends ApiProblemError {
  constructor(projectId: string, baseRevision: number, currentRevision: number) {
    super({
      type: "/problems/project-revision-conflict",
      title: "Project revision conflict",
      status: HttpStatus.CONFLICT,
      detail: `Project "${projectId}" is at revision ${currentRevision}, not base revision ${baseRevision}.`,
      code: ApiErrorCode.ProjectRevisionConflict,
      errors: [{ path: "baseRevision", message: `Current authoritative revision is ${currentRevision}.` }]
    });
    this.name = "ProjectRevisionConflictError";
  }
}

/** Raised when Project creation or replacement fails unexpectedly. */
export class ProjectWriteFailedError extends ApiProblemError {
  constructor(projectId: string, cause: unknown) {
    super({
      type: "/problems/project-write-failed",
      title: "Project write failed",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: `Project "${projectId}" could not be persisted.`,
      code: ApiErrorCode.ProjectWriteFailed,
      cause
    });
    this.name = "ProjectWriteFailedError";
  }
}
