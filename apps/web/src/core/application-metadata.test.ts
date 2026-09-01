import { describe, expect, it } from "vitest";

import { applicationMetadata } from "./application-metadata";

describe("applicationMetadata", () => {
  it("exposes the Vite-injected CasaStudio build version", () => {
    expect(applicationMetadata.version).toBe(
      __CASASTUDIO_APPLICATION_VERSION__
    );
  });
});
