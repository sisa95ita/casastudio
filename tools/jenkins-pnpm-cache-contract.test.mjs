import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const jenkinsfile = readFileSync(new URL("../Jenkinsfile", import.meta.url), "utf8");
const jenkinsCompose = readFileSync(
  new URL("../compose.jenkins.yml", import.meta.url),
  "utf8"
);
const agentDockerfile = readFileSync(
  new URL("../infra/jenkins/agent.Dockerfile", import.meta.url),
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
    /PNPM_CONFIG_STORE_DIR: \/home\/jenkins\/\.local\/share\/pnpm\/store/
  );
  assert.match(
    jenkinsCompose,
    /- jenkins_agent_home:\/home\/jenkins/
  );
  assert.match(jenkinsCompose, /jenkins_agent_home:/);
  assert.doesNotMatch(
    jenkinsCompose,
    /^\s*-\s+[^\n]*(?:pnpm[-_]store|\.pnpm-store)[^\n]*:/im
  );
  assert.doesNotMatch(
    jenkinsCompose,
    /^\s{2}(?:pnpm[-_]store|jenkins[-_]pnpm[-_]store):/im
  );
  assert.match(
    agentDockerfile,
    /install -d -o jenkins -g jenkins[^\n]*"\$\{PNPM_HOME\}"/
  );
});

test("Jenkins preserves frozen installs, clean workspaces, and cache observability", () => {
  assert.match(jenkinsfile, /pnpm install --frozen-lockfile/);
  assert.doesNotMatch(jenkinsfile, /pnpm install[^\n]*--offline/);
  assert.match(jenkinsfile, /configured_store_root="\$\(pnpm config get store-dir\)"/);
  assert.match(jenkinsfile, /expected_store_root="\$\{PNPM_HOME\}\/store"/);
  assert.match(jenkinsfile, /"\$\{configured_store_root\}"\/\*/);
  assert.match(jenkinsfile, /pnpm store path/);
  assert.match(jenkinsfile, /pnpm install duration:/);
  assert.match(jenkinsfile, /cleanWs deleteDirs: true/);
});
