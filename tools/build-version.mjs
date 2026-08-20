import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const declaredVersionPattern = /^\d+\.\d+\.\d+(?:-SNAPSHOT)?$/;
const resolvedVersionPattern =
  /^\d+\.\d+\.\d+(?:-SNAPSHOT(?:-\d{8}\.\d{6})?)?$/;
const snapshotVersionPattern = /^\d+\.\d+\.\d+-SNAPSHOT$/;
const timestampPattern = /^\d{8}\.\d{6}$/;
const dockerTagPattern = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const rootPackagePath = fileURLToPath(new URL("../package.json", import.meta.url));

/** Reads and validates the declared CasaStudio version from a package manifest. */
export function readDeclaredVersion(packagePath = rootPackagePath) {
  let packageMetadata;

  try {
    packageMetadata = JSON.parse(readFileSync(packagePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read the CasaStudio version from ${packagePath}.`, {
      cause: error
    });
  }

  return validateDeclaredVersion(packageMetadata?.version);
}

/** Validates a repository-declared release or snapshot version. */
export function validateDeclaredVersion(version) {
  if (typeof version !== "string" || !declaredVersionPattern.test(version)) {
    throw new Error(
      `Invalid declared CasaStudio version ${JSON.stringify(version)}. Expected x.y.z or x.y.z-SNAPSHOT.`
    );
  }

  return validateDockerTag(version);
}

/** Validates an immutable CasaStudio build version and its Docker-tag safety. */
export function validateBuildVersion(version) {
  if (typeof version !== "string" || !resolvedVersionPattern.test(version)) {
    throw new Error(
      `Invalid CasaStudio build version ${JSON.stringify(version)}. Expected x.y.z, x.y.z-SNAPSHOT, or x.y.z-SNAPSHOT-yyyyMMdd.HHmmss.`
    );
  }

  return validateDockerTag(version);
}

/** Resolves an explicit build override before falling back to the declared version. */
export function resolveBuildVersion({
  declaredVersion = readDeclaredVersion(),
  override = process.env.CASASTUDIO_BUILD_VERSION
} = {}) {
  const validatedDeclaredVersion = validateDeclaredVersion(declaredVersion);
  const candidate = override?.trim();

  return candidate
    ? validateBuildVersion(candidate)
    : validateBuildVersion(validatedDeclaredVersion);
}

/** Requires the declared version to identify an active snapshot release line. */
export function requireSnapshotVersion(version = readDeclaredVersion()) {
  const validatedVersion = validateDeclaredVersion(version);

  if (!snapshotVersionPattern.test(validatedVersion)) {
    throw new Error(
      `CasaStudio PR validation requires a declared SNAPSHOT version; received ${validatedVersion}.`
    );
  }

  return validatedVersion;
}

/** Formats a UTC build instant as the sortable yyyyMMdd.HHmmss timestamp. */
export function formatBuildTimestamp(instant = new Date()) {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new Error("A valid build timestamp instant is required.");
  }

  const compactIso = instant.toISOString().replace(/[-:]/g, "");
  return `${compactIso.slice(0, 8)}.${compactIso.slice(9, 15)}`;
}

/** Derives one immutable timestamped build version from a declared snapshot. */
export function deriveSnapshotBuildVersion(
  declaredVersion,
  timestamp = formatBuildTimestamp()
) {
  const snapshotVersion = requireSnapshotVersion(declaredVersion);

  if (!timestampPattern.test(timestamp)) {
    throw new Error(
      `Invalid CasaStudio build timestamp ${JSON.stringify(timestamp)}. Expected yyyyMMdd.HHmmss.`
    );
  }

  return validateBuildVersion(`${snapshotVersion}-${timestamp}`);
}

/** Creates the web and API image references for one resolved product build. */
export function createDockerImageReferences(version) {
  const validatedVersion = validateBuildVersion(version);

  return Object.freeze({
    web: `casastudio-web:${validatedVersion}`,
    api: `casastudio-api:${validatedVersion}`
  });
}

function validateDockerTag(version) {
  if (!dockerTagPattern.test(version)) {
    throw new Error(
      `CasaStudio version ${JSON.stringify(version)} is not a valid Docker tag.`
    );
  }

  return version;
}

function runCommand(command) {
  switch (command) {
    case "declared":
      return readDeclaredVersion();
    case "resolve":
      return resolveBuildVersion();
    case "snapshot":
      return deriveSnapshotBuildVersion(readDeclaredVersion());
    case "assert-snapshot":
      return requireSnapshotVersion();
    default:
      throw new Error(
        `Unknown build-version command ${JSON.stringify(command)}. Expected declared, resolve, snapshot, or assert-snapshot.`
      );
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    process.stdout.write(`${runCommand(process.argv[2])}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`CasaStudio version error: ${message}\n`);
    process.exitCode = 1;
  }
}
