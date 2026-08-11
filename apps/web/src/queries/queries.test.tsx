import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiProvider } from "../api/ApiProvider";
import {
  ApiAuthenticationUnavailableError,
  ApiRequestError,
  CasaStudioApiClient
} from "../api/CasaStudioApiClient";
import { AuthProvider } from "../auth/AuthProvider";
import type { AuthClient } from "../auth/auth-client";
import {
  geometryKeys,
  projectGeometryQueryOptions,
  useProjectGeometryQuery
} from "./geometry-queries";
import { projectKeys, projectQueryOptions, useProjectQuery } from "./project-queries";
import { createAppQueryClient, shouldRetryQuery } from "./query-client";

const api = {} as CasaStudioApiClient;

afterEach(() => {
  vi.clearAllMocks();
});

describe("server-state query contracts", () => {
  it("builds stable route-driven Project keys", () => {
    expect(projectKeys.detail("project-one")).toEqual(["projects", "detail", "project-one"]);
    expect(projectQueryOptions(api, "project-two").queryKey).toEqual([
      "projects",
      "detail",
      "project-two"
    ]);
  });

  it("builds stable route-driven Geometry keys", () => {
    expect(geometryKeys.detail("project-one")).toEqual([
      "project-geometry",
      "detail",
      "project-one"
    ]);
    expect(projectGeometryQueryOptions(api, "project-two").queryKey).toEqual([
      "project-geometry",
      "detail",
      "project-two"
    ]);
  });

  it("does not retry authentication, deterministic Problem Details, or validation failures", () => {
    expect(shouldRetryQuery(0, new ApiAuthenticationUnavailableError())).toBe(false);
    expect(
      shouldRetryQuery(
        0,
        new ApiRequestError("problem", "Forbidden", 403, {
          type: "/problems/forbidden",
          title: "Forbidden",
          status: 403,
          detail: "Forbidden",
          code: "FORBIDDEN"
        })
      )
    ).toBe(false);
    expect(shouldRetryQuery(0, new ApiRequestError("invalid-response", "Invalid"))).toBe(false);
  });

  it("limits retries to transient network and server failures", () => {
    expect(shouldRetryQuery(0, new ApiRequestError("network", "Offline"))).toBe(true);
    expect(shouldRetryQuery(0, new ApiRequestError("http", "Server", 503))).toBe(true);
    expect(shouldRetryQuery(1, new ApiRequestError("network", "Offline"))).toBe(false);
  });

  it("keeps Project and Geometry queries disabled until a route project ID exists", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(Response.json({}));
    const wrapper = createQueryWrapper(fetchImplementation);

    renderHook(() => useProjectQuery(""), { wrapper });
    renderHook(() => useProjectGeometryQuery(""), { wrapper });

    await waitFor(() => expect(fetchImplementation).not.toHaveBeenCalled());
  });

  it("enables Project and Geometry queries when a route project ID exists", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(Response.json({}));
    const wrapper = createQueryWrapper(fetchImplementation);

    renderHook(() => useProjectQuery("project-one"), { wrapper });
    renderHook(() => useProjectGeometryQuery("project-one"), { wrapper });

    await waitFor(() => expect(fetchImplementation).toHaveBeenCalledTimes(2));
  });
});

function createQueryWrapper(fetchImplementation: typeof fetch) {
  const authClient: AuthClient = {
    initialize: vi.fn().mockResolvedValue({ authenticated: true }),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn().mockResolvedValue("access-token")
  };
  const apiClient = new CasaStudioApiClient({
    baseUrl: "http://localhost:3000",
    getAccessToken: authClient.getAccessToken,
    fetchImplementation
  });
  const queryClient = createAppQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });

  return function QueryWrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={authClient}>
          <ApiProvider client={apiClient}>{children}</ApiProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  };
}
