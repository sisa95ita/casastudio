/**
 * Nest injection token for the internal ProjectsRepository contract.
 *
 * Feature modules depend on this token instead of concrete Prisma classes so
 * later application services can load Projects without coupling to ORM payloads
 * or database client lifecycles.
 */
export const PROJECTS_REPOSITORY = Symbol("PROJECTS_REPOSITORY");
