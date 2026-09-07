import {
  createInitialProject,
  createRoomFromShape,
  createFreeBoundaryRoomFromShape,
  type Project
} from "@casastudio/schema";

/** Generic Room-owned authoring fixture with an overlapping elevated study and a separate Room. */
export function furnitureProjectFixture(): Project {
  const initial = createInitialProject({
    projectId: "furniture-project",
    buildingId: "building",
    levelId: "ground",
    name: "Furniture workshop",
    createdAt: "2026-09-06T00:00:00Z"
  });
  const living = createRoomFromShape(initial, {
    levelId: "ground",
    origin: { x: 0, z: 600 },
    shape: { kind: "RECTANGLE", dimensions: { width: 600, depth: 600 } },
    room: { id: "living", name: "Living Room", type: "LIVING_ROOM" },
    wallIds: ["wall-a", "wall-b", "wall-c", "wall-d"],
    wallHeight: 300,
    wallThickness: 20
  });
  if (!living.ok) throw new Error(JSON.stringify(living.errors));
  const study = createFreeBoundaryRoomFromShape(living.project, {
    levelId: "ground",
    origin: { x: 250, z: 550 },
    shape: { kind: "RECTANGLE", dimensions: { width: 300, depth: 300 } },
    room: {
      id: "study",
      name: "Elevated Study",
      type: "STUDIO",
      elevation: 200
    }
  });
  if (!study.ok) throw new Error(JSON.stringify(study.errors));
  const other = createFreeBoundaryRoomFromShape(study.project, {
    levelId: "ground",
    origin: { x: 700, z: 600 },
    shape: { kind: "RECTANGLE", dimensions: { width: 300, depth: 300 } },
    room: { id: "other", name: "Other Room", type: "STUDIO", elevation: 100 }
  });
  if (!other.ok) throw new Error(JSON.stringify(other.errors));
  return other.project;
}
