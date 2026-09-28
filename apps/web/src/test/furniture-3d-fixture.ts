import { builtinFurnitureDefinitions, createFurnitureItemFromDefinition, type Project } from "@casastudio/schema";
import { rectangleRoom } from "./vertical-architecture-fixture";

/** Public catalog showcase with edited dimensions, repeated assets and independent Room elevations. */
export function createFurniture3DFixture(base: Project): Project {
  const project = structuredClone(base);
  project.building.levels = [
    { id: "showroom", name: "Showroom", elevation: 0, walls: [], staircases: [], rooms: [rectangleRoom("main-room", -130, -180, 800, 760, 0), rectangleRoom("raised-room", 850, 250, 1150, 600, 270)] },
    { id: "upper", name: "Upper", elevation: 300, walls: [], staircases: [], rooms: [rectangleRoom("upper-room", 850, 650, 1150, 950, 40)] }
  ];
  project.building.furniture = builtinFurnitureDefinitions.map((definition, index) => createFurnitureItemFromDefinition(definition, {
    id: `showcase-${definition.id}`, roomId: "main-room", position: { x: (index % 3) * 290, z: Math.floor(index / 3) * 280 },
    rotation: definition.category === "SOFA" ? 37 : 0
  }));
  const desk = project.building.furniture.find(item => item.definitionId === "generic-desk")!;
  Object.assign(desk, { width: 145, depth: 72, height: 82 });
  project.building.furniture.push(
    createFurnitureItemFromDefinition(builtinFurnitureDefinitions[4]!, { id: "raised-chair", roomId: "raised-room", position: { x: 1000, z: 420 }, rotation: 37 }),
    createFurnitureItemFromDefinition(builtinFurnitureDefinitions[4]!, { id: "upper-chair", roomId: "upper-room", position: { x: 1000, z: 800 } }),
    { ...desk, id: "unknown-furniture", definitionId: "custom:unknown", position: { x: 580, z: 560 }, width: 90, depth: 70, height: 65 }
  );
  return project;
}
