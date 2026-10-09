import "reflect-metadata";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Test } from "@nestjs/testing";
import {
  ValidationPipe,
  VersioningType,
  type INestApplication
} from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { KeycloakRole } from "../../auth/keycloak-role";
import { ProblemDetailsFilter } from "../../common/problem-details/problem-details.filter";
import { AuthorizedProjectLoader } from "../../projects/application/authorized-project-loader.service";
import { ProjectReadAuthorizationPolicy } from "../../projects/application/project-read-authorization.policy";
import { PROJECTS_REPOSITORY } from "../../projects/persistence/projects-repository.token";
import { DESIGN_ARTIFACT_STORE } from "../artifacts/design-artifact.store";
import { FilesystemDesignArtifactStore } from "../artifacts/filesystem-design-artifact.store";
import { DESIGN_PROPOSALS_REPOSITORY } from "../persistence/design-proposal.repository";
import { INTERIOR_DESIGN_PROVIDER } from "../interior-design-provider.token";
import { DesignProposalHistoryService } from "../application/design-proposal-history.service";
import { PersistDesignProposalService } from "../application/persist-design-proposal.service";
import { RefineDesignProposalService } from "../application/refine-design-proposal.service";
import { GenerateDesignProposalService } from "../application/generate-design-proposal.service";
import {
  fixtureArtifact,
  fixtureProject,
  fixtureProvider,
  input,
  memoryProposals
} from "../test/design-fixture";
import { DesignProposalsController } from "./design-proposals.controller";

describe("authenticated design history API (fake provider and principal)", () => {
  let app: INestApplication;
  let root: string;
  let id: string;
  const provider = fixtureProvider();
  const memory = memoryProposals();
  const project = fixtureProject();
  const path = `/api/v1/projects/${project.id}/design-proposals`;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "casastudio-b4-http-test-"));
    const module = await Test.createTestingModule({
      controllers: [DesignProposalsController],
      providers: [
        AuthorizedProjectLoader,
        ProjectReadAuthorizationPolicy,
        GenerateDesignProposalService,
        RefineDesignProposalService,
        PersistDesignProposalService,
        DesignProposalHistoryService,
        {
          provide: PROJECTS_REPOSITORY,
          useValue: {
            findLoadedByDomainId: async (id: string) =>
              id === project.id
                ? { project, metadata: { ownerSubject: "owner" } }
                : null
          }
        },
        { provide: DESIGN_PROPOSALS_REPOSITORY, useValue: memory.repository },
        {
          provide: DESIGN_ARTIFACT_STORE,
          useValue: new FilesystemDesignArtifactStore(root, 1024)
        },
        { provide: INTERIOR_DESIGN_PROVIDER, useValue: provider }
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
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });
  afterAll(async () => {
    if (app) await app.close();
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("POST returns a durable proposal; GET returns bounded metadata and authenticated binary bytes with private cache headers", async () => {
    const generated = await request(app.getHttpServer())
      .post(path)
      .set("x-test-principal", "owner")
      .send(input)
      .expect(201);
    id = generated.body.id;
    expect(generated.body.artifact.uri).toBe(`${path}/${id}/artifact`);
    expect(generated.body.projectRevision).toBe(project.revision);
    const list = await request(app.getHttpServer())
      .get(path)
      .query({ levelId: "ground", roomId: "living" })
      .set("x-test-principal", "owner")
      .expect(200);
    expect(list.body.proposals).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain("base64");
    const image = await request(app.getHttpServer())
      .get(`${path}/${id}/artifact`)
      .set("x-test-principal", "owner")
      .expect(200);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.headers["cache-control"]).toBe("private, no-store");
    expect(image.headers["x-content-type-options"]).toBe("nosniff");
    expect(image.body.toString("base64")).toBe(
      fixtureArtifact.uri.split(",")[1]
    );
    expect(provider.generateDesign).toHaveBeenCalledTimes(1);
  });

  it("denies unauthenticated and cross-user history/artifact/delete, without exposing proposal existence", async () => {
    for (const endpoint of [
      path + "?levelId=ground&roomId=living",
      `${path}/${id}/artifact`,
      `${path}/missing/artifact`
    ]) {
      await request(app.getHttpServer()).get(endpoint).expect(403);
      await request(app.getHttpServer())
        .get(endpoint)
        .set("x-test-principal", "other")
        .expect(403);
    }
    await request(app.getHttpServer())
      .delete(`${path}/${id}`)
      .set("x-test-principal", "other")
      .expect(403);
    await request(app.getHttpServer())
      .delete(`${path}/missing`)
      .set("x-test-principal", "other")
      .expect(403);
    expect(memory.records.size).toBe(1);
    expect(provider.generateDesign).toHaveBeenCalledTimes(1);
  });

  it("DELETE revokes metadata/image access without touching the Project or invoking generation", async () => {
    const before = structuredClone(project);
    await request(app.getHttpServer())
      .delete(`${path}/${id}`)
      .set("x-test-principal", "owner")
      .expect(204);
    await request(app.getHttpServer())
      .get(`${path}/${id}/artifact`)
      .set("x-test-principal", "owner")
      .expect(404);
    expect(memory.records.size).toBe(0);
    expect(project).toEqual(before);
    expect(provider.generateDesign).toHaveBeenCalledTimes(1);
  });
});
