import { HttpStatus } from "@nestjs/common";

import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import { ApiProblemError } from "../../common/problem-details/problem-details-exception";
import type { ProblemDetailItemDto } from "../../common/problem-details/problem-details.dto";

/**
 * Raised when a Project route parameter does not satisfy CasaStudio identifier rules.
 *
 * The error includes safe field-level details for clients while keeping schema
 * implementation internals out of the Problem Details response.
 */
export class ProjectIdInvalidError extends ApiProblemError {
  constructor(projectId: string, errors: readonly ProblemDetailItemDto[]) {
    super({
      type: "/problems/project-id-invalid",
      title: "Invalid project ID",
      status: HttpStatus.BAD_REQUEST,
      detail: `Project ID "${projectId}" is not a valid CasaStudio identifier.`,
      code: ApiErrorCode.ProjectIdInvalid,
      errors
    });
    this.name = "ProjectIdInvalidError";
  }
}

/**
 * Raised when no current Project exists for a validated CasaStudio domain ID.
 */
export class ProjectNotFoundError extends ApiProblemError {
  constructor(projectId: string) {
    super({
      type: "/problems/project-not-found",
      title: "Project not found",
      status: HttpStatus.NOT_FOUND,
      detail: `Project "${projectId}" was not found.`,
      code: ApiErrorCode.ProjectNotFound
    });
    this.name = "ProjectNotFoundError";
  }
}

/**
 * Raised when an authenticated caller lacks Project ownership and admin override.
 *
 * The response intentionally avoids exposing owner metadata or authorization
 * internals beyond the stable forbidden code.
 */
export class ProjectAccessForbiddenError extends ApiProblemError {
  constructor(projectId: string) {
    super({
      type: "/problems/project-access-forbidden",
      title: "Project access forbidden",
      status: HttpStatus.FORBIDDEN,
      detail: `You are not allowed to access project "${projectId}".`,
      code: ApiErrorCode.ProjectAccessForbidden
    });
    this.name = "ProjectAccessForbiddenError";
  }
}

/**
 * Raised when persisted rows exist but cannot reconstruct a valid Project.
 *
 * The original persistence or validation cause remains attached for logs and
 * tests while the client receives only a stable server-responsibility failure.
 */
export class ProjectPersistedStateInvalidError extends ApiProblemError {
  constructor(projectId: string, cause: unknown) {
    super({
      type: "/problems/project-persisted-state-invalid",
      title: "Project persisted state invalid",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: `Project "${projectId}" could not be reconstructed from persisted state.`,
      code: ApiErrorCode.ProjectPersistedStateInvalid,
      cause
    });
    this.name = "ProjectPersistedStateInvalidError";
  }
}

/**
 * Raised when project persistence fails for reasons unrelated to aggregate validity.
 *
 * Database and provider details stay in the internal cause chain and are never
 * exposed in the Problem Details response.
 */
export class ProjectReadFailedError extends ApiProblemError {
  constructor(projectId: string, cause: unknown) {
    super({
      type: "/problems/project-read-failed",
      title: "Project read failed",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: `Project "${projectId}" could not be read.`,
      code: ApiErrorCode.ProjectReadFailed,
      cause
    });
    this.name = "ProjectReadFailedError";
  }
}
