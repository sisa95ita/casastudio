import { describe, expect, it } from "vitest";
import { applyFurnitureCommands } from "@casastudio/geometry";
import {
  ProjectSchema,
  resolveFurnitureRoom,
  type FurnitureCommand
} from "@casastudio/schema";
import {
  FurnitureEditRequestSchema,
  FurnitureEditResultSchema,
  deriveFurnitureEditContext,
  validateFurnitureEditResult
} from "./furniture-edit.js";
import { furnitureEditFixture } from "./test/furniture-edit-fixture.js";

const request = {
  instructions: "Move this Furniture",
  baseRevision: 1,
  levelId: "ground",
  selectedFurnitureIds: ["item-a"]
};
const move: FurnitureCommand = {
  type: "MOVE_FURNITURE",
  furnitureId: "item-a",
  targetPosition: { x: 350, z: 350 }
};
const rotate: FurnitureCommand = {
  type: "ROTATE_FURNITURE",
  furnitureId: "item-a",
  targetRotation: 120
};
const add: FurnitureCommand = {
  type: "ADD_FURNITURE",
  definitionId: "generic-desk",
  roomId: "room-a",
  position: { x: 400, z: 400 },
  rotation: 0
};
const transfer: FurnitureCommand = {
  type: "TRANSFER_FURNITURE",
  furnitureId: "item-a",
  targetRoomId: "room-b",
  targetPosition: { x: 1200, z: 200 }
};

describe("Furniture-only interpretation contracts and canonical commands", () => {
  it.each([move, rotate, add, transfer])(
    "validates $type without mutating canonical state",
    (operation) => {
      const project = furnitureEditFixture();
      const snapshot = JSON.stringify(project);
      const context = deriveFurnitureEditContext(project, request);
      const proposal = validateFurnitureEditResult(project, context, {
        kind: "EDIT_PROPOSAL",
        operations: [operation]
      });
      expect(proposal.kind).toBe("EDIT_PROPOSAL");
      expect(JSON.stringify(project)).toBe(snapshot);
      const next = applyFurnitureCommands(
        project,
        [operation],
        () => "furniture-new"
      );
      expect(ProjectSchema.parse(JSON.parse(JSON.stringify(next)))).toEqual(
        next
      );
      expect(JSON.stringify(project)).toBe(snapshot);
    }
  );

  it("resolves explicit selection and supplies bounded semantic coordinates and catalog context", () => {
    const context = deriveFurnitureEditContext(furnitureEditFixture(), request);
    expect(context.selectedFurniture.map((item) => item.id)).toEqual([
      "item-a"
    ]);
    expect(context.furniture).toHaveLength(2);
    expect(context.rooms.map((room) => room.id)).toEqual(["room-a", "room-b"]);
    expect(context.coordinates).toContain("degrees");
    expect(
      context.catalog.find((definition) => definition.id === "generic-desk")
        ?.defaultWidth
    ).toBe(120);
  });

  it("moves precisely, rotates relatively or absolutely without position drift or forced normalization", () => {
    const project = furnitureEditFixture();
    const moved = applyFurnitureCommands(project, [move], () => "unused");
    expect(moved.building.furniture[0]!.position).toEqual({ x: 350, z: 350 });
    for (const degrees of [120, 0, 450, -90]) {
      const next = applyFurnitureCommands(
        project,
        [{ ...rotate, targetRotation: degrees }],
        () => "unused"
      );
      expect(next.building.furniture[0]!.rotation).toBe(degrees);
      expect(next.building.furniture[0]!.position).toEqual(
        project.building.furniture[0]!.position
      );
    }
  });

  it("adds catalog dimensions at the explicit canonical anchor; provider extras are forbidden", () => {
    const project = furnitureEditFixture();
    const anchorRequest = {
      ...request,
      placementHint: { roomId: "room-a", position: { x: 400, z: 400 } }
    };
    const context = deriveFurnitureEditContext(project, anchorRequest);
    validateFurnitureEditResult(project, context, {
      kind: "EDIT_PROPOSAL",
      operations: [add]
    });
    const next = applyFurnitureCommands(project, [add], () => "furniture-new");
    expect(next.building.furniture.at(-1)).toMatchObject({
      id: "furniture-new",
      roomId: "room-a",
      position: anchorRequest.placementHint.position,
      width: 120,
      depth: 60,
      height: 75
    });
    expect(() =>
      validateFurnitureEditResult(project, context, {
        kind: "EDIT_PROPOSAL",
        operations: [{ ...add, position: { x: 450, z: 400 } }]
      })
    ).toThrow(/anchor/);
    expect(
      FurnitureEditResultSchema.safeParse({
        kind: "EDIT_PROPOSAL",
        operations: [
          { ...add, width: 1, assetUrl: "https://invalid.example/asset.glb" }
        ]
      }).success
    ).toBe(false);
  });

  it("transfers Room ownership and derives elevation, preserving unrelated Furniture", () => {
    const project = furnitureEditFixture();
    const next = applyFurnitureCommands(project, [transfer], () => "unused");
    const item = next.building.furniture[0]!;
    expect(item).toMatchObject({
      roomId: "room-b",
      position: { x: 1200, z: 200 },
      rotation: 30
    });
    expect(item).not.toHaveProperty("levelId");
    expect(item).not.toHaveProperty("y");
    expect(resolveFurnitureRoom(next, item)?.floorElevation).toBe(120);
    expect(next.building.furniture[1]).toEqual(project.building.furniture[1]);
  });

  it.each([
    "Several Chairs match; select one.",
    "Several Rooms are next door; select a destination.",
    "Set a placement anchor for here.",
    "Choose one of the two Bed definitions."
  ])("accepts clarification without edits: %s", (message) => {
    const project = furnitureEditFixture();
    const before = JSON.stringify(project);
    expect(
      validateFurnitureEditResult(
        project,
        deriveFurnitureEditContext(project, {
          ...request,
          selectedFurnitureIds: [],
          roomId: "room-a"
        }),
        { kind: "CLARIFICATION_REQUIRED", message }
      )
    ).toEqual({ kind: "CLARIFICATION_REQUIRED", message });
    expect(JSON.stringify(project)).toBe(before);
  });
  it("accepts unsupported architecture honestly without any Furniture approximation", () => {
    const project = furnitureEditFixture();
    const before = JSON.stringify(project);
    expect(
      validateFurnitureEditResult(
        project,
        deriveFurnitureEditContext(project, request),
        {
          kind: "UNSUPPORTED_REQUEST",
          message: "Door editing is outside Furniture editing."
        }
      ).kind
    ).toBe("UNSUPPORTED_REQUEST");
    expect(JSON.stringify(project)).toBe(before);
    expect(
      FurnitureEditResultSchema.safeParse({
        kind: "EDIT_PROPOSAL",
        operations: [{ type: "ADD_DOOR", roomId: "room-a" }]
      }).success
    ).toBe(false);
  });

  it.each([
    { ...move, furnitureId: "foreign-item" },
    { ...transfer, targetRoomId: "foreign-room" },
    { ...add, definitionId: "invented" },
    { ...rotate, targetRotation: Infinity },
    { ...rotate, targetRotation: NaN },
    { ...move, targetPosition: { x: Infinity, z: 0 } },
    { ...move, targetPosition: { x: -100, z: -100 } },
    { ...move, targetPosition: { x: 600, z: 600 } },
    { ...move, furnitureId: "item-b" },
    { ...transfer, targetPosition: { x: 100, z: 100 } }
  ])("rejects untrusted or invalid operations: %j", (operation) => {
    const project = furnitureEditFixture();
    const before = JSON.stringify(project);
    expect(() =>
      validateFurnitureEditResult(
        project,
        deriveFurnitureEditContext(project, request),
        { kind: "EDIT_PROPOSAL", operations: [operation] }
      )
    ).toThrow();
    expect(JSON.stringify(project)).toBe(before);
  });

  it.each([
    null,
    {},
    { kind: "EDIT_PROPOSAL", operations: [] },
    { kind: "EDIT_PROPOSAL", operations: Array(9).fill(move) }
  ])("rejects malformed/excessive results: %j", (raw) => {
    const project = furnitureEditFixture();
    expect(() =>
      validateFurnitureEditResult(
        project,
        deriveFurnitureEditContext(project, request),
        raw
      )
    ).toThrow();
  });
  it("rejects stale revisions, foreign context, Level/Room mismatch, and invalid anchors before interpretation", () => {
    const project = furnitureEditFixture();
    for (const input of [
      { ...request, baseRevision: 2 },
      { ...request, levelId: "unknown" },
      { ...request, roomId: "unknown" },
      { ...request, selectedFurnitureIds: ["foreign"] },
      {
        ...request,
        placementHint: { roomId: "room-b", position: { x: 200, z: 200 } }
      }
    ])
      expect(() => deriveFurnitureEditContext(project, input)).toThrow();
    expect(
      FurnitureEditRequestSchema.safeParse({ ...request, geometry: project })
        .success
    ).toBe(false);
  });
  it("rejects a whole batch atomically when a later command fails", () => {
    const project = furnitureEditFixture();
    const snapshot = JSON.stringify(project);
    expect(() =>
      applyFurnitureCommands(
        project,
        [move, { ...transfer, targetRoomId: "missing" }],
        () => "unused"
      )
    ).toThrow();
    expect(JSON.stringify(project)).toBe(snapshot);
  });
});
