import {
  classifyLevelRoomTopology,
  createRoom,
  reconcileRoomSubdivision,
  type DerivedBoundedFace,
  type Identifier,
  type LevelRoomTopologyClassification,
  type Project,
  type ProjectEditingResult
} from "@casastudio/schema";

/** A bounded face that can receive a new explicit Room from the Room tool. */
export type ActionableRoomFace = DerivedBoundedFace;

/** Result of resolving and committing one visible Room candidate. */
export type RoomFaceCommit = {
  readonly face: ActionableRoomFace;
  readonly result: ProjectEditingResult;
};

/**
 * Returns faces that can receive new Room identity without presenting a face
 * that already preserves an existing Room's identity.
 */
export function collectActionableRoomFaces(
  topology: LevelRoomTopologyClassification
): readonly ActionableRoomFace[] {
  const faces = new Map(
    topology.unassigned.map((face) => [face.key, face] as const)
  );
  for (const subdivision of topology.subdivisions) {
    for (const face of subdivision.faces) {
      if (face.key !== subdivision.preservedFaceKey) {
        faces.set(face.key, face);
      }
    }
  }
  return [...faces.values()].sort((first, second) =>
    first.key.localeCompare(second.key)
  );
}

/**
 * Reclassifies current topology and commits the exact actionable face chosen
 * in the Room authoring overlay.
 */
export function commitRoomFaceCandidate(
  project: Project,
  levelId: Identifier,
  faceKey: string,
  createIdentifier: () => Identifier
): RoomFaceCommit | undefined {
  const topology = classifyLevelRoomTopology(project, levelId);
  const face = collectActionableRoomFaces(topology).find(
    (candidate) => candidate.key === faceKey
  );
  if (!face) return undefined;

  const level = project.building.levels.find(
    (candidate) => candidate.id === levelId
  );
  if (!level) return undefined;

  const subdivision = topology.subdivisions.find((candidate) =>
    candidate.faces.some((candidateFace) => candidateFace.key === face.key)
  );
  const result = subdivision
    ? reconcileRoomSubdivision(project, {
        levelId,
        roomId: subdivision.roomId,
        expectedFaceKeys: subdivision.faces.map((candidate) => candidate.key),
        newRoomAssignments: subdivision.faces
          .filter((candidate) => candidate.key !== subdivision.preservedFaceKey)
          .map((candidate, index) => ({
            faceKey: candidate.key,
            room: {
              id: createIdentifier(),
              name: `Room ${level.rooms.length + index + 1}`,
              type: "OTHER" as const
            }
          }))
      })
    : createRoom(project, {
        levelId,
        room: {
          id: createIdentifier(),
          name: `Room ${level.rooms.length + 1}`,
          type: "OTHER",
          boundary: [...face.boundary]
        }
      });

  return { face, result };
}
