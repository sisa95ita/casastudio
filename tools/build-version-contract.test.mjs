import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createApplicationMetadataDefine } from "../apps/web/build-metadata.mjs";

const buildVersionEnvironmentKey = "CASASTUDIO_BUILD_VERSION";
const jenkinsfile = readFileSync(new URL("../Jenkinsfile", import.meta.url), "utf8");
const webDockerfile = readFileSync(
  new URL("../apps/web/Dockerfile", import.meta.url),
  "utf8"
);
const viteConfig = readFileSync(
  new URL("../apps/web/vite.config.ts", import.meta.url),
  "utf8"
);

function withoutBuildVersionOverride(assertion) {
  const hadOverride = Object.hasOwn(process.env, buildVersionEnvironmentKey);
  const previousOverride = process.env[buildVersionEnvironmentKey];

  try {
    delete process.env[buildVersionEnvironmentKey];
    return assertion();
  } finally {
    if (hadOverride) {
      process.env[buildVersionEnvironmentKey] = previousOverride;
    } else {
      delete process.env[buildVersionEnvironmentKey];
    }
  }
}

test("Jenkins uses one resolved build version for images and cleanup", () => {
  assert.match(
    jenkinsfile,
    /-t "casastudio-web:\$\{CASASTUDIO_BUILD_VERSION\}"/
  );
  assert.match(
    jenkinsfile,
    /-t "casastudio-api:\$\{CASASTUDIO_BUILD_VERSION\}"/
  );
  assert.match(
    jenkinsfile,
    /image_tag="\$\{CASASTUDIO_BUILD_VERSION:-\}"/
  );
  assert.doesNotMatch(jenkinsfile, /image_tag="ci-\$\{BUILD_NUMBER/);
});

test("the Docker frontend build receives the same resolved version as Vite", () => {
  assert.match(
    jenkinsfile,
    /--build-arg CASASTUDIO_BUILD_VERSION="\$\{CASASTUDIO_BUILD_VERSION\}"/
  );
  assert.match(webDockerfile, /ARG CASASTUDIO_BUILD_VERSION/);
  assert.match(
    webDockerfile,
    /ENV CASASTUDIO_BUILD_VERSION=\$CASASTUDIO_BUILD_VERSION/
  );
  assert.match(viteConfig, /process\.env\.CASASTUDIO_BUILD_VERSION/);
});

test("frontend build metadata uses the declared snapshot by default", () => {
  withoutBuildVersionOverride(() =>
    assert.deepEqual(createApplicationMetadataDefine(), {
      __CASASTUDIO_APPLICATION_VERSION__: JSON.stringify("0.1.0-SNAPSHOT")
    })
  );
});

test("frontend build metadata preserves an explicit build override", () => {
  const buildVersion = "0.1.0-SNAPSHOT-20260820.151245";

  assert.deepEqual(createApplicationMetadataDefine(buildVersion), {
    __CASASTUDIO_APPLICATION_VERSION__: JSON.stringify(buildVersion)
  });
});
