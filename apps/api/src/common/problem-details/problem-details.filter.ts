import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException
} from "@nestjs/common";
import type { Request, Response } from "express";

import { getRequestId, type RequestWithId } from "../request/request-id";
import { ApiErrorCode } from "./api-error-code";
import type { ProblemDetailsDto, ProblemDetailItemDto } from "./problem-details.dto";

type HttpExceptionBody = {
  readonly error?: unknown;
  readonly message?: unknown;
  readonly statusCode?: unknown;
};

/**
 * Converts every thrown error into CasaStudio's stable Problem Details shape.
 *
 * Known HTTP exceptions keep their status while framework validation payloads
 * are normalized into `errors`; unexpected exceptions are logged internally and
 * returned as sanitized 500 responses.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const requestId = getRequestId(request);
    const problemDetails = this.toProblemDetails(exception, request, requestId);

    if (!this.isExpectedHttpException(exception)) {
      this.logger.error({ err: exception, requestId, path: request.url }, "Unhandled API exception");
    }

    response.status(problemDetails.status).json(problemDetails);
  }

  private toProblemDetails(
    exception: unknown,
    request: Request,
    requestId: string | undefined
  ): ProblemDetailsDto {
    if (this.isProblemDetailsException(exception)) {
      const responseBody = exception.getResponse() as ProblemDetailsDto;

      return {
        ...responseBody,
        instance: responseBody.instance ?? request.originalUrl,
        requestId: responseBody.requestId ?? requestId
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse();
      const body = typeof responseBody === "object" && responseBody !== null ? responseBody : {};
      const httpBody = body as HttpExceptionBody;
      const errors = this.extractErrors(httpBody.message);

      return {
        type: this.typeForStatus(status),
        title: this.titleForStatus(status, httpBody.error),
        status,
        detail: this.detailForHttpException(exception, httpBody.message),
        instance: request.originalUrl,
        code: this.codeForStatus(status),
        requestId,
        errors
      };
    }

    return {
      type: "/problems/internal-server-error",
      title: "Internal server error",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: "An unexpected error occurred.",
      instance: request.originalUrl,
      code: ApiErrorCode.InternalServerError,
      requestId
    };
  }

  private isProblemDetailsException(exception: unknown): exception is HttpException {
    if (!(exception instanceof HttpException)) {
      return false;
    }

    const responseBody = exception.getResponse();

    return (
      typeof responseBody === "object" &&
      responseBody !== null &&
      "code" in responseBody &&
      "type" in responseBody
    );
  }

  private isExpectedHttpException(exception: unknown): boolean {
    return exception instanceof HttpException && exception.getStatus() < HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private detailForHttpException(exception: HttpException, message: unknown): string {
    if (Array.isArray(message)) {
      return "Request validation failed.";
    }

    if (typeof message === "string" && message.length > 0) {
      return message;
    }

    return exception.message;
  }

  private extractErrors(message: unknown): readonly ProblemDetailItemDto[] | undefined {
    if (!Array.isArray(message)) {
      return undefined;
    }

    return message.map((item) => ({
      path: "",
      message: typeof item === "string" ? item : "Invalid value"
    }));
  }

  private codeForStatus(status: number): ApiErrorCode {
    if (status === HttpStatus.UNAUTHORIZED) {
      return ApiErrorCode.Unauthorized;
    }

    if (status === HttpStatus.FORBIDDEN) {
      return ApiErrorCode.Forbidden;
    }

    if (status === HttpStatus.SERVICE_UNAVAILABLE) {
      return ApiErrorCode.DependencyUnavailable;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return ApiErrorCode.InternalServerError;
    }

    return ApiErrorCode.InvalidRequest;
  }

  private titleForStatus(status: number, error: unknown): string {
    if (typeof error === "string" && error.length > 0) {
      return error;
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return "Unauthorized";
    }

    if (status === HttpStatus.FORBIDDEN) {
      return "Forbidden";
    }

    if (status === HttpStatus.NOT_FOUND) {
      return "Not found";
    }

    if (status === HttpStatus.SERVICE_UNAVAILABLE) {
      return "Dependency unavailable";
    }

    return "Invalid request";
  }

  private typeForStatus(status: number): string {
    const code = this.codeForStatus(status).toLowerCase().replaceAll("_", "-");

    return `/problems/${code}`;
  }
}

/**
 * Exposes concrete auth exceptions to tests without coupling them to Passport.
 */
export const problemDetailsAuthExceptions = {
  forbidden: ForbiddenException,
  unauthorized: UnauthorizedException
};
