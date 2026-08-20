import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createDockerImageReferences,
  deriveSnapshotBuildVersion,
  formatBuildTimestamp,
  readDeclaredVersion,
  requireSnapshotVersion,
  resolveBuildVersion,
  validateBuildVersion
} from "./build-version.mjs";

const declaredSnapshot = "0.1.0-SNAPSHOT";
const fixedTimestamp = "20260820.151245";
const timestampedSnapshot = `${declaredSnapshot}-${fixedTimestamp}`;

test("reads the repository snapshot version", () => {
  assert.equal(readDeclaredVersion(), declaredSnapshot);
});

test("uses the declared snapshot when no build override exists", () => {
  assert.equal(
    resolveBuildVersion({ declaredVersion: declaredSnapshot, override: undefined }),
    declaredSnapshot
  );
});

test("derives a timestamped immutable snapshot deterministically", () => {
  assert.equal(
    deriveSnapshotBuildVersion(declaredSnapshot, fixedTimestamp),
    timestampedSnapshot
  );
  assert.equal(
    formatBuildTimestamp(new Date("2026-08-20T15:12:45.999Z")),
    fixedTimestamp
  );
});

test("accepts an explicit release build override", () => {
  assert.equal(
    resolveBuildVersion({ declaredVersion: declaredSnapshot, override: "0.1.0" }),
    "0.1.0"
  );
});

test("accepts an explicit timestamped snapshot override", () => {
  assert.equal(
    resolveBuildVersion({
      declaredVersion: declaredSnapshot,
      override: timestampedSnapshot
    }),
    timestampedSnapshot
  );
});

test("rejects invalid build versions and timestamps clearly", () => {
  for (const invalidVersion of ["latest", "0.1", "0.1.0 snapshot", "0.1.0-SNAPSHOT:1"]) {
    assert.throws(
      () => validateBuildVersion(invalidVersion),
      /Invalid CasaStudio build version/
    );
  }

  assert.throws(
    () => deriveSnapshotBuildVersion(declaredSnapshot, "2026-08-20"),
    /Expected yyyyMMdd\.HHmmss/
  );
  assert.throws(
    () => requireSnapshotVersion("0.1.0"),
    /requires a declared SNAPSHOT version/
  );
});

test("uses one resolved version for both Docker image references", () => {
  assert.deepEqual(createDockerImageReferences(timestampedSnapshot), {
    web: `casastudio-web:${timestampedSnapshot}`,
    api: `casastudio-api:${timestampedSnapshot}`
  });
});
