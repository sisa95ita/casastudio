import { describe, expect, it } from "vitest";

import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import { ProjectIdPipe } from "./project-id.pipe";

describe("ProjectIdPipe", () => {
  it("accepts canonical CasaStudio identifiers", () => {
    expect(new ProjectIdPipe().transform("demo-project")).toBe("demo-project");
  });

  it("rejects malformed identifiers with a stable project error code", () => {
    expect(() => new ProjectIdPipe().transform("Casa Studio")).toThrow(
      expect.objectContaining({
        code: ApiErrorCode.ProjectIdInvalid,
        status: 400,
        errors: [
          {
            path: "id",
            message: "Project ID must be a non-empty lowercase kebab-case identifier."
          }
        ]
      })
    );
  });
});
