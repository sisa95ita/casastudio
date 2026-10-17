import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { VersioningType, type INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { KeycloakRole } from "../../auth/keycloak-role";
import { ProblemDetailsFilter } from "../../common/problem-details/problem-details.filter";
import { AuthorizedProjectLoader } from "../../projects/application/authorized-project-loader.service";
import { ProjectReadAuthorizationPolicy } from "../../projects/application/project-read-authorization.policy";
import { PROJECTS_REPOSITORY } from "../../projects/persistence/projects-repository.token";
import { ProposeFurnitureEditService } from "../application/propose-furniture-edit.service";
import { FURNITURE_EDIT_PROVIDER } from "../furniture-edit-provider.token";
import { furnitureEditFixture } from "../test/furniture-edit-fixture";
import { FurnitureEditsController } from "./furniture-edits.controller";
import { furnitureInterpretationFailure } from "../openai/openai-error";

describe("authorized ephemeral Furniture edit API, mocked provider", () => {
  let app: INestApplication;
  const project = furnitureEditFixture();
  const before = JSON.stringify(project);
  const provider = {
    name: "fixture",
    interpretFurnitureEdit: vi.fn<() => Promise<unknown>>()
  };
  const input = {
    instructions: "Rotate this Furniture by 90 degrees",
    baseRevision: 1,
    levelId: "ground",
    selectedFurnitureIds: ["item-a"]
  };
  const proposal = {
    kind: "EDIT_PROPOSAL",
    operations: [
      { type: "ROTATE_FURNITURE", furnitureId: "item-a", targetRotation: 120 }
    ]
  };
  const path = "/api/v1/projects/command-project/furniture-edit-proposals";
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FurnitureEditsController],
      providers: [
        ProposeFurnitureEditService,
        AuthorizedProjectLoader,
        ProjectReadAuthorizationPolicy,
        { provide: FURNITURE_EDIT_PROVIDER, useValue: provider },
        {
          provide: PROJECTS_REPOSITORY,
          useValue: {
            findLoadedByDomainId: async (id: string) =>
              id === project.id
                ? { project, metadata: { ownerSubject: "owner" } }
                : null
          }
        }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string>;
              user?: unknown;
            };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          const subject = req.headers["x-test-principal"];
          if (!subject) return false;
          req.user = { subject, roles: [KeycloakRole.User] };
          return true;
        }
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });
  beforeEach(() => {
    provider.interpretFurnitureEdit.mockReset().mockResolvedValue(proposal);
  });
  afterAll(async () => {
    await app.close();
  });

  it("returns typed revision-associated operations and leaves persisted state untouched", async () => {
    const result = await request(app.getHttpServer())
      .post(path)
      .set("x-test-principal", "owner")
      .send(input)
      .expect(201);
    expect(result.body).toEqual({
      projectId: project.id,
      projectRevision: 1,
      result: proposal
    });
    expect(JSON.stringify(project)).toBe(before);
    expect(provider.interpretFurnitureEdit).toHaveBeenCalledTimes(1);
    expect(provider.interpretFurnitureEdit.mock.calls[0]).toMatchObject([
      { context: { selectedFurniture: [{ id: "item-a" }] } }
    ]);
  });
  it("denies unauthorized and foreign Projects before invoking the provider", async () => {
    await request(app.getHttpServer()).post(path).send(input).expect(403);
    await request(app.getHttpServer())
      .post(path)
      .set("x-test-principal", "other")
      .send(input)
      .expect(403);
    await request(app.getHttpServer())
      .post(path.replace("command-project", "missing-project"))
      .set("x-test-principal", "owner")
      .send(input)
      .expect(404);
    expect(provider.interpretFurnitureEdit).not.toHaveBeenCalled();
  });
  it("rejects stale revision, invented context and client geometry before any provider cost", async () => {
    for (const body of [
      { ...input, baseRevision: 2 },
      { ...input, selectedFurnitureIds: ["foreign-item"] },
      { ...input, roomId: "foreign-room" },
      { ...input, geometry: project }
    ]) {
      const response = await request(app.getHttpServer())
        .post(path)
        .set("x-test-principal", "owner")
        .send(body);
      expect([400, 409, 422]).toContain(response.status);
    }
    expect(provider.interpretFurnitureEdit).not.toHaveBeenCalled();
  });
  it.each([
    {
      type: "ROTATE_FURNITURE",
      furnitureId: "other-project-item",
      targetRotation: 90
    },
    {
      type: "TRANSFER_FURNITURE",
      furnitureId: "item-a",
      targetRoomId: "other-project-room",
      targetPosition: { x: 1200, z: 200 }
    },
    {
      type: "ADD_FURNITURE",
      definitionId: "provider-invented",
      roomId: "room-a",
      position: { x: 400, z: 400 },
      rotation: 0
    }
  ])(
    "rejects provider IDs that bypass canonical authority: %j",
    async (operation) => {
      provider.interpretFurnitureEdit.mockResolvedValue({
        kind: "EDIT_PROPOSAL",
        operations: [operation]
      });
      await request(app.getHttpServer())
        .post(path)
        .set("x-test-principal", "owner")
        .send(input)
        .expect(502);
      expect(JSON.stringify(project)).toBe(before);
    }
  );
  it.each(["CLARIFICATION_REQUIRED", "UNSUPPORTED_REQUEST"])(
    "returns %s without canonical mutation",
    async (kind) => {
      provider.interpretFurnitureEdit.mockResolvedValue({
        kind,
        message:
          "Select a destination; architecture is outside Furniture editing."
      });
      const response = await request(app.getHttpServer())
        .post(path)
        .set("x-test-principal", "owner")
        .send(input)
        .expect(201);
      expect(response.body.result.kind).toBe(kind);
      expect(JSON.stringify(project)).toBe(before);
    }
  );
  it("returns a normal technical error on provider failure without retry or mutation", async () => {
    provider.interpretFurnitureEdit.mockRejectedValue(
      new Error("fixture failure")
    );
    await request(app.getHttpServer())
      .post(path)
      .set("x-test-principal", "owner")
      .send(input)
      .expect(502);
    expect(provider.interpretFurnitureEdit).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(project)).toBe(before);
  });

  it.each([
    [400, 502, "AI_GENERATION_FAILED"],
    [500, 503, "AI_PROVIDER_UNAVAILABLE"]
  ])(
    "keeps upstream HTTP %i diagnostics server-side and exposes Furniture-specific Problem Details",
    async (upstreamStatus, status, code) => {
      provider.interpretFurnitureEdit.mockRejectedValue(
        furnitureInterpretationFailure(
          {
            name:
              upstreamStatus === 400
                ? "BadRequestError"
                : "InternalServerError",
            status: upstreamStatus,
            code:
              upstreamStatus === 400 ? "invalid_json_schema" : "server_error",
            type: "invalid_request_error",
            param: "text.format.schema",
            requestID: "req_offline_http",
            message: "'oneOf' is not permitted. PRIVATE INSTRUCTION sk-secret"
          },
          "provider_request"
        )
      );
      const response = await request(app.getHttpServer())
        .post(path)
        .set("x-test-principal", "owner")
        .send(input)
        .expect(status as number);
      expect(response.body.code).toBe(code);
      if (upstreamStatus === 400)
        expect(response.body).toMatchObject({
          title: "AI Furniture interpretation failed",
          detail: "The AI provider could not interpret the Furniture edit."
        });
      expect(JSON.stringify(response.body)).not.toMatch(
        /oneOf|req_offline_http|PRIVATE INSTRUCTION|sk-secret|could not generate the design/
      );
      expect(provider.interpretFurnitureEdit).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(project)).toBe(before);
    }
  );
});
