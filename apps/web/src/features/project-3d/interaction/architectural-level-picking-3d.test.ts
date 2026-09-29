import {
  createInitialProject,
  type Level,
  type Project,
  type Wall
} from "@casastudio/schema";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3
} from "three";
import { describe, expect, it, vi } from "vitest";

import { createFloorSolid3D } from "../model/floor-solid-3d";
import {
  createArchitecturalScene3DModel,
  getInteractableLevelReferences3D,
  type Floor3D,
  type LevelReference3D
} from "../model/architectural-scene-3d-model";
import type { ArchitecturalEntityIdentity3D } from "./architectural-selection-3d";
import { createEntityPointerHandlers3D } from "./architectural-viewer-interaction-3d";

describe("multi-Level 3D picking eligibility", () => {
  it("mounts and selects only the lower active Level across an overlapping footprint", () => {
    const project = createOverlappingRoomProject();
    const before = structuredClone(project);
    const model = createArchitecturalScene3DModel(project);
    const interactable = getInteractableLevelReferences3D(
      model,
      "active",
      "lower"
    );

    expect(interactable.map((level) => level.id)).toEqual(["lower"]);
    expect(pickNearestRoom(interactable)).toEqual({
      kind: "room",
      id: "lower-room",
      levelId: "lower"
    });
    expect(
      interactable[0]!.walls.every((wall) => wall.id.startsWith("lower"))
    ).toBe(true);
    expect(project).toEqual(before);
  });

  it("switches the same projected interaction to the upper active Level", () => {
    const model = createArchitecturalScene3DModel(
      createOverlappingRoomProject()
    );
    const interactable = getInteractableLevelReferences3D(
      model,
      "active",
      "upper"
    );

    expect(interactable.map((level) => level.id)).toEqual(["upper"]);
    expect(pickNearestRoom(interactable)).toEqual({
      kind: "room",
      id: "upper-room",
      levelId: "upper"
    });
  });

  it("excludes hidden hits before handlers can stop propagation", () => {
    const model = createArchitecturalScene3DModel(
      createOverlappingRoomProject()
    );
    const allMeshes = createRoomMeshes(model.levels);
    const upperMesh = allMeshes.find(
      (mesh) => mesh.userData.identity.levelId === "upper"
    )!;
    upperMesh.visible = false;

    // Three intentionally ignores Object3D.visible during raycasting.
    expect(rayHit(allMeshes)?.levelId).toBe("upper");

    const eligibleLevels = getInteractableLevelReferences3D(
      model,
      "active",
      "lower"
    );
    const hit = pickNearestRoom(eligibleLevels)!;
    const stopPropagation = vi.fn();
    const onSelectionChange = vi.fn();
    const handlers = createEntityPointerHandlers3D(
      hit,
      {
        pointerGestureRef: { current: { dragged: false } },
        onSelectionChange,
        onHoverChange: vi.fn()
      },
      vi.fn()
    );

    handlers.onPointerUp({ stopPropagation });

    expect(onSelectionChange).toHaveBeenCalledExactlyOnceWith(hit);
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(hit.levelId).toBe("lower");
  });

  it("retains All Levels visual-depth picking semantics", () => {
    const model = createArchitecturalScene3DModel(
      createOverlappingRoomProject()
    );
    const interactable = getInteractableLevelReferences3D(
      model,
      "all",
      "lower"
    );

    expect(interactable.map((level) => level.id)).toEqual(["lower", "upper"]);
    expect(pickNearestRoom(interactable)).toEqual({
      kind: "room",
      id: "upper-room",
      levelId: "upper"
    });
  });
});

function pickNearestRoom(
  levels: readonly LevelReference3D[]
): ArchitecturalEntityIdentity3D | undefined {
  return rayHit(createRoomMeshes(levels));
}

function rayHit(
  meshes: readonly Mesh[]
): ArchitecturalEntityIdentity3D | undefined {
  meshes.forEach((mesh) => mesh.updateMatrixWorld(true));
  return new Raycaster(
    new Vector3(2, 10, -2),
    new Vector3(0, -1, 0)
  ).intersectObjects([...meshes], false)[0]?.object.userData.identity;
}

function createRoomMeshes(levels: readonly LevelReference3D[]): Mesh[] {
  return levels.flatMap((level) =>
    level.floors.map((floor) => createRoomMesh(level, floor))
  );
}

function createRoomMesh(level: LevelReference3D, floor: Floor3D): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(createFloorSolid3D(floor).top.positions, 3)
  );
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  mesh.userData.identity = Object.freeze({
    kind: "room" as const,
    id: floor.roomId,
    levelId: level.id
  });
  return mesh;
}

function createOverlappingRoomProject(): Project {
  const initial = createInitialProject({
    projectId: "overlapping-levels",
    buildingId: "building",
    levelId: "lower",
    name: "Overlapping Room regression",
    createdAt: "2026-09-29T00:00:00.000Z"
  });
  return {
    ...initial,
    building: {
      ...initial.building,
      levels: [
        createLevel("lower", "lower-room", 0),
        createLevel("upper", "upper-room", 300)
      ]
    }
  };
}

function createLevel(id: string, roomId: string, elevation: number): Level {
  const points = [
    { x: 0, z: 0 },
    { x: 400, z: 0 },
    { x: 400, z: 400 },
    { x: 0, z: 400 }
  ];
  const walls = points.map<Wall>((start, index) => ({
    id: `${id}-wall-${index}`,
    start,
    end: points[(index + 1) % points.length]!,
    height: 280,
    thickness: 20,
    roomIds: [roomId],
    openings: []
  }));
  return {
    id,
    name: id === "lower" ? "Lower" : "Upper",
    elevation,
    walls,
    rooms: [
      {
        id: roomId,
        name: `${id} Room`,
        type: "LIVING_ROOM",
        boundary: walls.map((wall) => ({
          wallId: wall.id,
          direction: "FORWARD" as const
        }))
      }
    ],
    staircases: []
  };
}
