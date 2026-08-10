import {
  isApiProblem,
  parseProjectGeometryResponse,
  parseProjectResponse,
  type ApiProblem,
  type ProjectGeometryResponse,
  type ProjectResponse
} from "./api-types";

/** Function that returns a current in-memory bearer token or reports no session. */
export type AccessTokenProvider = () => Promise<string | null>;

/** Failure categories exposed by the frontend API boundary. */
export type ApiRequestFailureKind = "problem" | "http" | "network" | "invalid-response";

/** Safe typed failure raised for HTTP, network, and response-contract errors. */
export class ApiRequestError extends Error {
  constructor(
    readonly kind: ApiRequestFailureKind,
    message: string,
    readonly status?: number,
    readonly problem?: ApiProblem,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ApiRequestError";
  }
}

/** Failure raised when AuthProvider cannot supply a current access token. */
export class ApiAuthenticationUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("An authenticated session is unavailable.", options);
    this.name = "ApiAuthenticationUnavailableError";
  }
}

/** Dependencies for constructing the explicit CasaStudio HTTP client. */
export type CasaStudioApiClientOptions = {
  readonly baseUrl: string;
  readonly getAccessToken: AccessTokenProvider;
  readonly fetchImplementation?: typeof fetch;
};

/**
 * Authenticated JSON client for the read-only CasaStudio Project and Geometry APIs.
 */
export class CasaStudioApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: AccessTokenProvider;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: CasaStudioApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.getAccessToken = options.getAccessToken;
    this.fetchImplementation =
      options.fetchImplementation ?? ((input, init) => globalThis.fetch(input, init));
  }

  /** Reads and validates an authoritative Project response. */
  async getProject(projectId: string, signal?: AbortSignal): Promise<ProjectResponse> {
    const body = await this.getJson(`/api/v1/projects/${encodeURIComponent(projectId)}`, signal);

    try {
      return parseProjectResponse(body);
    } catch (error) {
      throw new ApiRequestError(
        "invalid-response",
        "The API returned an invalid Project response.",
        undefined,
        undefined,
        { cause: error }
      );
    }
  }

  /** Reads and validates the authoritative geometry snapshot for a Project. */
  async getProjectGeometry(
    projectId: string,
    signal?: AbortSignal
  ): Promise<ProjectGeometryResponse> {
    const body = await this.getJson(
      `/api/v1/projects/${encodeURIComponent(projectId)}/geometry`,
      signal
    );

    try {
      return parseProjectGeometryResponse(body);
    } catch (error) {
      throw new ApiRequestError(
        "invalid-response",
        "The API returned an invalid Geometry response.",
        undefined,
        undefined,
        { cause: error }
      );
    }
  }

  private async getJson(path: string, signal?: AbortSignal): Promise<unknown> {
    let token: string | null;

    try {
      token = await this.getAccessToken();
    } catch (error) {
      throw new ApiAuthenticationUnavailableError({ cause: error });
    }

    if (!token) {
      throw new ApiAuthenticationUnavailableError();
    }

    let response: Response;

    try {
      response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        },
        signal
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      throw new ApiRequestError(
        "network",
        "The CasaStudio API could not be reached.",
        undefined,
        undefined,
        { cause: error }
      );
    }

    if (!response.ok) {
      throw await this.createHttpError(response);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ApiRequestError(
        "invalid-response",
        "The API returned a non-JSON success response.",
        response.status,
        undefined,
        { cause: error }
      );
    }
  }

  private async createHttpError(response: Response): Promise<ApiRequestError> {
    let body: unknown;

    try {
      body = await response.json();
    } catch {
      return new ApiRequestError(
        "http",
        `The API request failed with HTTP ${response.status}.`,
        response.status
      );
    }

    if (isApiProblem(body)) {
      const problem = { ...body, status: response.status };
      return new ApiRequestError("problem", problem.detail, response.status, problem);
    }

    return new ApiRequestError(
      "http",
      `The API request failed with HTTP ${response.status}.`,
      response.status
    );
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
