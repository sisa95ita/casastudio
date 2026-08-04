import type { Project } from "@casastudio/schema";

/**
 * Internal application metadata loaded with a canonical Project for authorization.
 *
 * Subject values are Keycloak `sub` claims. Database timestamps describe the
 * current persistence row only and are kept out of public transport DTOs.
 */
export type LoadedProjectMetadata = {
  readonly ownerSubject: string;
  readonly createdBySubject: string;
  readonly updatedBySubject: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/**
 * Validated Project aggregate plus persistence metadata needed by application services.
 *
 * The canonical Project remains free of owner and database metadata while the
 * loaded wrapper gives authorization policies the data they require.
 */
export type LoadedProject = {
  readonly project: Project;
  readonly metadata: LoadedProjectMetadata;
};

/**
 * Repository boundary for loading canonical CasaStudio Projects by domain ID.
 *
 * Implementations return validated Project aggregates and never expose Prisma
 * payloads, technical database IDs, SQL errors, or HTTP exceptions to callers.
 * Missing projects resolve to `null`; invalid persisted aggregates reject with
 * internal persistence or reconstruction errors.
 */
export interface ProjectsRepository {
  findByDomainId(projectId: string): Promise<Project | null>;
  findLoadedByDomainId(projectId: string): Promise<LoadedProject | null>;
}
