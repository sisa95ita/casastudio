/** Reads and validates the declared CasaStudio version from a package manifest. */
export function readDeclaredVersion(packagePath?: string): string;

/** Validates a repository-declared release or snapshot version. */
export function validateDeclaredVersion(version: unknown): string;

/** Validates an immutable CasaStudio build version and its Docker-tag safety. */
export function validateBuildVersion(version: unknown): string;

/** Resolves an explicit build override before falling back to the declared version. */
export function resolveBuildVersion(options?: {
  readonly declaredVersion?: string;
  readonly override?: string;
}): string;

/** Requires the declared version to identify an active snapshot release line. */
export function requireSnapshotVersion(version?: string): string;

/** Formats a UTC build instant as the sortable yyyyMMdd.HHmmss timestamp. */
export function formatBuildTimestamp(instant?: Date): string;

/** Derives one immutable timestamped build version from a declared snapshot. */
export function deriveSnapshotBuildVersion(
  declaredVersion: string,
  timestamp?: string
): string;

/** Creates the web and API image references for one resolved product build. */
export function createDockerImageReferences(version: string): Readonly<{
  web: string;
  api: string;
}>;
