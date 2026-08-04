import type { Project } from "@casastudio/schema";

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
}
