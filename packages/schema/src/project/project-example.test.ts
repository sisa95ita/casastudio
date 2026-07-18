import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  validateProjectRenderability
} from "../validation";
import { ProjectSchema } from "./project";

const canonicalProjectUrl = new URL("../../examples/project.json", import.meta.url);

const loadCanonicalProject = (): unknown => JSON.parse(readFileSync(canonicalProjectUrl, "utf8"));

describe("canonical project example", () => {
  it("satisfies ProjectSchema and all Project validation layers", () => {
    const project = ProjectSchema.parse(loadCanonicalProject());

    expect(validateProjectCrossReferences(project)).toEqual({
      valid: true,
      errors: []
    });
    expect(validateProjectReferenceConsistency(project)).toEqual({
      valid: true,
      errors: []
    });
    expect(validateProjectRenderability(project)).toEqual({
      valid: true,
      errors: []
    });
    expect(validateProjectGeometry(project)).toEqual({
      valid: true,
      errors: []
    });
  });
});
