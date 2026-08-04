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
 * Replaces and verifies the canonical demo Project in PostgreSQL.
 *
 * The operation validates the fixture, performs a full-aggregate replacement in
 * one Prisma transaction, reloads through the repository mapping include, and
 * compares the reconstructed Project to the input fixture.
 */
export async function seedCanonicalDemoProject(
  prisma: PrismaClient,
  project: Project,
  metadata: NewProjectMetadata = {
    ownerSubject: DEMO_PROJECT_OWNER_SUBJECT,
    createdBySubject: DEMO_PROJECT_OWNER_SUBJECT,
    updatedBySubject: DEMO_PROJECT_OWNER_SUBJECT
  }
): Promise<DemoProjectSeedResult> {
  const canonicalProject = validateSeedProject(project);
  const writer = new ProjectPersistenceWriter();

  await prisma.$transaction((tx) => writer.replaceProjectInTransaction(tx, canonicalProject, metadata));

  const aggregate = await prisma.project.findUnique({
    where: {
      domainId: canonicalProject.id
    },
    include: projectPersistenceInclude
  });

  if (!aggregate) {
    throw new ProjectPersistenceError(`Seeded project "${canonicalProject.id}" could not be reloaded.`);
  }

  const roundTrippedProject = new ProjectAggregateMapper().toProject(aggregate);

  if (JSON.stringify(roundTrippedProject) !== JSON.stringify(canonicalProject)) {
    throw new ProjectPersistenceError(`Seeded project "${canonicalProject.id}" failed round-trip comparison.`);
  }

  return {
    projectId: roundTrippedProject.id,
    revision: roundTrippedProject.revision,
    ownerSubject: metadata.ownerSubject
  };
}

function validateSeedProject(project: Project): Project {
  const canonicalProject = validateProjectForPersistence(project);
  const renderability = validateProjectRenderability(canonicalProject);

  if (!renderability.valid) {
    throw new PersistedProjectInvalidError(
      "Canonical demo project failed renderability validation.",
      renderability.errors as readonly ValidationError[]
    );
  }

  return canonicalProject;
}
