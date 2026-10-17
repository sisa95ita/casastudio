import {
  createInitialProject,
  createFreeBoundaryRoomFromShape,
  createFurnitureItemFromDefinition,
  resolveBuiltinFurnitureDefinition,
  type Project
} from "@casastudio/schema";

export function furnitureEditFixture(): Project {
  let project = createInitialProject({
    projectId: "command-project",
    buildingId: "building",
    levelId: "ground",
    name: "Command workshop",
    createdAt: "2026-10-01T00:00:00Z"
  });
  for (const [id, x, elevation] of [
    ["room-a", 0, 0],
    ["room-b", 1000, 120]
  ] as const) {
    const result = createFreeBoundaryRoomFromShape(project, {
      levelId: "ground",
      origin: { x, z: 800 },
      shape: { kind: "RECTANGLE", dimensions: { width: 800, depth: 800 } },
      room: { id, name: id, type: "STUDIO", elevation }
    });
    if (!result.ok) throw new Error("Invalid synthetic Room");
    project = result.project;
  }
  project.building.furniture = [
    createFurnitureItemFromDefinition(
      resolveBuiltinFurnitureDefinition("generic-chair")!,
      {
        id: "item-a",
        roomId: "room-a",
        position: { x: 200, z: 200 },
        rotation: 30
      }
    ),
    createFurnitureItemFromDefinition(
      resolveBuiltinFurnitureDefinition("generic-chair")!,
      { id: "item-b", roomId: "room-a", position: { x: 600, z: 600 } }
    )
  ];
  return project;
}
