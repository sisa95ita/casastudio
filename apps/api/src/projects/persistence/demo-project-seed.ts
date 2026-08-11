import {
  validateProjectRenderability,
  type Project,
  type ValidationError
} from "@casastudio/schema";
import type { PrismaClient } from "@prisma/client";

import { ProjectAggregateMapper, validateProjectForPersistence } from "./project-aggregate.mapper";
import type { NewProjectMetadata } from "./project-persistence-aggregate";
import { projectPersistenceInclude } from "./project-persistence-aggregate";
import { ProjectPersistenceError, PersistedProjectInvalidError } from "./project-persistence-error";
import { ProjectPersistenceWriter } from "./project-persistence-writer";

/**
 * Stable Keycloak subject for the imported local development demo user.
 *
 * Seed data uses this value for owner, creator, and updater metadata because
 * Keycloak emits it as the access-token `sub` claim for the demo user.
 */
export const DEMO_PROJECT_OWNER_SUBJECT = "8d62f7e2-0c2a-4f2a-a9cf-7f62c2f4e8f7";

/** Domain identity assigned to the local development Project. */
export const DEMO_PROJECT_ID = "demo-project";

/** Product-facing name assigned to the local development Project. */
export const DEMO_PROJECT_NAME = "Demo Project";

const obsoleteDemoProjectIds = ["casa-studio-canonical-project"] as const;

/**
 * Result returned by the demo seed orchestration.
 *
 * The shape reports only non-secret project identity and revision information
 * so local runs can confirm deterministic behavior without exposing tokens,
 * passwords, or database connection details.
 */
export type DemoProjectSeedResult = {
  readonly projectId: string;
  readonly revision: number;
  readonly ownerSubject: string;
};

/**
 * Replaces and verifies the local demo Project in PostgreSQL.
 *
 * The operation validates the fixture, performs a full-aggregate replacement in
 * one Prisma transaction, reloads through the repository mapping include, and
 * compares the reconstructed Project to the input fixture.
 */
export async function seedDemoProject(
  prisma: PrismaClient,
  project: Project,
  metadata: NewProjectMetadata = {
    ownerSubject: DEMO_PROJECT_OWNER_SUBJECT,
    createdBySubject: DEMO_PROJECT_OWNER_SUBJECT,
    updatedBySubject: DEMO_PROJECT_OWNER_SUBJECT
  }
): Promise<DemoProjectSeedResult> {
  const demoProject = validateSeedProject(project);
  const writer = new ProjectPersistenceWriter();

  await prisma.$transaction(async (tx) => {
    await tx.project.deleteMany({
      where: {
        domainId: { in: [...obsoleteDemoProjectIds] },
        ownerSubject: metadata.ownerSubject
      }
    });
    await writer.replaceProjectInTransaction(tx, demoProject, metadata);
  });

  const aggregate = await prisma.project.findUnique({
    where: {
      domainId: demoProject.id
    },
    include: projectPersistenceInclude
  });

  if (!aggregate) {
    throw new ProjectPersistenceError(`Seeded project "${demoProject.id}" could not be reloaded.`);
  }

  const roundTrippedProject = new ProjectAggregateMapper().toProject(aggregate);

  if (JSON.stringify(roundTrippedProject) !== JSON.stringify(demoProject)) {
    throw new ProjectPersistenceError(`Seeded project "${demoProject.id}" failed round-trip comparison.`);
  }

  return {
    projectId: roundTrippedProject.id,
    revision: roundTrippedProject.revision,
    ownerSubject: metadata.ownerSubject
  };
}

/** Applies the local development identity to a validated Project fixture. */
export function createDemoProject(project: Project): Project {
  return validateProjectForPersistence({
    ...project,
    id: DEMO_PROJECT_ID,
    name: DEMO_PROJECT_NAME
  });
}

function validateSeedProject(project: Project): Project {
  const validatedProject = validateProjectForPersistence(project);
  const renderability = validateProjectRenderability(validatedProject);

  if (!renderability.valid) {
    throw new PersistedProjectInvalidError(
      "Demo project failed renderability validation.",
      renderability.errors as readonly ValidationError[]
    );
  }

  return validatedProject;
}
