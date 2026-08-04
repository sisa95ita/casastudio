import { randomUUID } from "node:crypto";

import type { IncomingMessage } from "node:http";
import type { Request } from "express";

const requestIdHeader = "x-request-id";

/**
 * Express request shape enriched with the correlation identifier used by API
 * logging and Problem Details responses.
 */
export type RequestWithId = Request & {
  readonly id?: string;
};

/**
 * Returns a trusted inbound request ID when present, or creates a new one.
 *
 * The value is intentionally scoped to diagnostics only; it is not an
 * authorization input and must not be treated as user identity.
 */
export function resolveRequestId(request: IncomingMessage | Request): string {
  const rawHeaderValue = request.headers[requestIdHeader];
  const headerValue = Array.isArray(rawHeaderValue) ? rawHeaderValue[0] : rawHeaderValue;

  return headerValue && headerValue.length > 0 ? headerValue : randomUUID();
}

/**
 * Reads the request correlation ID attached by HTTP logging middleware.
 */
export function getRequestId(request: RequestWithId): string | undefined {
  const rawHeaderValue = request.headers[requestIdHeader];
  const headerValue = Array.isArray(rawHeaderValue) ? rawHeaderValue[0] : rawHeaderValue;

  return request.id ?? headerValue;
}

/**
 * Publishes the correlation ID on the response for client-side diagnostics.
 */
export function setRequestIdHeader(
  response: { setHeader: (name: string, value: string) => void },
  requestId: string
): void {
  response.setHeader(requestIdHeader, requestId);
}

/**
 * Shared public name for the correlation header.
 */
export const requestCorrelationHeaderName = requestIdHeader;
