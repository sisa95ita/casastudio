import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ProjectSchema } from "../project/index.js";
import { migrateProject } from "./migrate-project.js";
import { migrateV3ToV4 } from "./v3-to-v4.js";

const current = JSON.parse(
  readFileSync(new URL("../../examples/project.json", import.meta.url), "utf8")
);

describe("Furniture schema migration", () => {
  it.each(["2.0.0", "3.0.0"])(
    "losslessly migrates %s and starts with no Furniture",
    (schemaVersion) => {
      const source = structuredClone(current);
      source.schemaVersion = schemaVersion;
      delete source.building.furniture;
      const before = structuredClone(source);
      const result = migrateProject(source);
      expect(result).toEqual(migrateProject(source));
      expect(source).toEqual(before);
      expect(result).toMatchObject({
        ok: true,
        sourceVersion: schemaVersion,
        targetVersion: "4.0.0"
      });
      if (!result.ok) throw new Error("Migration failed");
      expect(result.project).toEqual({
        ...source,
        schemaVersion: "4.0.0",
        building: { ...source.building, furniture: [] }
      });
      expect(ProjectSchema.parse(result.project)).toEqual(result.project);
    }
  );
  it("preserves elevated and free Room boundaries exactly", () => {
    const source = structuredClone(current);
    source.schemaVersion = "3.0.0";
    delete source.building.furniture;
    source.building.levels[0].rooms.push({
      id: "raised",
      name: "Raised",
      type: "STUDIO",
      elevation: 200,
      boundary: [
        { kind: "FREE", start: { x: 0, z: 0 }, end: { x: 100, z: 0 } },
        { kind: "FREE", start: { x: 100, z: 0 }, end: { x: 0, z: 100 } },
        { kind: "FREE", start: { x: 0, z: 100 }, end: { x: 0, z: 0 } }
      ]
    });
    const result = migrateV3ToV4(source);
    expect(result).toMatchObject({ ok: true });
    if (result.ok)
      expect(result.project.building.levels).toEqual(source.building.levels);
  });
  it("chains v1 deterministically and preserves all non-boundary content", () => {
    const source = JSON.parse(
      readFileSync(
        new URL(
          "../../examples/project-v1-legacy-wallIds.json",
          import.meta.url
        ),
        "utf8"
      )
    );
    const result = migrateProject(source);
    expect(result).toEqual(migrateProject(source));
    expect(result).toMatchObject({
      ok: true,
      sourceVersion: "1.0.0",
      targetVersion: "4.0.0"
    });
    if (!result.ok) throw new Error("Migration failed");
    const { building, schemaVersion: _version, ...rest } = result.project;
    const {
      building: legacyBuilding,
      schemaVersion: _legacyVersion,
      ...legacyRest
    } = source;
    expect(_version).toBe("4.0.0");
    expect(_legacyVersion).toBe("1.0.0");
    expect(rest).toEqual(legacyRest);
    expect(building.furniture).toEqual([]);
    expect(building.levels.map((level) => ({ ...level, rooms: [] }))).toEqual(
      legacyBuilding.levels.map((level: object) => ({ ...level, rooms: [] }))
    );
  });
  it("rejects wrong versions, invalid legacy data and unexpected Furniture instead of dropping it", () => {
    expect(migrateV3ToV4(current).ok).toBe(false);
    expect(
      migrateV3ToV4({ ...current, name: "", schemaVersion: "3.0.0" }).ok
    ).toBe(false);
    expect(
      migrateV3ToV4({
        ...current,
        schemaVersion: "3.0.0",
        building: { ...current.building, furniture: [{ id: "unexpected" }] }
      }).ok
    ).toBe(false);
  });
});
