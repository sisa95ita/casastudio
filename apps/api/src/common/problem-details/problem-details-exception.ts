import { HttpException, HttpStatus } from "@nestjs/common";

import { ApiErrorCode } from "./api-error-code";
import type { ProblemDetailsDto, ProblemDetailItemDto } from "./problem-details.dto";

/**
 * Safe application error that the global Problem Details filter can serialize.
 *
 * The error stores only client-safe status, title, detail, code, and validation
 * items. Internal causes remain attached to the Error instance for structured
 * logs and tests, but are never copied into the HTTP response body.
 */
export class ApiProblemError extends Error {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly code: ApiErrorCode;
  readonly errors?: readonly ProblemDetailItemDto[];

  constructor(input: {
    readonly type: string;
    readonly title: string;
    readonly status: number;
    readonly detail: string;
    readonly code: ApiErrorCode;
    readonly errors?: readonly ProblemDetailItemDto[];
    readonly cause?: unknown;
  }) {
    super(input.detail, { cause: input.cause });
    this.name = "ApiProblemError";
    this.type = input.type;
    this.title = input.title;
    this.status = input.status;
    this.detail = input.detail;
    this.code = input.code;
    this.errors = input.errors;
  }
}

/**
 * HTTP exception that carries an already-normalized Problem Details payload.
 *
 * Infrastructure services use this when they can safely expose dependency
 * status to callers without leaking secrets, stack traces, or provider internals.
 */
export class ProblemDetailsException extends HttpException {
  constructor(problemDetails: ProblemDetailsDto) {
    super(problemDetails, problemDetails.status);
  }
}

/**
 * Creates a dependency-unavailable problem for readiness checks.
 */
export function createDependencyUnavailableProblem(input: {
  readonly detail: string;
  readonly instance?: string;
  readonly requestId?: string;
  readonly errors?: readonly ProblemDetailItemDto[];
}): ProblemDetailsDto {
  return {
    type: "/problems/dependency-unavailable",
    title: "Dependency unavailable",
    status: HttpStatus.SERVICE_UNAVAILABLE,
    detail: input.detail,
    instance: input.instance,
    code: ApiErrorCode.DependencyUnavailable,
    requestId: input.requestId,
    errors: input.errors
  };
}
