import { resolveBuildVersion } from "../../tools/build-version.mjs";

/** Creates Vite replacements for resolved CasaStudio application metadata. */
export function createApplicationMetadataDefine(buildVersionOverride) {
  const applicationVersion = resolveBuildVersion({
    override: buildVersionOverride
  });

  return {
    __CASASTUDIO_APPLICATION_VERSION__: JSON.stringify(applicationVersion)
  };
}
