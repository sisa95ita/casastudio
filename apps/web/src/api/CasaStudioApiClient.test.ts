import { afterEach, describe, expect, it, vi } from "vitest";

import { geometryPlaygroundProject } from "../geometry-playground/geometry-playground-fixture";
import { readApiConfiguration } from "./api-configuration";
import {
  ApiAuthenticationUnavailableError,
  ApiRequestError,
  CasaStudioApiClient
} from "./CasaStudioApiClient";

const projectResponse = {
  project: geometryPlaygroundProject,
  sourceRevision: geometryPlaygroundProject.revision
};

const geometryResponse = {
  sourceProjectId: geometryPlaygroundProject.id,
  sourceRevision: geometryPlaygroundProject.revision,
  geometry: {
    id: "geometry-demo",
    units: { length: "cm", angle: "deg" },
    levels: [
      {
        id: "geometry-level-ground",
        sourceLevelId: "level-ground",
        elevation: 0,
        vertices: [],
        boundaryEdges: [],
        boundaryEdgeUses: [],
        loops: [],
        polygons: []
      }
    ]
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function createClient(
  fetchImplementation: typeof fetch,
  token: string | null = "access-token"
) {
  return new CasaStudioApiClient({
    baseUrl: "http://localhost:3000/",
    getAccessToken: vi.fn().mockResolvedValue(token),
    fetchImplementation
  });
}

describe("API configuration", () => {
  it("validates and normalizes the public API base URL", () => {
    expect(
      readApiConfiguration({
        VITE_API_BASE_URL: "http://localhost:3000/"
      } as unknown as ImportMetaEnv)
    ).toEqual({ baseUrl: "http://localhost:3000" });
    expect(() => readApiConfiguration({} as ImportMetaEnv)).toThrow(
      "VITE_API_BASE_URL"
    );
  });
});

describe("CasaStudioApiClient", () => {
  it("lists Projects and creates one with the minimal request DTO", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          projects: [
            {
              id: geometryPlaygroundProject.id,
              name: geometryPlaygroundProject.name,
              revision: geometryPlaygroundProject.revision,
              updatedAt: geometryPlaygroundProject.updatedAt,
              ownedByCurrentUser: true
            }
          ]
        })
      )
      .mockResolvedValueOnce(Response.json(projectResponse));
    const client = createClient(fetchImplementation);

    await expect(client.listProjects()).resolves.toMatchObject({
      projects: [{ id: geometryPlaygroundProject.id }]
    });
    await expect(client.createProject({ name: "Casa" })).resolves.toEqual(
      projectResponse
    );
    expect(fetchImplementation).toHaveBeenLastCalledWith(
      "http://localhost:3000/api/v1/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Casa" })
      })
    );
  });

  it("deletes the exact Project with the authenticated no-content contract", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const client = createClient(fetchImplementation);

    await expect(client.deleteProject("project/casa")).resolves.toBeUndefined();
    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/projects/project%2Fcasa",
      expect.objectContaining({
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer access-token"
        }
      })
    );
  });

  it("rejects a successful deletion response that is not 204", async () => {
    const client = createClient(
      vi.fn().mockResolvedValue(Response.json({}, { status: 200 }))
    );

    await expect(client.deleteProject("project-one")).rejects.toMatchObject({
      kind: "invalid-response",
      status: 200
    });
  });

  it("invokes the default browser fetch with the global receiver", async () => {
    const fetchSpy = vi
      .fn(function (this: unknown) {
        if (this !== globalThis) {
          throw new TypeError("Illegal invocation");
        }

        return Promise.resolve(Response.json(projectResponse));
      })
      .mockName("receiver-sensitive-fetch") as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchSpy);
    const client = new CasaStudioApiClient({
      baseUrl: "http://localhost:3000",
      getAccessToken: vi.fn().mockResolvedValue("access-token")
    });

    await expect(
      client.getProject(geometryPlaygroundProject.id)
    ).resolves.toEqual(projectResponse);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("injects the bearer token and explicit JSON headers", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(Response.json(projectResponse));
    const client = createClient(fetchImplementation);

    await client.getProject(geometryPlaygroundProject.id);

    expect(fetchImplementation).toHaveBeenCalledWith(
      `http://localhost:3000/api/v1/projects/${geometryPlaygroundProject.id}`,
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer access-token"
        }
      })
    );
  });

  it("fails before HTTP when an access token is unavailable", async () => {
    const fetchImplementation = vi.fn();
    const client = createClient(fetchImplementation, null);

    await expect(client.getProject("project-one")).rejects.toBeInstanceOf(
      ApiAuthenticationUnavailableError
    );
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("classifies rejected token acquisition as authentication unavailable before HTTP", async () => {
    const fetchImplementation = vi.fn();
    const client = new CasaStudioApiClient({
      baseUrl: "http://localhost:3000",
      getAccessToken: vi.fn().mockRejectedValue(new Error("refresh failed")),
      fetchImplementation
    });

    await expect(client.getProject("project-one")).rejects.toBeInstanceOf(
      ApiAuthenticationUnavailableError
    );
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("validates and returns the authoritative Project envelope", async () => {
    const client = createClient(
      vi.fn().mockResolvedValue(Response.json(projectResponse))
    );

    await expect(
      client.getProject(geometryPlaygroundProject.id)
    ).resolves.toEqual(projectResponse);
  });

  it("replaces a complete Project with baseRevision and validates the next revision", async () => {
    const savedProject = {
      ...geometryPlaygroundProject,
      revision: geometryPlaygroundProject.revision + 1,
      updatedAt: "2026-08-15T12:00:00.000Z"
    };
    const fetchImplementation = vi.fn().mockResolvedValue(
      Response.json({
        project: savedProject,
        sourceRevision: savedProject.revision
      })
    );
    const client = createClient(fetchImplementation);

    await expect(
      client.replaceProject(geometryPlaygroundProject.id, {
        baseRevision: geometryPlaygroundProject.revision,
        project: geometryPlaygroundProject
      })
    ).resolves.toEqual({
      project: savedProject,
      sourceRevision: savedProject.revision
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      `http://localhost:3000/api/v1/projects/${geometryPlaygroundProject.id}`,
      expect.objectContaining({
        method: "PUT",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer access-token",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          baseRevision: geometryPlaygroundProject.revision,
          project: geometryPlaygroundProject
        })
      })
    );
  });

  it("maps the explicit Geometry snapshot envelope", async () => {
    const client = createClient(
      vi.fn().mockResolvedValue(Response.json(geometryResponse))
    );

    await expect(
      client.getProjectGeometry(geometryPlaygroundProject.id)
    ).resolves.toEqual(geometryResponse);
  });

  it("rejects malformed nested Geometry snapshot entities", async () => {
    const invalidGeometryResponse = {
      ...geometryResponse,
      geometry: {
        ...geometryResponse.geometry,
        levels: [
          {
            ...geometryResponse.geometry.levels[0],
            vertices: [{ id: "vertex-without-coordinates" }]
          }
        ]
      }
    };
    const client = createClient(
      vi.fn().mockResolvedValue(Response.json(invalidGeometryResponse))
    );

    await expect(
      client.getProjectGeometry(geometryPlaygroundProject.id)
    ).rejects.toMatchObject({
      kind: "invalid-response"
    });
  });

  it("parses RFC 9457 Problem Details and preserves HTTP status", async () => {
    const problem = {
      type: "/problems/project-access-forbidden",
      title: "Project access forbidden",
      status: 403,
      detail: "The authenticated principal cannot access this Project.",
      code: "PROJECT_ACCESS_FORBIDDEN",
      requestId: "request-1"
    };
    const client = createClient(
      vi.fn().mockResolvedValue(Response.json(problem, { status: 403 }))
    );

    await expect(client.getProject("project-one")).rejects.toMatchObject({
      kind: "problem",
      status: 403,
      problem
    });
  });

  it("creates a safe error for non-Problem HTTP failures", async () => {
    const client = createClient(
      vi
        .fn()
        .mockResolvedValue(new Response("gateway failure", { status: 502 }))
    );

    await expect(client.getProject("project-one")).rejects.toMatchObject({
      kind: "http",
      status: 502,
      message: "The API request failed with HTTP 502."
    });
  });

  it("distinguishes network failures without exposing request credentials", async () => {
    const client = createClient(
      vi.fn().mockRejectedValue(new TypeError("connection refused"))
    );

    const error = await client
      .getProject("project-one")
      .catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ kind: "network", status: undefined });
    expect(String(error)).not.toContain("access-token");
  });

  it("rejects a successful response that violates the Project contract", async () => {
    const client = createClient(
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ project: { id: "broken" }, sourceRevision: 1 })
        )
    );

    await expect(client.getProject("project-one")).rejects.toMatchObject({
      kind: "invalid-response"
    });
  });
});
