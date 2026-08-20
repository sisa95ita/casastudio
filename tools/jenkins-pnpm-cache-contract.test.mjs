import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const jenkinsfile = readFileSync(new URL("../Jenkinsfile", import.meta.url), "utf8");
const jenkinsCompose = readFileSync(
  new URL("../compose.jenkins.yml", import.meta.url),
  "utf8"
);

test("Jenkins keeps the pnpm store in the persistent agent home", () => {
  assert.match(
    jenkinsfile,
    /PNPM_HOME = '\/home\/jenkins\/\.local\/share\/pnpm'/
  );
  assert.doesNotMatch(jenkinsfile, /PNPM_HOME = "\$\{WORKSPACE\}/);
  assert.match(
    jenkinsCompose,
    /- jenkins_agent_home:\/home\/jenkins/
  );
  assert.match(jenkinsCompose, /jenkins_agent_home:/);
});

test("Jenkins preserves frozen installs, clean workspaces, and cache observability", () => {
  assert.match(jenkinsfile, /pnpm install --frozen-lockfile/);
  assert.doesNotMatch(jenkinsfile, /pnpm install[^\n]*--offline/);
  assert.match(jenkinsfile, /pnpm store path/);
  assert.match(jenkinsfile, /pnpm install duration:/);
  assert.match(jenkinsfile, /cleanWs deleteDirs: true/);
});
