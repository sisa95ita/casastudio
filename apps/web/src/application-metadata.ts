/** Build metadata exposed to CasaStudio frontend consumers. */
export type ApplicationMetadata = {
  readonly version: string;
};

/** Immutable application metadata supplied by the frontend build. */
export const applicationMetadata: ApplicationMetadata = Object.freeze({
  version: __CASASTUDIO_APPLICATION_VERSION__
});
