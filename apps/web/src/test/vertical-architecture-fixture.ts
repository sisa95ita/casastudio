import type { Project, Room, StairFlight } from "@casastudio/schema";

/** Generic public dimensions for deterministic vertical-architecture acceptance. */
export function createVerticalArchitectureFixture(
  base: Project, layout: "straight" | "L" | "U" = "straight", crossLevel = false
): Project {
  const project = structuredClone(base);
  const destinationElevation = crossLevel ? 300 : 220;
  const destinationLevelId = crossLevel ? "upper" : "ground";
  const flight = (id: string, start: { x: number; z: number }, end: { x: number; z: number }, startElevation: number, endElevation: number): StairFlight => ({
    id, start, end, width: 100, stepCount: layout === "straight" ? 12 : 6, startElevation, endElevation
  });
  const flights = layout === "straight"
    ? [flight("flight-1", { x: 0, z: 0 }, { x: 360, z: 0 }, 0, destinationElevation)]
    : [flight("flight-1", { x: 0, z: 0 }, { x: 180, z: 0 }, 0, destinationElevation / 2),
      layout === "L"
        ? flight("flight-2", { x: 180, z: 0 }, { x: 180, z: 180 }, destinationElevation / 2, destinationElevation)
        : flight("flight-2", { x: 180, z: 100 }, { x: 0, z: 100 }, destinationElevation / 2, destinationElevation)];
  const elevated = layout === "straight"
    ? rectangleRoom("elevated", 360, -50, 520, 150, crossLevel ? 0 : destinationElevation)
    : layout === "L"
      ? rectangleRoom("elevated", 130, 180, 350, 340, crossLevel ? 0 : destinationElevation)
      : rectangleRoom("elevated", -160, 50, 0, 250, crossLevel ? 0 : destinationElevation);
  const lower = rectangleRoom("lower", -180, -70, 540, 360, 0);
  project.building.levels = [{
    id: "ground", name: "Ground", elevation: 0, walls: [], rooms: crossLevel ? [lower] : [lower, elevated],
    staircases: [{ id: "stair", name: `${layout} Stair`, fromLevelId: "ground", toLevelId: destinationLevelId,
      fromRoomId: "lower", toRoomId: "elevated", width: 100, flights,
      landings: layout === "straight" ? [] : [{ id: "landing", position: { x: 180, z: layout === "L" ? 0 : 50 },
        width: layout === "L" ? 100 : 200, depth: 100, elevation: destinationElevation / 2 }]
    }]
  }, ...(crossLevel ? [{ id: "upper", name: "Upper", elevation: destinationElevation, walls: [], rooms: [elevated], staircases: [] }] : [])];
  return project;
}

/** Creates an exact Room contour with FREE floor extents and no inferred Walls. */
export function rectangleRoom(id: string, x0: number, z0: number, x1: number, z1: number, elevation: number): Room {
  const points = [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
  return { id, name: id, type: "STUDIO", elevation,
    boundary: points.map((start, i) => ({ kind: "FREE", start, end: points[(i + 1) % points.length]! })) };
}
