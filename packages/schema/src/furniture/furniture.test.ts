import { describe, expect, it } from "vitest";
import {
  createInitialProject,
  ProjectSchema,
  type Project
} from "../project/index.js";
import {
  validateProjectCrossReferences,
  validateProjectIdentifierUniqueness,
  ValidationErrorCode
} from "../validation/index.js";
import {
  deleteRoom,
  type ProjectEditingResult
} from "../physical-building/index.js";
import {
  builtinFurnitureDefinitions,
  createFurnitureItemFromDefinition,
  FurnitureDefinitionSchema,
  FurnitureItemSchema,
  resolveBuiltinFurnitureDefinition,
  resolveFurnitureRoom,
  type FurnitureItem
} from "./index.js";
import {
  createFurniture,
  deleteFurniture,
  duplicateFurniture,
  moveFurniture,
  reassignFurniture,
  resizeFurniture,
  rotateFurniture,
  updateFurniture
} from "./furniture-editing.js";

const item: FurnitureItem = {
  id: "sofa-one",
  roomId: "living-room",
  definitionId: "generic-sofa",
  position: { x: 50, z: 50 },
  rotation: 27.5,
  width: 200,
  depth: 90,
  height: 85,
  name: "Sofa",
  description: "Generic furnishing"
};
function fixture(): Project {
  const project = createInitialProject({
    projectId: "furniture-project",
    buildingId: "building",
    levelId: "ground",
    name: "Furniture test",
    createdAt: "2026-09-06T00:00:00Z"
  });
  project.building.levels[0]!.rooms = [
    {
      id: "living-room",
      name: "Living Room",
      type: "LIVING_ROOM",
      boundary: []
    },
    {
      id: "study",
      name: "Elevated Study",
      type: "STUDIO",
      elevation: 200,
      boundary: []
    }
  ];
  project.building.furniture = [structuredClone(item)];
  return project;
}
function success(result: ProjectEditingResult): Project {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.project;
}

describe("canonical Furniture", () => {
  it("parses exact instance metadata and unknown definitions without renderer or catalog state", () => {
    const project = fixture();
    project.building.furniture[0]!.definitionId = "custom-provider:item-123";
    expect(ProjectSchema.parse(project)).toEqual(project);
    expect(validateProjectCrossReferences(project).valid).toBe(true);
    expect(
      resolveBuiltinFurnitureDefinition("custom-provider:item-123")
    ).toBeUndefined();
    expect(project.building.furniture[0]).not.toHaveProperty("levelId");
    expect(project.building.furniture[0]).not.toHaveProperty("y");
  });
  it.each([
    "roomId",
    "definitionId",
    "position",
    "rotation",
    "width",
    "depth",
    "height",
    "id"
  ])("requires %s", (key) => {
    const candidate = { ...item } as Record<string, unknown>;
    delete candidate[key];
    expect(FurnitureItemSchema.safeParse(candidate).success).toBe(false);
  });
  it.each([NaN, Infinity, -Infinity])(
    "rejects non-finite measurements %s",
    (value) => {
      for (const key of ["width", "depth", "height", "rotation"])
        expect(
          FurnitureItemSchema.safeParse({ ...item, [key]: value }).success
        ).toBe(false);
      for (const key of ["x", "z"])
        expect(
          FurnitureItemSchema.safeParse({
            ...item,
            position: { ...item.position, [key]: value }
          }).success
        ).toBe(false);
    }
  );
  it.each([0, -1])("rejects non-positive dimensions %s", (value) => {
    for (const key of ["width", "depth", "height"])
      expect(
        FurnitureItemSchema.safeParse({ ...item, [key]: value }).success
      ).toBe(false);
  });
  it("rejects duplicate identity, unknown Room, forbidden ownership and vertical state", () => {
    const project = fixture();
    project.building.furniture.push({ ...item, roomId: "study" });
    expect(validateProjectIdentifierUniqueness(project)).toMatchObject({
      valid: false,
      errors: [{ code: ValidationErrorCode.DUPLICATE_IDENTIFIER }]
    });
    project.building.furniture = [{ ...item, roomId: "foreign-room" }];
    expect(validateProjectCrossReferences(project)).toMatchObject({
      valid: false,
      errors: [
        {
          code: ValidationErrorCode.ROOM_NOT_FOUND,
          path: "building.furniture[0].roomId"
        }
      ]
    });
    for (const key of [
      "levelId",
      "y",
      "elevation",
      "category",
      "selected",
      "assetUrl"
    ])
      expect(FurnitureItemSchema.safeParse({ ...item, [key]: 1 }).success).toBe(
        false
      );
    expect(
      FurnitureItemSchema.safeParse({ ...item, position: { x: 0, z: 0, y: 0 } })
        .success
    ).toBe(false);
  });
  it("allows arbitrary angles, outlying anchors, multiple items, and vertically stacked X/Z", () => {
    const project = fixture();
    project.building.furniture.push(
      { ...item, id: "desk", roomId: "study", rotation: -725.5 },
      { ...item, id: "table", position: { x: -10000, z: 99999 } }
    );
    expect(ProjectSchema.parse(project)).toEqual(project);
    expect(validateProjectCrossReferences(project).valid).toBe(true);
    expect(resolveFurnitureRoom(project, item)?.floorElevation).toBe(0);
    expect(
      resolveFurnitureRoom(project, project.building.furniture[1]!)
        ?.floorElevation
    ).toBe(200);
    project.building.levels[0]!.elevation = 300;
    expect(resolveFurnitureRoom(project, item)?.floorElevation).toBe(300);
    expect(
      resolveFurnitureRoom(project, project.building.furniture[1]!)
        ?.floorElevation
    ).toBe(500);
    expect(
      resolveFurnitureRoom(project, { roomId: "missing" })
    ).toBeUndefined();
  });
  it("keeps deterministic immutable catalog defaults independent of persisted sizes", () => {
    expect(
      new Set(builtinFurnitureDefinitions.map((definition) => definition.id))
        .size
    ).toBe(8);
    for (const definition of builtinFurnitureDefinitions) {
      expect(FurnitureDefinitionSchema.parse(definition)).toEqual(definition);
      expect(Object.isFrozen(definition)).toBe(true);
    }
    const definition = resolveBuiltinFurnitureDefinition("generic-desk")!;
    const created = createFurnitureItemFromDefinition(definition, {
      id: "desk",
      roomId: "study",
      position: { x: 0, z: 0 }
    });
    createFurnitureItemFromDefinition(
      { ...definition, defaultWidth: 999 },
      { id: "other", roomId: "study", position: { x: 0, z: 0 } }
    );
    expect(created).toMatchObject({
      width: 120,
      depth: 60,
      height: 75,
      rotation: 0,
      definitionId: definition.id
    });
  });
});

describe("pure Furniture edits", () => {
  it("creates, updates, moves, rotates, resizes, duplicates, reassigns and deletes immutably", () => {
    let project = fixture();
    const operations = [
      (p: Project) =>
        createFurniture(p, { furniture: { ...item, id: "second" } }),
      (p: Project) =>
        updateFurniture(p, {
          furnitureId: item.id,
          changes: { name: "Renamed" }
        }),
      (p: Project) =>
        moveFurniture(p, { furnitureId: item.id, position: { x: 10, z: 20 } }),
      (p: Project) =>
        rotateFurniture(p, { furnitureId: item.id, rotation: 725.25 }),
      (p: Project) =>
        resizeFurniture(p, {
          furnitureId: item.id,
          width: 220,
          depth: 95,
          height: 90
        }),
      (p: Project) =>
        duplicateFurniture(p, {
          furnitureId: item.id,
          newId: "copy",
          position: { x: 30, z: 40 }
        })
    ];
    for (const operation of operations) {
      const before = structuredClone(project);
      const next = success(operation(project));
      expect(project).toEqual(before);
      expect(next).not.toBe(project);
      expect(next.building.levels).toEqual(project.building.levels);
      expect(next.viewpoints).toEqual(project.viewpoints);
      project = next;
    }
    expect(project.building.furniture[0]).toEqual({
      ...item,
      name: "Renamed",
      position: { x: 10, z: 20 },
      rotation: 725.25,
      width: 220,
      depth: 95,
      height: 90
    });
    expect(project.building.furniture[2]).toEqual({
      ...project.building.furniture[0],
      id: "copy",
      position: { x: 30, z: 40 }
    });
    const reassigned = success(
      reassignFurniture(project, { furnitureId: item.id, roomId: "study" })
    );
    expect(
      resolveFurnitureRoom(reassigned, reassigned.building.furniture[0]!)
        ?.floorElevation
    ).toBe(200);
    expect(reassigned.building.furniture[0]).toEqual({
      ...project.building.furniture[0],
      roomId: "study"
    });
    const copied = success(
      duplicateFurniture(project, {
        furnitureId: item.id,
        newId: "upstairs-copy",
        roomId: "study",
        position: { x: 0, z: 0 }
      })
    );
    expect(copied.building.furniture.at(-1)?.roomId).toBe("study");
    const deleted = success(
      deleteFurniture(reassigned, { furnitureId: item.id })
    );
    expect(deleted.building.furniture).toEqual(
      reassigned.building.furniture.slice(1)
    );
    expect(project.building.furniture).toHaveLength(3);
    expect(reassigned.building.furniture).toHaveLength(3);
  });
  it("rejects invalid edits with semantic errors and no partial mutation", () => {
    const project = fixture();
    const before = structuredClone(project);
    const cases: [ProjectEditingResult, ValidationErrorCode][] = [
      [
        createFurniture(project, { furniture: item }),
        ValidationErrorCode.DUPLICATE_IDENTIFIER
      ],
      [
        createFurniture(project, { furniture: { ...item, id: "INVALID" } }),
        ValidationErrorCode.INVALID_IDENTIFIER
      ],
      [
        createFurniture(project, {
          furniture: { ...item, id: "new", roomId: "missing" }
        }),
        ValidationErrorCode.ROOM_NOT_FOUND
      ],
      [
        resizeFurniture(project, {
          furnitureId: item.id,
          width: 0,
          depth: 1,
          height: 1
        }),
        ValidationErrorCode.INVALID_FURNITURE
      ],
      [
        rotateFurniture(project, { furnitureId: item.id, rotation: NaN }),
        ValidationErrorCode.INVALID_FURNITURE
      ],
      [
        moveFurniture(project, {
          furnitureId: item.id,
          position: { x: Infinity, z: 0 }
        }),
        ValidationErrorCode.INVALID_FURNITURE
      ],
      [
        reassignFurniture(project, { furnitureId: item.id, roomId: "missing" }),
        ValidationErrorCode.ROOM_NOT_FOUND
      ],
      [
        deleteFurniture(project, { furnitureId: "absent" }),
        ValidationErrorCode.FURNITURE_NOT_FOUND
      ],
      [
        updateFurniture(project, { furnitureId: "INVALID", changes: {} }),
        ValidationErrorCode.INVALID_IDENTIFIER
      ],
      [
        duplicateFurniture(project, {
          furnitureId: item.id,
          newId: item.id,
          position: item.position
        }),
        ValidationErrorCode.DUPLICATE_IDENTIFIER
      ]
    ];
    for (const [result, code] of cases)
      expect(result).toMatchObject({ ok: false, errors: [{ code }] });
    expect(project).toEqual(before);
  });
  it.each(["living-room", "study"])(
    "deletes Furniture with ordinary or elevated standalone Room %s",
    (roomId) => {
      const project = fixture();
      project.building.furniture.push({ ...item, id: "desk", roomId: "study" });
      const before = structuredClone(project);
      const result = success(
        deleteRoom(project, { levelId: "ground", roomId })
      );
      expect(result.building.furniture).toEqual(
        project.building.furniture.filter((item) => item.roomId !== roomId)
      );
      expect(validateProjectCrossReferences(result).valid).toBe(true);
      expect(project).toEqual(before);
    }
  );
});
