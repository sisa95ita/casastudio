import type { Project, Wall } from "@casastudio/schema";

import { createFurniture3DFixture } from "./furniture-3d-fixture";
import { rectangleRoom } from "./vertical-architecture-fixture";

/** Builds a generic furnished house covering every architectural scene-finish role. */
export function createArchitecturalSceneFinishFixture(base: Project): Project {
  const project = createFurniture3DFixture(base);
  const showroom = project.building.levels.find((level) => level.id === "showroom")!;
  showroom.rooms = [
    rectangleRoom("main-room", -130, -180, 800, 760, 0),
    rectangleRoom("raised-room", 1030, 180, 1250, 340, 270)
  ];
  showroom.walls = createSceneFinishWalls();
  showroom.staircases = [{
    id: "scene-stair",
    name: "Raised Room Stair",
    fromLevelId: "showroom",
    toLevelId: "showroom",
    fromRoomId: "main-room",
    toRoomId: "raised-room",
    width: 100,
    flights: [{
      id: "scene-flight-lower",
      start: { x: 900, z: 0 },
      end: { x: 1080, z: 0 },
      width: 100,
      stepCount: 6,
      startElevation: 0,
      endElevation: 135
    }, {
      id: "scene-flight-upper",
      start: { x: 1130, z: 50 },
      end: { x: 1130, z: 230 },
      width: 100,
      stepCount: 6,
      startElevation: 135,
      endElevation: 270
    }],
    landings: [{
      id: "scene-landing",
      position: { x: 1130, z: 0 },
      width: 100,
      depth: 100,
      elevation: 135
    }]
  }];
  const raisedChair = project.building.furniture.find((item) => item.id === "raised-chair");
  if (raisedChair) raisedChair.position = { x: 1180, z: 285 };
  return project;
}

/** Creates restrained walls demonstrating Door, Window, and open-passage treatment. */
function createSceneFinishWalls(): Wall[] {
  return [{
    id: "front-wall",
    name: "Front Wall",
    start: { x: -130, z: -180 },
    end: { x: 800, z: -180 },
    height: 300,
    thickness: 20,
    roomIds: [],
    openings: [{
      id: "front-door",
      type: "DOOR",
      offsetFromStart: 120,
      width: 90,
      height: 210,
      elevation: 0,
      hingeSide: "START",
      swingSide: "LEFT"
    }, {
      id: "front-window",
      type: "WINDOW",
      offsetFromStart: 540,
      width: 150,
      height: 120,
      elevation: 90
    }]
  }, {
    id: "side-wall",
    name: "Side Wall",
    start: { x: 800, z: -180 },
    end: { x: 800, z: 760 },
    height: 300,
    thickness: 20,
    roomIds: [],
    openings: [{
      id: "side-opening",
      type: "OPENING",
      offsetFromStart: 520,
      width: 150,
      height: 220,
      elevation: 0
    }]
  }, {
    id: "back-wall",
    name: "Back Wall",
    start: { x: 800, z: 760 },
    end: { x: -130, z: 760 },
    height: 300,
    thickness: 20,
    roomIds: [],
    openings: []
  }];
}
