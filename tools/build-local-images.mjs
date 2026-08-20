import { spawnSync } from "node:child_process";

import {
  createDockerImageReferences,
  resolveBuildVersion
} from "./build-version.mjs";

const buildVersion = resolveBuildVersion();
const imageReferences = createDockerImageReferences(buildVersion);
const environment = {
  ...process.env,
  CASASTUDIO_BUILD_VERSION: buildVersion
};

run("docker", ["compose", "build", "web", "api"]);
tagComposeImage("web", imageReferences.web);
tagComposeImage("api", imageReferences.api);

process.stdout.write(`Built ${imageReferences.web}\nBuilt ${imageReferences.api}\n`);

function tagComposeImage(service, imageReference) {
  const imageId = run("docker", ["compose", "images", "-q", service], true).trim();

  if (!imageId) {
    throw new Error(`Docker Compose did not report an image for the ${service} service.`);
  }

  run("docker", ["image", "tag", imageId, imageReference]);
}

function run(command, arguments_, captureOutput = false) {
  const result = spawnSync(command, arguments_, {
    encoding: "utf8",
    env: environment,
    stdio: captureOutput ? "pipe" : "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = captureOutput ? result.stderr.trim() : "";
    throw new Error(
      `${command} ${arguments_.join(" ")} failed with exit code ${result.status}.${details ? ` ${details}` : ""}`
    );
  }

  return result.stdout ?? "";
}
