import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const jenkinsfile = readFileSync(new URL("../Jenkinsfile", import.meta.url), "utf8");
const rootPackage = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

test("local repository scripts retain Turbo default concurrency", () => {
  assert.equal(rootPackage.scripts.lint, "turbo lint");
  assert.equal(rootPackage.scripts.test, "pnpm version:test && turbo test");
  assert.equal(rootPackage.scripts.build, "turbo build");
});

test("CI repository scripts serialize the same cached Turbo task graphs", () => {
  assert.equal(rootPackage.scripts["lint:ci"], "turbo lint --concurrency=1");
  assert.equal(
    rootPackage.scripts["test:ci"],
    "pnpm version:test && turbo test --concurrency=1"
  );
  assert.equal(rootPackage.scripts["build:ci"], "turbo build --concurrency=1");

  for (const scriptName of ["lint:ci", "test:ci", "build:ci"]) {
    assert.doesNotMatch(
      rootPackage.scripts[scriptName],
      /--force|--no-cache|--parallel/
    );
  }
});

test("Jenkins uses only the constrained repository validation scripts", () => {
  assert.match(jenkinsfile, /^\s*pnpm lint:ci\s*$/m);
  assert.match(jenkinsfile, /^\s*pnpm test:ci\s*$/m);
  assert.match(jenkinsfile, /^\s*pnpm build:ci\s*$/m);
  assert.doesNotMatch(jenkinsfile, /^\s*pnpm (?:lint|test|build)\s*$/m);
  assert.doesNotMatch(jenkinsfile, /TURBO_CONCURRENCY/);
});
