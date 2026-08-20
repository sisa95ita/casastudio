/** Creates Vite replacements for resolved CasaStudio application metadata. */
export function createApplicationMetadataDefine(
  buildVersionOverride?: string
): {
  __CASASTUDIO_APPLICATION_VERSION__: string;
};
