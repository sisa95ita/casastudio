import {
  resolveBuiltinFurnitureDefinition,
  resolveFurnitureRoom,
  type FurnitureItem,
  type Point2D,
  type Project
} from "@casastudio/schema";
import { createFurnitureFootprint2D } from "./plan-footprints-2d";

/** Immutable plan symbol in canonical X/Z, independent of the renderer and selection styling. */
export type FurniturePresentationModel2D = {
  readonly id: string;
  readonly roomId: string;
  readonly definitionId: string;
  readonly category: string;
  readonly name: string;
  readonly center: Readonly<Point2D>;
  readonly rotation: number;
  readonly width: number;
  readonly depth: number;
  readonly footprint: readonly Readonly<Point2D>[];
  readonly lines: readonly (readonly Readonly<Point2D>[])[];
  readonly rotationHandle: Readonly<Point2D>;
};

/** Builds a centered, arbitrarily rotated semantic vector symbol from effective instance dimensions. */
export function createFurniturePresentation2D(
  item: FurnitureItem
): FurniturePresentationModel2D {
  const definition = resolveBuiltinFurnitureDefinition(item.definitionId);
  const category = definition?.category ?? "GENERIC";
  const angle = (item.rotation * Math.PI) / 180;
  // Positive Y right-hand rotation: local +X turns toward world -Z.
  const point = (x: number, z: number) =>
    Object.freeze({
      x:
        item.position.x +
        x * item.width * Math.cos(angle) +
        z * item.depth * Math.sin(angle),
      z:
        item.position.z -
        x * item.width * Math.sin(angle) +
        z * item.depth * Math.cos(angle)
    });
  const rect = (x: number, z: number, w: number, d: number) => [
    [x, z],
    [x + w, z],
    [x + w, z + d],
    [x, z + d],
    [x, z]
  ];
  const templates: Record<string, number[][][]> = {
    BED: [rect(-0.43, -0.43, 0.86, 0.68), rect(-0.37, 0.29, 0.74, 0.15)],
    SOFA: [
      rect(-0.38, -0.38, 0.76, 0.6),
      [
        [-0.38, 0.22],
        [0.38, 0.22]
      ],
      [
        [0, -0.38],
        [0, 0.22]
      ],
      [
        [-0.38, -0.38],
        [-0.38, 0.42]
      ],
      [
        [0.38, -0.38],
        [0.38, 0.42]
      ]
    ],
    TABLE: [rect(-0.43, -0.4, 0.86, 0.8)],
    CHAIR: [
      rect(-0.38, -0.4, 0.76, 0.65),
      [
        [-0.5, 0.32],
        [0.5, 0.32]
      ]
    ],
    CABINET: [
      [
        [0, -0.5],
        [0, 0.5]
      ],
      [
        [-0.08, -0.08],
        [-0.08, 0.08]
      ],
      [
        [0.08, -0.08],
        [0.08, 0.08]
      ]
    ],
    DESK: [
      rect(0.22, -0.42, 0.2, 0.84),
      [
        [-0.42, 0.28],
        [0.18, 0.28]
      ]
    ],
    GENERIC: []
  };
  return Object.freeze({
    id: item.id,
    roomId: item.roomId,
    definitionId: item.definitionId,
    category,
    name: item.name ?? definition?.name ?? "Unknown Furniture",
    center: Object.freeze({ ...item.position }),
    rotation: item.rotation,
    width: item.width,
    depth: item.depth,
    footprint: createFurnitureFootprint2D(item),
    lines: Object.freeze(
      templates[category]!.map((line) =>
        Object.freeze(line.map(([x, z]) => point(x!, z!)))
      )
    ),
    rotationHandle: point(0, 0.5 + 25 / item.depth)
  });
}

/** Presents Furniture through Room-derived Level ownership in stable persisted order (last drawn wins hits). */
export function createFurniturePlan2D(
  project: Project,
  levelId: string
): readonly FurniturePresentationModel2D[] {
  return Object.freeze(
    project.building.furniture
      .filter(
        (item) => resolveFurnitureRoom(project, item)?.level.id === levelId
      )
      .map(createFurniturePresentation2D)
  );
}
