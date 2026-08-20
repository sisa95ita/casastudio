import { readFileSync } from "node:fs";

import { ProjectSchema, type Project } from "@casastudio/schema";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../persistence/prisma.service";
import {
  ProjectAggregateMapper,
  validateProjectForPersistence
} from "./project-aggregate.mapper";
import {
  createDemoProject,
  DEMO_PROJECT_ID,
  DEMO_PROJECT_NAME,
  DEMO_PROJECT_OWNER_SUBJECT,
  seedDemoProject
} from "./demo-project-seed";
import { projectPersistenceInclude } from "./project-persistence-aggregate";
import {
  PersistedProjectInvalidError,
  ProjectReconstructionError
} from "./project-persistence-error";
import { ProjectPersistenceWriter } from "./project-persistence-writer";
import { PrismaProjectRepository } from "./prisma-project.repository";

const canonicalProjectUrl = new URL(
  "../../../../../packages/schema/examples/project.json",
  import.meta.url
);
const canonicalProject = ProjectSchema.parse(
  JSON.parse(readFileSync(canonicalProjectUrl, "utf8"))
);
const demoProject = createDemoProject(canonicalProject);
const testOwnerSubject = "8d62f7e2-0c2a-4f2a-a9cf-7f62c2f4e8f7";
const testProjectId = "phase-1b-round-trip-project";

describe("ProjectAggregateMapper", () => {
  it("rejects structurally invalid Project candidates", () => {
    expect(() =>
      validateProjectForPersistence({
        ...canonicalProject,
        schemaVersion: "9.9.9"
      })
    ).toThrow(PersistedProjectInvalidError);
  });

  it("applies the neutral development identity to the persisted demo Project", () => {
    expect(demoProject).toMatchObject({
      id: DEMO_PROJECT_ID,
      name: DEMO_PROJECT_NAME
    });
    expect(JSON.stringify(demoProject)).not.toContain(
      "casa-studio-canonical-project"
    );
    expect(JSON.stringify(demoProject)).not.toContain(
      "CasaStudio Canonical Project"
    );
  });
});

const describeWithDatabase = process.env.DATABASE_URL
  ? describe
  : describe.skip;

describeWithDatabase("relational Project persistence", () => {
  let prisma: PrismaClient;
  let writer: ProjectPersistenceWriter;
  let repository: PrismaProjectRepository;

  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL
      })
    });
    writer = new ProjectPersistenceWriter();
    repository = new PrismaProjectRepository(
      prisma as unknown as PrismaService
    );
  });

  beforeEach(async () => {
    await prisma.project.deleteMany({
      where: {
        domainId: testProjectId
      }
    });
  });

  afterAll(async () => {
    await prisma.project.deleteMany({
      where: {
        domainId: testProjectId
      }
    });
    await prisma.$disconnect();
  });

  it("returns null for a missing project domain ID", async () => {
    await expect(
      repository.findByDomainId("missing-project")
    ).resolves.toBeNull();
  });

  it("persists and reloads the canonical Project without leaking technical IDs", async () => {
    const project = createTestProject();

    await writeProject(project);

    const loadedProject = await repository.findByDomainId(project.id);

    expect(loadedProject).toEqual(project);
    expect(JSON.stringify(loadedProject)).not.toContain('"projectId"');
    expect(JSON.stringify(loadedProject)).not.toContain('"ownerSubject"');
    expect(loadedProject?.revision).toBe(1);
    expect(loadedProject?.building.levels[0]?.rooms[1]?.boundary[0]).toEqual({
      wallId: "living-kitchen-partition",
      direction: "REVERSE"
    });
  });

  it("stores owner metadata with the stable Keycloak subject", async () => {
    const project = createTestProject();

    await writeProject(project);

    const row = await prisma.project.findUniqueOrThrow({
      where: {
        domainId: project.id
      },
      select: {
        ownerSubject: true,
        createdBySubject: true,
        updatedBySubject: true
      }
    });

    expect(row).toEqual({
      ownerSubject: testOwnerSubject,
      createdBySubject: testOwnerSubject,
      updatedBySubject: testOwnerSubject
    });
  });

  it("loads validated Projects with internal authorization metadata", async () => {
    const project = createTestProject();

    await writeProject(project);

    const loadedProject = await repository.findLoadedByDomainId(project.id);

    expect(loadedProject?.project).toEqual(project);
    expect(loadedProject?.metadata).toMatchObject({
      ownerSubject: testOwnerSubject,
      createdBySubject: testOwnerSubject,
      updatedBySubject: testOwnerSubject
    });
    expect(loadedProject?.metadata.createdAt).toBeInstanceOf(Date);
    expect(loadedProject?.metadata.updatedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(loadedProject?.project)).not.toContain(
      "ownerSubject"
    );
  });

  it("lists lightweight owner-scoped summaries in deterministic update order", async () => {
    const project = createTestProject();
    await repository.createProject(project, testOwnerSubject);

    const ownerSummaries =
      await repository.listProjectSummaries(testOwnerSubject);
    const otherSummaries =
      await repository.listProjectSummaries("other-subject");

    expect(ownerSummaries).toContainEqual({
      id: project.id,
      name: project.name,
      revision: project.revision,
      updatedAt: project.updatedAt,
      ownerSubject: testOwnerSubject
    });
    expect(otherSummaries).not.toContainEqual(
      expect.objectContaining({ id: project.id })
    );
    expect(JSON.stringify(ownerSummaries)).not.toContain("building");
  });

  it("creates a complete normalized aggregate through the runtime repository", async () => {
    const project = createTestProject();
    const loaded = await repository.createProject(project, testOwnerSubject);
    const rowCounts = await countAggregateRows(project.id);

    expect(loaded.project).toEqual(project);
    expect(loaded.metadata.ownerSubject).toBe(testOwnerSubject);
    expect(rowCounts.projects).toBe(1);
    expect(rowCounts.levels).toBe(project.building.levels.length);
    expect(rowCounts.walls).toBe(
      project.building.levels.reduce(
        (count, level) => count + level.walls.length,
        0
      )
    );
    expect(rowCounts.rooms).toBe(
      project.building.levels.reduce(
        (count, level) => count + level.rooms.length,
        0
      )
    );
  });

  it("deletes every normalized aggregate row and releases normalized-name uniqueness", async () => {
    const baseProject = createTestProject();
    const renderRequest = baseProject.renderRequests[0];
    if (!renderRequest) {
      throw new Error("Canonical fixture requires a Render Request.");
    }
    const project = ProjectSchema.parse({
      ...baseProject,
      name: "Casa",
      renderResults: [
        {
          id: "deletion-test-render-result",
          renderRequestId: renderRequest.id,
          status: "SUCCEEDED",
          createdAt: "2026-08-16T12:00:00.000Z",
          assetRef: "assets/renders/deletion-test-render-result.webp"
        }
      ]
    });
    await repository.createProject(project, testOwnerSubject);
    const before = await countAggregateRows(project.id);

    expect(before).toEqual(
      expect.objectContaining({
        projects: 1,
        buildings: 1
      })
    );
    expect(before.levels).toBeGreaterThan(0);
    expect(before.rooms).toBeGreaterThan(0);
    expect(before.walls).toBeGreaterThan(0);
    expect(before.roomBoundaryEdges).toBeGreaterThan(0);
    expect(before.wallRoomReferences).toBeGreaterThan(0);
    expect(before.openings).toBeGreaterThan(0);
    expect(before.openingConnectedRoomReferences).toBeGreaterThan(0);
    expect(before.staircases).toBeGreaterThan(0);
    expect(before.stairFlights).toBeGreaterThan(0);
    expect(before.stairLandings).toBeGreaterThan(0);
    expect(before.viewpoints).toBeGreaterThan(0);
    expect(before.baseImages).toBeGreaterThan(0);
    expect(before.designBriefs).toBeGreaterThan(0);
    expect(before.designBriefConstraints).toBeGreaterThan(0);
    expect(before.designBriefPaletteEntries).toBeGreaterThan(0);
    expect(before.designBriefReferenceAssets).toBeGreaterThan(0);
    expect(before.renderRequests).toBeGreaterThan(0);
    expect(before.renderResults).toBeGreaterThan(0);

    await expect(
      repository.deleteProject({
        projectId: project.id,
        requiredOwnerSubject: "another-owner"
      })
    ).resolves.toEqual({ status: "forbidden" });
    expect(await countAggregateRows(project.id)).toEqual(before);

    await expect(
      repository.deleteProject({
        projectId: project.id,
        requiredOwnerSubject: testOwnerSubject
      })
    ).resolves.toEqual({ status: "deleted" });
    expect(await countAggregateRows(project.id)).toEqual(
      Object.fromEntries(Object.keys(before).map((key) => [key, 0]))
    );
    await expect(repository.findByDomainId(project.id)).resolves.toBeNull();
    await expect(
      repository.deleteProject({
        projectId: project.id,
        requiredOwnerSubject: testOwnerSubject
      })
    ).resolves.toEqual({ status: "not-found" });

    const recreated = ProjectSchema.parse({ ...project, name: "casa" });
    await expect(
      repository.createProject(recreated, testOwnerSubject)
    ).resolves.toMatchObject({ project: { name: "casa" } });
  });

  it("replaces nested normalized state while preserving root identity, ownership, and domain IDs", async () => {
    const project = createTestProject();
    await repository.createProject(project, testOwnerSubject);
    const rootBefore = await prisma.project.findUniqueOrThrow({
      where: { domainId: project.id },
      select: { id: true, ownerSubject: true, createdBySubject: true }
    });
    const proposed = withWriterWall(project, "writer-a-wall");

    const result = await repository.replaceProject({
      projectId: project.id,
      baseRevision: project.revision,
      project: proposed,
      actorSubject: "updater-subject",
      requiredOwnerSubject: testOwnerSubject
    });

    expect(result.status).toBe("updated");
    if (result.status !== "updated") return;

    const rootAfter = await prisma.project.findUniqueOrThrow({
      where: { domainId: project.id },
      select: {
        id: true,
        ownerSubject: true,
        createdBySubject: true,
        updatedBySubject: true,
        revision: true
      }
    });
    const persistedWall = await prisma.wall.findFirstOrThrow({
      where: { project: { domainId: project.id }, domainId: "writer-a-wall" }
    });

    expect(result.loadedProject.project.revision).toBe(project.revision + 1);
    expect(
      result.loadedProject.project.building.levels[0]?.walls.at(-1)?.id
    ).toBe("writer-a-wall");
    expect(rootAfter).toMatchObject({
      id: rootBefore.id,
      ownerSubject: rootBefore.ownerSubject,
      createdBySubject: rootBefore.createdBySubject,
      updatedBySubject: "updater-subject",
      revision: project.revision + 1
    });
    expect(persistedWall.domainId).toBe("writer-a-wall");
  });

  it("allows exactly one concurrent writer for a shared base revision", async () => {
    const project = createTestProject();
    await repository.createProject(project, testOwnerSubject);

    const [first, second] = await Promise.all([
      repository.replaceProject({
        projectId: project.id,
        baseRevision: project.revision,
        project: withWriterWall(project, "writer-a-wall"),
        actorSubject: "writer-a",
        requiredOwnerSubject: testOwnerSubject
      }),
      repository.replaceProject({
        projectId: project.id,
        baseRevision: project.revision,
        project: withWriterWall(project, "writer-b-wall"),
        actorSubject: "writer-b",
        requiredOwnerSubject: testOwnerSubject
      })
    ]);
    const outcomes = [first, second];
    const successful = outcomes.find((outcome) => outcome.status === "updated");
    const conflicted = outcomes.find(
      (outcome) => outcome.status === "revision-conflict"
    );
    const finalProject = await repository.findByDomainId(project.id);

    expect(
      outcomes.filter((outcome) => outcome.status === "updated")
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === "revision-conflict")
    ).toHaveLength(1);
    expect(conflicted).toMatchObject({
      status: "revision-conflict",
      currentRevision: project.revision + 1
    });
    expect(finalProject?.revision).toBe(project.revision + 1);
    if (successful?.status === "updated") {
      expect(finalProject).toEqual(successful.loadedProject.project);
    }
  });

  it("rolls back root and subordinate replacement when the transaction fails", async () => {
    const project = createTestProject();
    await repository.createProject(project, testOwnerSubject);
    const root = await prisma.project.findUniqueOrThrow({
      where: { domainId: project.id },
      select: { id: true }
    });
    const beforeCounts = await countAggregateRows(project.id);
    const proposed = {
      ...withWriterWall(project, "rollback-wall"),
      revision: project.revision + 1,
      updatedAt: "2026-08-13T11:30:00.000Z"
    };

    await expect(
      prisma.$transaction(async (tx) => {
        await writer.replaceProjectStateInTransaction(
          tx,
          root.id,
          proposed,
          "rollback-writer"
        );
        throw new Error("induced transaction failure");
      })
    ).rejects.toThrow("induced transaction failure");

    expect(await repository.findByDomainId(project.id)).toEqual(project);
    expect(await countAggregateRows(project.id)).toEqual(beforeCounts);
    await expect(
      prisma.wall.findFirst({
        where: { project: { domainId: project.id }, domainId: "rollback-wall" }
      })
    ).resolves.toBeNull();
  });

  it("rejects duplicate room-boundary positions at the database constraint", async () => {
    const project = createTestProject();

    await writeProject(project);

    const room = await prisma.room.findFirstOrThrow({
      where: {
        project: {
          domainId: project.id
        },
        domainId: "living-room"
      }
    });
    const wall = await prisma.wall.findFirstOrThrow({
      where: {
        project: {
          domainId: project.id
        },
        domainId: "ground-north-wall"
      }
    });

    await expect(
      prisma.roomBoundaryEdge.create({
        data: {
          projectId: room.projectId,
          roomId: room.id,
          wallId: wall.id,
          position: 0,
          direction: "FORWARD"
        }
      })
    ).rejects.toThrow();
  });

  it("rejects duplicate wall use within one room boundary at the database constraint", async () => {
    const project = createTestProject();

    await writeProject(project);

    const room = await prisma.room.findFirstOrThrow({
      where: {
        project: {
          domainId: project.id
        },
        domainId: "living-room"
      }
    });
    const wall = await prisma.wall.findFirstOrThrow({
      where: {
        project: {
          domainId: project.id
        },
        domainId: "ground-north-wall"
      }
    });

    await expect(
      prisma.roomBoundaryEdge.create({
        data: {
          projectId: room.projectId,
          roomId: room.id,
          wallId: wall.id,
          position: 99,
          direction: "REVERSE"
        }
      })
    ).rejects.toThrow();
  });

  it("rejects persisted ordering gaps during reconstruction", async () => {
    const project = createTestProject();

    await writeProject(project);
    const edge = await prisma.roomBoundaryEdge.findFirstOrThrow({
      where: {
        project: {
          domainId: project.id
        },
        room: {
          domainId: "living-room"
        },
        position: 1
      }
    });

    await prisma.roomBoundaryEdge.update({
      where: {
        id: edge.id
      },
      data: {
        position: 99
      }
    });

    await expect(repository.findByDomainId(project.id)).rejects.toThrow(
      ProjectReconstructionError
    );
  });

  it("rejects semantically inconsistent persisted references", async () => {
    const project = createTestProject();

    await writeProject(project);
    await prisma.wallRoomReference.deleteMany({
      where: {
        wall: {
          project: {
            domainId: project.id
          },
          domainId: "ground-north-wall"
        }
      }
    });

    await expect(repository.findByDomainId(project.id)).rejects.toThrow(
      PersistedProjectInvalidError
    );
  });

  it("seeds the neutral demo Project repeatably without duplicates", async () => {
    const firstResult = await seedDemoProject(prisma, demoProject);
    const secondResult = await seedDemoProject(prisma, demoProject);

    const projectCount = await prisma.project.count({
      where: {
        domainId: DEMO_PROJECT_ID
      }
    });
    const loadedProject = await repository.findByDomainId(DEMO_PROJECT_ID);

    expect(firstResult).toEqual({
      projectId: DEMO_PROJECT_ID,
      revision: demoProject.revision,
      ownerSubject: DEMO_PROJECT_OWNER_SUBJECT
    });
    expect(secondResult).toEqual(firstResult);
    expect(projectCount).toBe(1);
    expect(loadedProject).toEqual(demoProject);
    expect(loadedProject?.name).toBe(DEMO_PROJECT_NAME);
  });

  it("maps a loaded persistence aggregate to the exact canonical Project", async () => {
    const project = createTestProject();

    await writeProject(project);

    const aggregate = await prisma.project.findUniqueOrThrow({
      where: {
        domainId: project.id
      },
      include: projectPersistenceInclude
    });
    const mappedProject = new ProjectAggregateMapper().toProject(aggregate);

    expect(mappedProject).toEqual(project);
  });

  async function writeProject(project: Project): Promise<void> {
    await prisma.$transaction((tx) =>
      writer.replaceProjectInTransaction(tx, project, {
        ownerSubject: testOwnerSubject,
        createdBySubject: testOwnerSubject,
        updatedBySubject: testOwnerSubject
      })
    );
  }

  async function countAggregateRows(projectId: string) {
    const where = { project: { domainId: projectId } };
    const [
      projects,
      buildings,
      levels,
      rooms,
      walls,
      wallRoomReferences,
      roomBoundaryEdges,
      openings,
      openingConnectedRoomReferences,
      staircases,
      stairFlights,
      stairLandings,
      viewpoints,
      baseImages,
      designBriefs,
      designBriefConstraints,
      designBriefPaletteEntries,
      designBriefReferenceAssets,
      renderRequests,
      renderResults
    ] = await Promise.all([
      prisma.project.count({ where: { domainId: projectId } }),
      prisma.building.count({ where }),
      prisma.level.count({ where }),
      prisma.room.count({ where }),
      prisma.wall.count({ where }),
      prisma.wallRoomReference.count({ where }),
      prisma.roomBoundaryEdge.count({ where }),
      prisma.opening.count({ where }),
      prisma.openingConnectedRoomReference.count({ where }),
      prisma.staircase.count({ where }),
      prisma.stairFlight.count({ where }),
      prisma.stairLanding.count({ where }),
      prisma.viewpoint.count({ where }),
      prisma.baseImage.count({ where }),
      prisma.designBrief.count({ where }),
      prisma.designBriefConstraint.count({ where }),
      prisma.designBriefPaletteEntry.count({ where }),
      prisma.designBriefReferenceAsset.count({ where }),
      prisma.renderRequest.count({ where }),
      prisma.renderResult.count({ where })
    ]);

    return {
      projects,
      buildings,
      levels,
      rooms,
      walls,
      wallRoomReferences,
      roomBoundaryEdges,
      openings,
      openingConnectedRoomReferences,
      staircases,
      stairFlights,
      stairLandings,
      viewpoints,
      baseImages,
      designBriefs,
      designBriefConstraints,
      designBriefPaletteEntries,
      designBriefReferenceAssets,
      renderRequests,
      renderResults
    };
  }
});

function createTestProject(): Project {
  return ProjectSchema.parse({
    ...canonicalProject,
    id: testProjectId
  });
}

function withWriterWall(project: Project, wallId: string): Project {
  const candidate = structuredClone(project);
  const level = candidate.building.levels[0];

  if (!level) {
    throw new Error("Canonical fixture requires a Level.");
  }

  level.walls.push({
    id: wallId,
    start: { x: 2_000, z: wallId === "writer-b-wall" ? 200 : 0 },
    end: { x: 2_100, z: wallId === "writer-b-wall" ? 200 : 0 },
    height: 280,
    thickness: 20,
    roomIds: [],
    openings: []
  });

  return ProjectSchema.parse(candidate);
}
