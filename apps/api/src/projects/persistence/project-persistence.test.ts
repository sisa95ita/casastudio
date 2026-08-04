import { readFileSync } from "node:fs";

import { ProjectSchema, type Project } from "@casastudio/schema";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../persistence/prisma.service";
import { ProjectAggregateMapper, validateProjectForPersistence } from "./project-aggregate.mapper";
import { DEMO_PROJECT_OWNER_SUBJECT, seedCanonicalDemoProject } from "./demo-project-seed";
import { projectPersistenceInclude } from "./project-persistence-aggregate";
import { PersistedProjectInvalidError, ProjectReconstructionError } from "./project-persistence-error";
import { ProjectPersistenceWriter } from "./project-persistence-writer";
import { PrismaProjectRepository } from "./prisma-project.repository";

const canonicalProjectUrl = new URL("../../../../../packages/schema/examples/project.json", import.meta.url);
const canonicalProject = ProjectSchema.parse(JSON.parse(readFileSync(canonicalProjectUrl, "utf8")));
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
});

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

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
    repository = new PrismaProjectRepository(prisma as unknown as PrismaService);
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
    await expect(repository.findByDomainId("missing-project")).resolves.toBeNull();
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

    await expect(repository.findByDomainId(project.id)).rejects.toThrow(ProjectReconstructionError);
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

    await expect(repository.findByDomainId(project.id)).rejects.toThrow(PersistedProjectInvalidError);
  });

  it("seeds the canonical demo project repeatably without duplicates", async () => {
    const firstResult = await seedCanonicalDemoProject(prisma, canonicalProject);
    const secondResult = await seedCanonicalDemoProject(prisma, canonicalProject);

    const projectCount = await prisma.project.count({
      where: {
        domainId: canonicalProject.id
      }
    });
    const loadedProject = await repository.findByDomainId(canonicalProject.id);

    expect(firstResult).toEqual({
      projectId: canonicalProject.id,
      revision: canonicalProject.revision,
      ownerSubject: DEMO_PROJECT_OWNER_SUBJECT
    });
    expect(secondResult).toEqual(firstResult);
    expect(projectCount).toBe(1);
    expect(loadedProject).toEqual(canonicalProject);
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
});

function createTestProject(): Project {
  return ProjectSchema.parse({
    ...canonicalProject,
    id: testProjectId
  });
}
