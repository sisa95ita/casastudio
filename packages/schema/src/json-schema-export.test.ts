import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ProjectSchema } from "./project/index.js";

const generatedSchemaUrl = new URL("../json-schema/project.schema.json", import.meta.url);
const generatedSchemaPath = fileURLToPath(generatedSchemaUrl);

type JsonObject = {
  [key: string]: unknown;
};

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const collectObjectsWithProperty = (
  value: unknown,
  propertyName: string,
  matches: JsonObject[] = []
): JsonObject[] => {
  if (!isJsonObject(value)) {
    return matches;
  }

  if (isJsonObject(value.properties) && propertyName in value.properties) {
    matches.push(value);
  }

  Object.values(value).forEach((child) => {
    if (Array.isArray(child)) {
      child.forEach((item) => collectObjectsWithProperty(item, propertyName, matches));
      return;
    }

    collectObjectsWithProperty(child, propertyName, matches);
  });

  return matches;
};

const hasPropertyDefinition = (value: unknown, propertyName: string): boolean =>
  collectObjectsWithProperty(value, propertyName).length > 0;

const resolveLocalRef = (jsonSchema: JsonObject, ref: unknown): unknown => {
  if (typeof ref !== "string" || !ref.startsWith("#/")) {
    return undefined;
  }

  return ref
    .slice(2)
    .split("/")
    .reduce<unknown>((current, pathPart) => {
      if (!isJsonObject(current)) {
        return undefined;
      }

      return current[pathPart];
    }, jsonSchema);
};

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
      properties?: {
        schemaVersion?: {
          const?: unknown;
        };
      };
      required?: unknown;
      type?: unknown;
    };

    expect(jsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.required).toContain("building");
    expect(jsonSchema.properties?.schemaVersion?.const).toBe("2.0.0");
  });

  it("matches the current ProjectSchema JSON Schema output", () => {
    const generatedSchema = z.toJSONSchema(ProjectSchema, {
      target: "draft-2020-12",
      reused: "ref"
    });
    const artifactSchema = JSON.parse(readFileSync(generatedSchemaPath, "utf8"));

    expect(artifactSchema).toEqual(generatedSchema);
  });

  it("exports the canonical v2 room boundary contract", () => {
    const jsonSchema = JSON.parse(readFileSync(generatedSchemaPath, "utf8"));
    const roomSchemas = collectObjectsWithProperty(jsonSchema, "boundary");
    const boundaryJson = JSON.stringify(jsonSchema);

    expect(roomSchemas.length).toBeGreaterThan(0);
    expect(roomSchemas.some((schema) => Array.isArray(schema.required) && schema.required.includes("boundary"))).toBe(
      true
    );
    expect(boundaryJson).toContain('"FORWARD"');
    expect(boundaryJson).toContain('"REVERSE"');
    expect(hasPropertyDefinition(jsonSchema, "wallIds")).toBe(false);
  });

  it("represents Wall roomIds cardinality when supported by the generator", () => {
    const jsonSchema = JSON.parse(readFileSync(generatedSchemaPath, "utf8")) as JsonObject;
    const roomIdsSchemas = collectObjectsWithProperty(jsonSchema, "roomIds");
    const roomIdsRefs = roomIdsSchemas
      .map((schema) => (isJsonObject(schema.properties) ? schema.properties.roomIds : undefined))
      .filter(isJsonObject)
      .map((roomIdsProperty) => resolveLocalRef(jsonSchema, roomIdsProperty.$ref));

    expect(roomIdsSchemas.length).toBeGreaterThan(0);
    expect(roomIdsRefs.some((schema) => isJsonObject(schema) && schema.maxItems === 2)).toBe(true);
  });
});
