import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ProjectSchema } from "./project";

const generatedSchemaUrl = new URL("../json-schema/project.schema.json", import.meta.url);
const generatedSchemaPath = fileURLToPath(generatedSchemaUrl);

describe("ProjectSchema JSON Schema export", () => {
  it("generates JSON Schema from ProjectSchema", () => {
    const jsonSchema = z.toJSONSchema(ProjectSchema, {
      target: "draft-2020-12",
      reused: "ref"
    });

    expect(JSON.stringify(jsonSchema)).toContain('"building"');
    expect(jsonSchema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object"
    });
  });

  it("writes a valid JSON Schema artifact", () => {
    expect(existsSync(generatedSchemaPath)).toBe(true);

    const jsonSchema = JSON.parse(readFileSync(generatedSchemaPath, "utf8")) as {
      $schema?: unknown;
      required?: unknown;
      type?: unknown;
    };

    expect(jsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.required).toContain("building");
  });
});
