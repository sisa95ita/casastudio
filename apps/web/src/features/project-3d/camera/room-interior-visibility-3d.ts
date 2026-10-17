import {
  createOpeningWorldFrame3D,
  type Floor3D,
  type Wall3D,
  type ScenePoint3D
} from "../model/architectural-scene-3d-model";
import type { FurnitureModel3D } from "../model/furniture-3d-model";
import type { Staircase3D } from "../model/staircase-3d-model";
import {
  createArchitecturalScreenProjector3D,
  type ArchitecturalCameraPose3D
} from "./architectural-camera-3d";
import {
  insidePlanPolygon3D,
  planClearance3D,
  averageInteriorPoints3D,
  createInteriorOcclusionQuery3D,
  furnitureLocalPoint3D,
  furnitureSolid3D,
  spreadInteriorPoints3D,
  type InteriorSolid3D
} from "./room-interior-geometry-3d";
import { roomInteriorCameraPolicy3D as policy } from "./room-interior-policy-3d";

export type InteriorCandidate3D = Readonly<{
  pose: ArchitecturalCameraPose3D;
  verticalFovDegrees: number;
}>;
type ArchitectureSample = Readonly<{ point: ScenePoint3D; ignoredId?: string }>;
export type InteriorVisibilityScene3D = Readonly<{
  furniture: readonly FurnitureModel3D[];
  solids: readonly InteriorSolid3D[];
  roomSamples: readonly ScenePoint3D[];
  architectureSamples: readonly ArchitectureSample[];
  blocked: ReturnType<typeof createInteriorOcclusionQuery3D>;
  wallBlocked: ReturnType<typeof createInteriorOcclusionQuery3D>;
}>;
export type FurnitureVisibility3D = Readonly<{
  id: string;
  coverage: number;
  inFrame: number;
  occluded: number;
  clipping: number;
  screenArea: number;
  weight: number;
  center: ScenePoint3D;
}>;
export type InteriorVisibility3D = Readonly<{
  furniture: readonly FurnitureVisibility3D[];
  room: readonly number[];
  architecture: readonly number[];
  proximity: number;
  nearWall: number;
}>;

export function createInteriorVisibilityScene3D(
  floor: Floor3D,
  walls: readonly Wall3D[],
  furniture: readonly FurnitureModel3D[],
  stairs: readonly Staircase3D[] = []
): InteriorVisibilityScene3D {
  const orderedFurniture = [...furniture].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const orderedWalls = [...walls].sort((a, b) => a.id.localeCompare(b.id));
  const solids: InteriorSolid3D[] = [
    ...orderedFurniture.map(furnitureSolid3D),
    ...orderedWalls.flatMap((wall) =>
      wall.bodySections.map((section, i) => ({
        id: `wall:${wall.id}:${i}`,
        contour: section.contour,
        bottom: wall.origin.y + section.bottom,
        top: wall.origin.y + section.top
      }))
    ),
    ...orderedWalls.flatMap((wall) =>
      wall.doors.map((door) => {
        const p = door.leaf;
        return {
          id: `door:${door.id}`,
          contour: [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1]
          ].map(([u, n]) => ({
            x:
              p.center.x +
              (u! * p.u.x * p.width) / 2 +
              (n! * p.n.x * p.thickness) / 2,
            z:
              p.center.z +
              (u! * p.u.z * p.width) / 2 +
              (n! * p.n.z * p.thickness) / 2
          })),
          bottom: p.center.y - p.height / 2,
          top: p.center.y + p.height / 2
        };
      })
    ),
    // Conservative stair envelope: prevents an eye inside stairs without another renderer.
    ...stairs.flatMap((stair) =>
      stair.bounds
        ? [
            {
              id: `stair:${stair.id}`,
              contour: [
                stair.bounds.min,
                { x: stair.bounds.max.x, z: stair.bounds.min.z },
                stair.bounds.max,
                { x: stair.bounds.min.x, z: stair.bounds.max.z }
              ],
              bottom: stair.bounds.min.y,
              top: stair.bounds.max.y
            }
          ]
        : []
    )
  ];
  const floorPoints = floor.triangles.flatMap((triangle) => {
    const vertices = triangle.map((i) => floor.contour[i]!);
    const center = averageInteriorPoints3D(vertices);
    return [
      center,
      ...vertices.map((v) => ({
        x: center.x * 0.65 + v.x * 0.35,
        z: center.z * 0.65 + v.z * 0.35
      }))
    ];
  });
  const roomSamples = spreadInteriorPoints3D(
    floorPoints,
    policy.maximumRoomSamples / 2
  ).flatMap((p) =>
    policy.roomSampleHeights.map((height) => ({ ...p, y: floor.y + height }))
  );
  // Opening centers and jambs remain distinct information; Wall samples use their own section ID.
  const openings = orderedWalls.flatMap((wall) =>
    wall.openings.flatMap((opening) => {
      const frame = createOpeningWorldFrame3D(wall, opening);
      return [-0.4, 0, 0.4].map((offset) => ({
        point: {
          x: frame.center.x + frame.u.x * opening.width * offset,
          y: frame.center.y,
          z: frame.center.z + frame.u.z * opening.width * offset
        }
      }));
    })
  );
  const wallSamples = orderedWalls.flatMap((wall) =>
    wall.bodySections.map((section, i) => ({
      point: {
        ...averageInteriorPoints3D(section.contour),
        y: wall.origin.y + (section.bottom + section.top) / 2
      },
      ignoredId: `wall:${wall.id}:${i}`
    }))
  );
  const architectureSamples = [
    ...openings.slice(0, policy.maximumArchitectureSamples / 2),
    ...spreadInteriorPoints3D(
      wallSamples.map((s) => ({ ...s, ...s.point })),
      policy.maximumArchitectureSamples -
        Math.min(openings.length, policy.maximumArchitectureSamples / 2)
    )
  ];
  // All objects remain collision/occlusion evidence. Only detailed scoring is capped.
  const analyzedFurniture =
    orderedFurniture.length <= policy.maximumFurniture
      ? orderedFurniture
      : spreadInteriorPoints3D(
          orderedFurniture.map((f) => ({ ...f, ...f.position })),
          policy.maximumFurniture
        );
  return {
    furniture: analyzedFurniture,
    solids,
    roomSamples,
    architectureSamples,
    blocked: createInteriorOcclusionQuery3D(
      solids,
      policy.maximumRaySolidTests
    ),
    wallBlocked: createInteriorOcclusionQuery3D(
      solids.filter((solid) => solid.id.startsWith("wall:")),
      policy.maximumRaySolidTests
    )
  };
}

/** At most three camera-facing faces × nine surface points; dimensions and yaw stay canonical. */
export function furnitureFacingSamples3D(
  item: FurnitureModel3D,
  eye: ScenePoint3D
): ScenePoint3D[] {
  const dx = eye.x - item.position.x,
    dz = eye.z - item.position.z;
  const c = Math.cos(item.yaw),
    s = Math.sin(item.yaw);
  const localEye = {
    x: dx * c - dz * s,
    y: eye.y - item.position.y,
    z: dx * s + dz * c
  };
  const samples: ScenePoint3D[] = [];
  const fractions = policy.surfaceFractions;
  if (Math.abs(localEye.x) > item.width / 2)
    for (const y of fractions)
      for (const z of fractions)
        samples.push(
          furnitureLocalPoint3D(
            item,
            (Math.sign(localEye.x) * item.width) / 2,
            (y + 0.5) * item.height,
            z * item.depth
          )
        );
  if (Math.abs(localEye.z) > item.depth / 2)
    for (const x of fractions)
      for (const y of fractions)
        samples.push(
          furnitureLocalPoint3D(
            item,
            x * item.width,
            (y + 0.5) * item.height,
            (Math.sign(localEye.z) * item.depth) / 2
          )
        );
  if (localEye.y > item.height || localEye.y < 0)
    for (const x of fractions)
      for (const z of fractions)
        samples.push(
          furnitureLocalPoint3D(
            item,
            x * item.width,
            localEye.y > item.height ? item.height : 0,
            z * item.depth
          )
        );
  return samples;
}

export function analyzeFurnitureVisibility3D(
  scene: InteriorVisibilityScene3D,
  item: FurnitureModel3D,
  candidate: InteriorCandidate3D,
  aspect: number,
  project = createArchitecturalScreenProjector3D(
    candidate.pose,
    aspect,
    candidate.verticalFovDegrees
  )
): FurnitureVisibility3D {
  const { pose } = candidate;
  const samples = furnitureFacingSamples3D(item, pose.position);
  const projections = samples.map(project);
  const inFrame = (p: (typeof projections)[number]) =>
    p &&
    p.depth >= pose.near &&
    p.depth <= pose.far &&
    Math.abs(p.x) <= 1 &&
    Math.abs(p.y) <= 1;
  const framed = projections.filter(inFrame).length / (samples.length || 1);
  let visible = 0;
  samples.forEach((p, i) => {
    if (
      inFrame(projections[i]) &&
      !scene.blocked(pose.position, p, `furniture:${item.id}`)
    )
      visible++;
  });
  const corners = [-0.5, 0.5].flatMap((x) =>
    [-0.5, 0.5].flatMap((z) =>
      [0, 1].map((y) =>
        project(
          furnitureLocalPoint3D(
            item,
            x * item.width,
            y * item.height,
            z * item.depth
          )
        )
      )
    )
  );
  const projected = corners.filter((p) => p !== undefined);
  let screenArea = 0;
  if (projected.length) {
    const width = Math.max(
      0,
      Math.min(1, Math.max(...projected.map((p) => p.x))) -
        Math.max(-1, Math.min(...projected.map((p) => p.x)))
    );
    const height = Math.max(
      0,
      Math.min(1, Math.max(...projected.map((p) => p.y))) -
        Math.max(-1, Math.min(...projected.map((p) => p.y)))
    );
    screenArea = (width * height) / 4;
  }
  const clipping =
    corners.filter(
      (p) =>
        !p ||
        p.depth < pose.near ||
        p.depth > pose.far ||
        Math.abs(p.x) > policy.frameMargin ||
        Math.abs(p.y) > policy.frameMargin
    ).length / 8;
  const coverage =
    (visible / (samples.length || 1)) *
    Math.min(1, screenArea / policy.usefulScreenArea);
  return {
    id: item.id,
    coverage,
    inFrame: framed,
    occluded: Math.max(0, framed - visible / (samples.length || 1)),
    clipping,
    screenArea,
    weight: Math.sqrt(item.width * item.depth),
    center: { ...item.position, y: item.position.y + item.height / 2 }
  };
}

export function analyzeInteriorVisibility3D(
  scene: InteriorVisibilityScene3D,
  candidate: InteriorCandidate3D,
  aspect: number
): InteriorVisibility3D {
  const { pose, verticalFovDegrees } = candidate;
  const project = createArchitecturalScreenProjector3D(
    pose,
    aspect,
    verticalFovDegrees
  );
  const visible = (point: ScenePoint3D, ignoredId?: string): number => {
    const p = project(point);
    return p &&
      p.depth >= pose.near &&
      p.depth <= pose.far &&
      Math.abs(p.x) <= 1 &&
      Math.abs(p.y) <= 1 &&
      !scene.blocked(pose.position, point, ignoredId)
      ? 1
      : 0;
  };
  const furniture = scene.furniture.map((item) =>
    analyzeFurnitureVisibility3D(scene, item, candidate, aspect, project)
  );
  const nearest = Math.min(
    ...scene.solids
      .filter((s) => s.id.startsWith("furniture:"))
      .map((s) => {
        const inside = insidePlanPolygon3D(pose.position, s.contour);
        return inside ? 0 : planClearance3D(pose.position, s.contour);
      })
  );
  const forward = {
    x: pose.target.x - pose.position.x,
    z: pose.target.z - pose.position.z
  };
  const length = Math.hypot(forward.x, forward.z) || 1;
  // Short rays across the image detect a nearby wall-dominated composition, not normal distant walls.
  const nearWall =
    [-0.7, 0, 0.7]
      .flatMap((x) =>
        [-0.4, 0.4].map((y) => {
          const scale = Math.tan((verticalFovDegrees * Math.PI) / 360);
          const end = {
            x:
              pose.position.x +
              forward.x / length -
              ((x * forward.z) / length) * scale * aspect,
            y: pose.position.y + y * scale,
            z:
              pose.position.z +
              forward.z / length +
              ((x * forward.x) / length) * scale * aspect
          };
          return scene.wallBlocked(pose.position, end) ? 1 : 0;
        })
      )
      .reduce<number>((a, b) => a + b, 0) / 6;
  return {
    furniture,
    room: scene.roomSamples.map((p) => visible(p)),
    architecture: scene.architectureSamples.map((s) =>
      visible(s.point, s.ignoredId)
    ),
    proximity: Math.max(0, 1 - nearest / policy.preferredFurnitureClearance),
    nearWall
  };
}
