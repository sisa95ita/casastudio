import { describe, expect, it } from "vitest";

import rootPackage from "../../../package.json";
import { applicationMetadata } from "./application-metadata";

describe("applicationMetadata", () => {
  it("exposes the root CasaStudio product version", () => {
    expect(rootPackage.version).toBe("0.1.0-SNAPSHOT");
    expect(applicationMetadata.version).toBe(rootPackage.version);
  });
});
