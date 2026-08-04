import { HttpException, HttpStatus } from "@nestjs/common";

import { ApiErrorCode } from "./api-error-code";
import type { ProblemDetailsDto, ProblemDetailItemDto } from "./problem-details.dto";

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
