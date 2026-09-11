import {
  resolveBuiltinFurnitureDefinition,
  resolveFurnitureRoom,
  type FurnitureItem,
  type Point2D,
  type Project
} from "@casastudio/schema";
import { createFurnitureFootprint2D } from "./plan-footprints-2d";

export type FurnitureSymbolKind2D =
  | "BED"
  | "SOFA"
  | "TABLE"
  | "CHAIR"
  | "CABINET"
  | "DESK"
  | "GENERIC";

export type FurnitureSymbolPrimitiveRole2D =
  | "mattress"
  | "pillow"
  | "head"
  | "seat"
  | "back"
  | "arm"
  | "tabletop"
  | "leg"
  | "worktop"
  | "front"
  | "pedestal"
  | "storage-panel"
  | "door-seam"
  | "handle"
  | "generic-mark";

/** Semantic plan cue, transformed into Project X/Z alongside the Furniture footprint. */
export type FurnitureSymbolPrimitive2D = {
  readonly role: FurnitureSymbolPrimitiveRole2D;
  readonly shape: "line" | "area";
  readonly points: readonly Readonly<Point2D>[];
};

/** Immutable plan symbol in canonical X/Z, independent of the renderer and selection styling. */
export type FurniturePresentationModel2D = {
  readonly id: string;
  readonly roomId: string;
  readonly definitionId: string;
  readonly category: FurnitureSymbolKind2D;
  readonly symbolKind: FurnitureSymbolKind2D;
  readonly name: string;
  readonly center: Readonly<Point2D>;
  readonly rotation: number;
  readonly width: number;
  readonly depth: number;
  readonly footprint: readonly Readonly<Point2D>[];
  readonly primitives: readonly FurnitureSymbolPrimitive2D[];
  /** Compatibility projection for spatial/rendering consumers that only need paths. */
  readonly lines: readonly (readonly Readonly<Point2D>[])[];
  readonly rotationHandle: Readonly<Point2D>;
};

/** Builds a centered, arbitrarily rotated semantic vector symbol from effective instance dimensions. */
export function createFurniturePresentation2D(
  item: FurnitureItem
): FurniturePresentationModel2D {
  const definition = resolveBuiltinFurnitureDefinition(item.definitionId);
  const category = (definition?.category ?? "GENERIC") as FurnitureSymbolKind2D;
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
  const rect = (x: number, z: number, w: number, d: number): number[][] => [
    [x, z],
    [x + w, z],
    [x + w, z + d],
    [x, z + d],
    [x, z]
  ];
  type LocalPrimitive = {
    readonly role: FurnitureSymbolPrimitiveRole2D;
    readonly shape: "line" | "area";
    readonly points: number[][];
  };
  const line = (
    role: FurnitureSymbolPrimitiveRole2D,
    points: number[][]
  ): LocalPrimitive => ({ role, shape: "line", points });
  const area = (
    role: FurnitureSymbolPrimitiveRole2D,
    points: number[][]
  ): LocalPrimitive => ({ role, shape: "area", points });
  const pillows =
    item.width >= Math.min(120, item.depth)
      ? [
          area("pillow", rect(-0.37, 0.25, 0.34, 0.16)),
          area("pillow", rect(0.03, 0.25, 0.34, 0.16))
        ]
      : [area("pillow", rect(-0.3, 0.25, 0.6, 0.16))];
  const templates: Record<FurnitureSymbolKind2D, readonly LocalPrimitive[]> = {
    BED: [
      area("mattress", rect(-0.43, -0.43, 0.86, 0.84)),
      ...pillows,
      line("head", [[-0.45, 0.43], [0.45, 0.43]])
    ],
    SOFA: [
      area("seat", rect(-0.34, -0.33, 0.68, 0.55)),
      area("arm", rect(-0.46, -0.38, 0.12, 0.72)),
      area("arm", rect(0.34, -0.38, 0.12, 0.72)),
      line("back", [[-0.4, 0.34], [0.4, 0.34]]),
      line("seat", [[0, -0.33], [0, 0.22]])
    ],
    TABLE: [
      area("tabletop", rect(-0.43, -0.4, 0.86, 0.8)),
      line("leg", [[-0.35, -0.31], [-0.27, -0.23]]),
      line("leg", [[0.35, -0.31], [0.27, -0.23]]),
      line("leg", [[-0.35, 0.31], [-0.27, 0.23]]),
      line("leg", [[0.35, 0.31], [0.27, 0.23]])
    ],
    CHAIR: [
      area("seat", rect(-0.36, -0.38, 0.72, 0.62)),
      line("back", [[-0.46, 0.34], [0.46, 0.34]]),
      line("back", [[-0.4, 0.27], [0.4, 0.27]])
    ],
    CABINET: [
      area("storage-panel", rect(-0.43, -0.4, 0.86, 0.8)),
      line("front", [[-0.43, -0.29], [0.43, -0.29]]),
      line("door-seam", [[0, -0.29], [0, 0.4]]),
      line("handle", [[-0.06, -0.08], [-0.06, 0.05]]),
      line("handle", [[0.06, -0.08], [0.06, 0.05]])
    ],
    DESK: [
      area("worktop", rect(-0.43, -0.4, 0.86, 0.8)),
      line("front", [[-0.36, 0.27], [0.36, 0.27]]),
      area("pedestal", rect(0.2, -0.31, 0.16, 0.48))
    ],
    GENERIC: [
      line("generic-mark", [[-0.28, -0.28], [0.28, 0.28]]),
      line("generic-mark", [[0.28, -0.28], [-0.28, 0.28]])
    ]
  };
  const primitives = Object.freeze(
    templates[category].map((primitive) =>
      Object.freeze({
        role: primitive.role,
        shape: primitive.shape,
        points: Object.freeze(
          primitive.points.map(([x, z]) => point(x!, z!))
        )
      })
    )
  );
  return Object.freeze({
    id: item.id,
    roomId: item.roomId,
    definitionId: item.definitionId,
    category,
    symbolKind: category,
    name: item.name ?? definition?.name ?? "Unknown Furniture",
    center: Object.freeze({ ...item.position }),
    rotation: item.rotation,
    width: item.width,
    depth: item.depth,
    footprint: createFurnitureFootprint2D(item),
    primitives,
    lines: Object.freeze(primitives.map((primitive) => primitive.points)),
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
