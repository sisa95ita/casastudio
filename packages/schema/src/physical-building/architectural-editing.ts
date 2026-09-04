import { ProjectSchema, type Project } from "../project/index.js";
import {
  IdentifierSchema,
  Point2DSchema,
  type Identifier,
  type Point2D
} from "../primitives/index.js";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  ValidationErrorCode,
  type ValidationError
} from "../validation/index.js";
import { RoomSchema, type Room, type RoomBoundaryEdge } from "./room.js";
import type { Wall } from "./wall.js";
import type { ProjectEditingResult } from "./wall-editing.js";

/** A simple bounded face derived from a Level's exact Wall endpoint graph. */
export type DerivedBoundedFace = {
  readonly key: string;
  readonly levelId: Identifier;
  readonly boundary: readonly RoomBoundaryEdge[];
  readonly vertices: readonly Point2D[];
  readonly area: number;
  readonly centroid: Point2D;
};

/** A bounded face that is not currently represented by an explicit Room. */
export type RoomCandidate = DerivedBoundedFace;

/** A bounded face whose canonical boundary exactly matches an explicit Room. */
export type RepresentedBoundedFace = {
  readonly face: DerivedBoundedFace;
  readonly roomId: Identifier;
};

/** An explicit Room that can be reconciled into current bounded faces. */
export type RoomSubdivision = {
  readonly key: string;
  readonly levelId: Identifier;
  readonly roomId: Identifier;
  readonly faces: readonly DerivedBoundedFace[];
  readonly preservedFaceKey: string;
};

/** A topology condition that prevents safe Room-to-face reconciliation. */
export type RoomTopologyIssue = {
  readonly kind: "AMBIGUOUS_FACE_OWNERSHIP" | "UNRECONCILED_ROOM_BOUNDARY";
  readonly levelId: Identifier;
  readonly roomIds: readonly Identifier[];
  readonly faceKeys: readonly string[];
};

/** Read-only classification of current bounded faces against explicit Rooms. */
export type LevelRoomTopologyClassification = {
  readonly levelId: Identifier;
  readonly faces: readonly DerivedBoundedFace[];
  readonly represented: readonly RepresentedBoundedFace[];
  readonly unassigned: readonly DerivedBoundedFace[];
  readonly subdivisions: readonly RoomSubdivision[];
  readonly issues: readonly RoomTopologyIssue[];
};

/** Existing Room and Wall pair that can be explicitly partitioned. */
export type RoomPartitionCandidate = {
  readonly key: string;
  readonly levelId: Identifier;
  readonly roomId: Identifier;
  readonly partitionWallId: Identifier;
  readonly boundaries: readonly [readonly RoomBoundaryEdge[], readonly RoomBoundaryEdge[]];
};

/** Input for adding an explicit Room from a caller-selected wall cycle. */
export type CreateRoomInput = {
  readonly levelId: Identifier;
  readonly room: Room;
};

/** Input for dividing one Room with an existing boundary-to-boundary Wall. */
export type PartitionRoomInput = {
  readonly levelId: Identifier;
  readonly roomId: Identifier;
  readonly partitionWallId: Identifier;
  readonly newRoom: Omit<Room, "boundary">;
};

/** Assigns caller-supplied Room state to one derived subdivision face. */
export type NewRoomFaceAssignment = {
  readonly faceKey: string;
  readonly room: Omit<Room, "boundary">;
};

/** Input for atomically reconciling one Room into its current bounded faces. */
export type ReconcileRoomSubdivisionInput = {
  readonly levelId: Identifier;
  readonly roomId: Identifier;
  readonly expectedFaceKeys: readonly string[];
  readonly newRoomAssignments: readonly NewRoomFaceAssignment[];
};

/** Input for removing one Room while retaining its physical Walls. */
export type DeleteRoomInput = {
  readonly levelId: Identifier;
  readonly roomId: Identifier;
};

/** Input for absorbing one Room into its uniquely adjacent explicit Room. */
export type DissolveRoomInput = {
  readonly levelId: Identifier;
  readonly roomId: Identifier;
};

/** Canonical Room properties supported by semantic property editing. */
export type UpdateRoomProperties = Pick<Room, "name" | "type" | "elevation">;

/** Input for replacing the editable metadata of one exact Room. */
export type UpdateRoomPropertiesInput = {
  readonly levelId: Identifier;
  readonly roomId: Identifier;
  readonly name?: Room["name"];
  readonly type?: Room["type"];
  readonly elevation?: Room["elevation"];
};

/** Input for moving every Wall endpoint incident to one exact canonical point. */
export type MoveJunctionInput = {
  readonly levelId: Identifier;
  readonly position: Point2D;
  readonly destination: Point2D;
  readonly incidentWallIds: readonly Identifier[];
};

type DirectedWallUse = {
  readonly wall: Wall;
  readonly from: Point2D;
  readonly to: Point2D;
  readonly direction: RoomBoundaryEdge["direction"];
};

/**
 * Derives every bounded simple face in a Level's exact endpoint graph.
 *
 * Results are ephemeral, canonical counter-clockwise boundaries sorted by a
 * stable boundary key. Explicit Room state does not affect face derivation.
 */
export function deriveBoundedFaces(
  project: Project,
  levelId: Identifier
): readonly DerivedBoundedFace[] {
  const level = project.building.levels.find((candidate) => candidate.id === levelId);
  if (!level) return [];

  const outgoing = new Map<string, DirectedWallUse[]>();
  for (const wall of level.walls) {
    addDirectedUse(outgoing, {
      wall,
      from: wall.start,
      to: wall.end,
      direction: "FORWARD"
    });
    addDirectedUse(outgoing, {
      wall,
      from: wall.end,
      to: wall.start,
      direction: "REVERSE"
    });
  }
  outgoing.forEach((uses) =>
    uses.sort(
      (first, second) =>
        angle(first.from, first.to) - angle(second.from, second.to) ||
        first.wall.id.localeCompare(second.wall.id)
    )
  );

  const visited = new Set<string>();
  const faces = new Map<string, DerivedBoundedFace>();

  for (const uses of outgoing.values()) {
    for (const initial of uses) {
      const initialKey = directedUseKey(initial);
      if (visited.has(initialKey)) continue;
      const cycle: DirectedWallUse[] = [];
      const local = new Set<string>();
      let current: DirectedWallUse | undefined = initial;

      while (current && !local.has(directedUseKey(current))) {
        const key = directedUseKey(current);
        local.add(key);
        visited.add(key);
        cycle.push(current);
        current = nextFaceUse(current, outgoing);
      }
      if (!current || directedUseKey(current) !== initialKey || cycle.length < 3) continue;

      const vertices = cycle.map((use) => use.from);
      const area = signedArea(vertices);
      if (area <= 0 || !isSimplePolygon(vertices)) continue;
      const boundary = canonicalizeDirectedCycle(
        cycle.map((use) => ({ wallId: use.wall.id, direction: use.direction })),
        level.walls
      );
      if (!boundary) continue;
      const key = boundaryKey(boundary);
      if (faces.has(key)) continue;
      const canonicalVertices = getBoundaryVertices(boundary, level.walls);
      const canonicalArea = signedArea(canonicalVertices);
      const centroid = polygonCentroid(canonicalVertices, canonicalArea);
      if (!centroid) continue;
      faces.set(key, {
        key,
        levelId,
        boundary,
        vertices: canonicalVertices,
        area: canonicalArea,
        centroid
      });
    }
  }

  return [...faces.values()].sort((first, second) => first.key.localeCompare(second.key));
}

/**
 * Classifies derived bounded faces against the Level's explicit Rooms.
 *
 * A subdivision is reported only when two or more faces are contained by one
 * Room boundary and their total area equals the Room polygon area. Ambiguous
 * face ownership is reported instead of assigning architectural meaning.
 */
export function classifyLevelRoomTopology(
  project: Project,
  levelId: Identifier
): LevelRoomTopologyClassification {
  const level = project.building.levels.find((candidate) => candidate.id === levelId);
  const faces = deriveBoundedFaces(project, levelId);
  if (!level) {
    return { levelId, faces, represented: [], unassigned: [], subdivisions: [], issues: [] };
  }

  const roomPolygons = level.rooms.flatMap((room) => {
    const boundary = canonicalizeCycle(room.boundary, level.walls);
    if (!boundary) return [];
    const vertices = getBoundaryVertices(boundary, level.walls);
    const area = Math.abs(signedArea(vertices));
    const centroid = polygonCentroid(vertices);
    if (!centroid) return [];
    return [{ room, key: boundaryKey(boundary), vertices, area, centroid }];
  });
  const exactOwners = new Map<string, Identifier[]>();
  for (const polygon of roomPolygons) {
    const owners = exactOwners.get(polygon.key) ?? [];
    owners.push(polygon.room.id);
    exactOwners.set(polygon.key, owners);
  }

  const represented: RepresentedBoundedFace[] = [];
  const issues: RoomTopologyIssue[] = [];
  const claimedBySubdivision = new Map<string, Identifier[]>();
  const faceKeys = new Set(faces.map((face) => face.key));
  for (const face of faces) {
    const owners = exactOwners.get(face.key) ?? [];
    if (owners.length === 1) represented.push({ face, roomId: owners[0]! });
    if (owners.length > 1) {
      issues.push({
        kind: "AMBIGUOUS_FACE_OWNERSHIP",
        levelId,
        roomIds: [...owners].sort(),
        faceKeys: [face.key]
      });
    }
  }

  const subdivisions: RoomSubdivision[] = [];
  for (const polygon of roomPolygons) {
    if (faceKeys.has(polygon.key)) continue;
    const contained = faces.filter((face) =>
      face.vertices.every((vertex) => pointInPolygon(vertex, polygon.vertices) !== "OUTSIDE")
    );
    const coveredArea = contained.reduce((sum, face) => sum + face.area, 0);
    if (
      contained.length >= 2 &&
      nearlyEqual(coveredArea, polygon.area)
    ) {
      const sortedFaces = [...contained].sort((first, second) => first.key.localeCompare(second.key));
      subdivisions.push({
        key: `${polygon.room.id}:${sortedFaces.map((face) => face.key).join(";")}`,
        levelId,
        roomId: polygon.room.id,
        faces: sortedFaces,
        preservedFaceKey: selectIdentityPreservingFace(sortedFaces, polygon.centroid).key
      });
      for (const face of sortedFaces) {
        const owners = claimedBySubdivision.get(face.key) ?? [];
        owners.push(polygon.room.id);
        claimedBySubdivision.set(face.key, owners);
      }
    } else {
      issues.push({
        kind: "UNRECONCILED_ROOM_BOUNDARY",
        levelId,
        roomIds: [polygon.room.id],
        faceKeys: contained.map((face) => face.key).sort()
      });
    }
  }

  for (const [faceKey, owners] of claimedBySubdivision) {
    if (owners.length > 1) {
      issues.push({
        kind: "AMBIGUOUS_FACE_OWNERSHIP",
        levelId,
        roomIds: [...owners].sort(),
        faceKeys: [faceKey]
      });
    }
  }
  const ambiguousFaces = new Set(
    issues.filter((issue) => issue.kind === "AMBIGUOUS_FACE_OWNERSHIP")
      .flatMap((issue) => issue.faceKeys)
  );
  const validSubdivisions = subdivisions.filter((subdivision) =>
    subdivision.faces.every((face) => !ambiguousFaces.has(face.key))
  );
  const assignedKeys = new Set([
    ...represented.map(({ face }) => face.key),
    ...validSubdivisions.flatMap((subdivision) => subdivision.faces.map((face) => face.key))
  ]);

  return {
    levelId,
    faces,
    represented: represented.sort((a, b) => a.face.key.localeCompare(b.face.key)),
    unassigned: faces.filter((face) => !assignedKeys.has(face.key) && !ambiguousFaces.has(face.key)),
    subdivisions: validSubdivisions.sort((a, b) => a.key.localeCompare(b.key)),
    issues: issues.sort((a, b) =>
      `${a.kind}:${a.roomIds.join("|")}:${a.faceKeys.join("|")}`.localeCompare(
        `${b.kind}:${b.roomIds.join("|")}:${b.faceKeys.join("|")}`
      )
    )
  };
}

/** Discovers bounded faces that are not represented by or subdividing a Room. */
export function discoverRoomCandidates(
  project: Project,
  levelId: Identifier
): readonly RoomCandidate[] {
  return classifyLevelRoomTopology(project, levelId).unassigned;
}

/** Discovers two-face subdivisions produced by exactly one shared internal Wall. */
export function discoverRoomPartitionCandidates(
  project: Project,
  levelId: Identifier
): readonly RoomPartitionCandidate[] {
  const level = project.building.levels.find((candidate) => candidate.id === levelId);
  if (!level) return [];
  return classifyLevelRoomTopology(project, levelId).subdivisions.flatMap((subdivision) => {
    if (subdivision.faces.length !== 2) return [];
    const room = level.rooms.find((candidate) => candidate.id === subdivision.roomId);
    if (!room) return [];
    const roomWallIds = new Set(room.boundary.map((edge) => edge.wallId));
    const firstIds = new Set(subdivision.faces[0]!.boundary.map((edge) => edge.wallId));
    const sharedInternalWalls = subdivision.faces[1]!.boundary
      .map((edge) => edge.wallId)
      .filter((wallId) => firstIds.has(wallId) && !roomWallIds.has(wallId));
    if (sharedInternalWalls.length !== 1) return [];
    return [{
      key: `${subdivision.roomId}:${sharedInternalWalls[0]}`,
      levelId,
      roomId: subdivision.roomId,
      partitionWallId: sharedInternalWalls[0]!,
      boundaries: [subdivision.faces[0]!.boundary, subdivision.faces[1]!.boundary]
    }];
  });
}

/**
 * Adds one explicit Room and updates reciprocal Wall references atomically.
 *
 * The supplied boundary may begin at any edge and use either winding. The
 * operation persists the unique deterministic counter-clockwise traversal.
 */
export function createRoom(project: Project, input: CreateRoomInput): ProjectEditingResult {
  const levelIndex = findLevelIndex(project, input.levelId);
  if (levelIndex < 0) return failure(levelNotFound(input.levelId));
  const level = project.building.levels[levelIndex]!;
  const identifier = IdentifierSchema.safeParse(input.room.id);
  if (!identifier.success) return failure(invalidIdentifier("room.id", "Room"));
  const duplicateRoom = project.building.levels.some((candidate) =>
    candidate.rooms.some((room) => room.id === input.room.id)
  );
  if (duplicateRoom) {
    return failure({
      code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
      path: "room.id",
      message: `Room identifier "${input.room.id}" is already in use.`
    });
  }
  const parsedRoom = RoomSchema.safeParse(input.room);
  if (!parsedRoom.success || input.room.boundary.length < 3) {
    return failure(invalidRoomBoundary("room.boundary", input.room.id));
  }
  const boundary = canonicalizeCycle(input.room.boundary, level.walls);
  if (!boundary) return failure(invalidRoomBoundary("room.boundary", input.room.id));
  const key = boundaryKey(boundary);
  if (!deriveBoundedFaces(project, input.levelId).some((face) => face.key === key)) {
    return failure({
      code: ValidationErrorCode.STALE_ROOM_TOPOLOGY,
      path: "room.boundary",
      message: "The selected Room boundary is no longer a bounded face of the current Wall graph."
    });
  }
  const identity = boundaryIdentity(boundary);
  if (level.rooms.some((room) => boundaryIdentity(room.boundary) === identity)) {
    return failure({
      code: ValidationErrorCode.DUPLICATE_ROOM_BOUNDARY,
      path: "room.boundary",
      message: "A Room already uses this exact canonical boundary."
    });
  }

  const room = { ...parsedRoom.data, boundary };
  const candidate = mapLevel(project, levelIndex, (current) => {
    const rooms = [...current.rooms, room];
    return { ...current, rooms, walls: rebuildWallRoomIds(current.walls, rooms) };
  });
  return validateCanonicalResult(candidate, "Room creation");
}

/**
 * Reconciles one explicit Room into the bounded faces that cover its polygon.
 *
 * The face strictly containing the former polygon centroid retains the Room's
 * identity and metadata. If containment is not unique, the largest face wins;
 * equal areas are resolved by centroid distance and then stable face key.
 * Caller-provided face keys guard against committing stale topology. Each
 * additional Room is associated with its face explicitly, independent of
 * assignment array order.
 */
export function reconcileRoomSubdivision(
  project: Project,
  input: ReconcileRoomSubdivisionInput
): ProjectEditingResult {
  const levelIndex = findLevelIndex(project, input.levelId);
  if (levelIndex < 0) return failure(levelNotFound(input.levelId));
  const level = project.building.levels[levelIndex]!;
  const roomIndex = level.rooms.findIndex((room) => room.id === input.roomId);
  if (roomIndex < 0) return failure(roomNotFound(input.levelId, input.roomId));
  const room = level.rooms[roomIndex]!;
  const subdivision = classifyLevelRoomTopology(project, input.levelId).subdivisions
    .find((candidate) => candidate.roomId === input.roomId);
  if (!subdivision) {
    return failure({
      code: ValidationErrorCode.ROOM_SUBDIVISION_NOT_FOUND,
      path: "roomId",
      message: `Room "${room.id}" does not currently resolve to multiple bounded faces.`
    });
  }
  const actualFaceKeys = subdivision.faces.map((face) => face.key).sort();
  const expectedFaceKeys = [...new Set(input.expectedFaceKeys)].sort();
  if (
    actualFaceKeys.length !== expectedFaceKeys.length ||
    actualFaceKeys.some((key, index) => key !== expectedFaceKeys[index])
  ) {
    return failure({
      code: ValidationErrorCode.STALE_ROOM_TOPOLOGY,
      path: "expectedFaceKeys",
      message: "The bounded faces changed before Room reconciliation was committed."
    });
  }
  if (input.newRoomAssignments.length !== subdivision.faces.length - 1) {
    return failure({
      code: ValidationErrorCode.INVALID_ROOM_SUBDIVISION_INPUT,
      path: "newRoomAssignments",
      message: "Room reconciliation requires one caller-supplied Room for every additional face."
    });
  }
  const suppliedIds = input.newRoomAssignments.map((assignment) => assignment.room.id);
  if (suppliedIds.some((id) => !IdentifierSchema.safeParse(id).success)) {
    return failure(invalidIdentifier("newRoomAssignments.room.id", "Room"));
  }
  if (new Set(suppliedIds).size !== suppliedIds.length || suppliedIds.includes(room.id) ||
    project.building.levels.some((candidate) =>
      candidate.rooms.some((existing) => suppliedIds.includes(existing.id))
    )) {
    return failure({
      code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
      path: "newRoomAssignments.room.id",
      message: "Every new Room identifier must be unique across the Project."
    });
  }
  const assignmentFaceKeys = input.newRoomAssignments.map((assignment) => assignment.faceKey);
  const expectedAssignmentFaceKeys = subdivision.faces
    .filter((face) => face.key !== subdivision.preservedFaceKey)
    .map((face) => face.key)
    .sort();
  if (
    new Set(assignmentFaceKeys).size !== assignmentFaceKeys.length ||
    [...assignmentFaceKeys].sort().some((key, index) => key !== expectedAssignmentFaceKeys[index])
  ) {
    return failure({
      code: ValidationErrorCode.INVALID_ROOM_SUBDIVISION_INPUT,
      path: "newRoomAssignments.faceKey",
      message: "Every non-preserved subdivision face requires one explicit Room assignment."
    });
  }

  const preservedFace = subdivision.faces.find(
    (face) => face.key === subdivision.preservedFaceKey
  );
  if (!preservedFace) return failure(invalidRoomBoundary("roomId", room.id));
  const additionalFaces = subdivision.faces.filter((face) => face.key !== preservedFace.key);
  const assignmentsByFaceKey = new Map(
    input.newRoomAssignments.map((assignment) => [assignment.faceKey, assignment.room])
  );
  const faceRoomIds = new Map<string, Identifier>([[preservedFace.key, room.id]]);
  const parsedNewRooms: Room[] = [];
  for (const [index, face] of additionalFaces.entries()) {
    const assignedRoom = assignmentsByFaceKey.get(face.key)!;
    const parsed = RoomSchema.safeParse({ ...assignedRoom, boundary: [...face.boundary] });
    if (!parsed.success) {
      return failure(invalidRoomBoundary(`newRoomAssignments[${index}]`, assignedRoom.id));
    }
    parsedNewRooms.push(parsed.data);
    faceRoomIds.set(face.key, parsed.data.id);
  }
  const rooms = level.rooms.map((candidate, index) =>
    index === roomIndex ? { ...candidate, boundary: [...preservedFace.boundary] } : candidate
  );
  rooms.push(...parsedNewRooms);
  const rebuiltWalls = rebuildWallRoomIds(level.walls, rooms);
  const doorResult = reconcileDoorRoomReferences(
    rebuiltWalls,
    room.id,
    subdivision.faces,
    faceRoomIds,
    levelIndex
  );
  if (!doorResult.ok) return failure(doorResult.error);
  const viewpointResult = reconcileViewpointRoomReferences(
    project,
    input.levelId,
    room.id,
    subdivision.faces,
    faceRoomIds
  );
  if (!viewpointResult.ok) return failure(viewpointResult.error);
  const staircaseError = findAmbiguousStaircaseRoomReference(project, room.id);
  if (staircaseError) return failure(staircaseError);

  const candidate = {
    ...mapLevel(project, levelIndex, (current) => ({
      ...current,
      rooms,
      walls: doorResult.walls
    })),
    viewpoints: viewpointResult.viewpoints
  };
  return validateCanonicalResult(candidate, "Room reconciliation");
}

/**
 * Divides one Room with one existing Wall when it forms a two-face subdivision.
 *
 * This compatibility operation delegates identity and reciprocal-reference
 * handling to bounded-face reconciliation.
 */
export function partitionRoom(
  project: Project,
  input: PartitionRoomInput
): ProjectEditingResult {
  const subdivision = classifyLevelRoomTopology(project, input.levelId).subdivisions
    .find((candidate) =>
      candidate.roomId === input.roomId &&
      candidate.faces.length === 2 &&
      candidate.faces.every((face) =>
        face.boundary.some((edge) => edge.wallId === input.partitionWallId)
      )
    );
  if (!subdivision) return failure(nonPartitioningWall(input.partitionWallId));
  return reconcileRoomSubdivision(project, {
    levelId: input.levelId,
    roomId: input.roomId,
    expectedFaceKeys: subdivision.faces.map((face) => face.key),
    newRoomAssignments: subdivision.faces
      .filter((face) => face.key !== subdivision.preservedFaceKey)
      .map((face) => ({ faceKey: face.key, room: input.newRoom }))
  });
}

/**
 * Replaces one Room's supported metadata without changing architectural topology.
 *
 * The complete resulting Project is validated before it is returned. Room
 * boundary order and orientation, reciprocal Wall references, and every
 * unrelated entity remain unchanged.
 */
export function updateRoomProperties(
  project: Project,
  input: UpdateRoomPropertiesInput
): ProjectEditingResult {
  const levelIndex = findLevelIndex(project, input.levelId);
  if (levelIndex < 0) return failure(levelNotFound(input.levelId));
  const level = project.building.levels[levelIndex]!;
  const roomIndex = level.rooms.findIndex((room) => room.id === input.roomId);
  if (roomIndex < 0) return failure(roomNotFound(input.levelId, input.roomId));

  const currentRoom = level.rooms[roomIndex]!;
  const parsedRoom = RoomSchema.safeParse({
    ...currentRoom,
    name: input.name ?? currentRoom.name,
    type: input.type ?? currentRoom.type,
    elevation: input.elevation ?? currentRoom.elevation
  });
  if (!parsedRoom.success) {
    return failure({
      code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
      path: "properties",
      message: "Room properties must satisfy the canonical Room metadata contract."
    });
  }

  const candidate = mapLevel(project, levelIndex, (current) => ({
    ...current,
    rooms: current.rooms.map((room, index) =>
      index === roomIndex
        ? {
            ...room,
            name: parsedRoom.data.name,
            type: parsedRoom.data.type,
            ...(parsedRoom.data.elevation === undefined ? {} : { elevation: parsedRoom.data.elevation })
          }
        : room
    )
  }));
  return validateCanonicalResult(candidate, "Room property update");
}

/** Removes one Room and clears its reciprocal Wall references atomically. */
export function deleteRoom(project: Project, input: DeleteRoomInput): ProjectEditingResult {
  const levelIndex = findLevelIndex(project, input.levelId);
  if (levelIndex < 0) return failure(levelNotFound(input.levelId));
  const level = project.building.levels[levelIndex]!;
  if (!level.rooms.some((room) => room.id === input.roomId)) {
    return failure(roomNotFound(input.levelId, input.roomId));
  }
  const externallyReferenced =
    project.viewpoints.some((viewpoint) => viewpoint.roomId === input.roomId) ||
    project.building.levels.some((candidate) =>
      candidate.staircases.some(
        (staircase) =>
          staircase.fromRoomId === input.roomId || staircase.toRoomId === input.roomId
      ) ||
      candidate.walls.some((wall) =>
        wall.openings.some(
          (opening) =>
            opening.type === "DOOR" && opening.connectedRoomIds?.includes(input.roomId)
        )
      )
    );
  if (externallyReferenced) {
    return failure({
      code: ValidationErrorCode.ROOM_IS_REFERENCED,
      path: "roomId",
      message: `Room "${input.roomId}" is referenced by another domain entity.`
    });
  }
  const rooms = level.rooms.filter((room) => room.id !== input.roomId);
  const candidate = mapLevel(project, levelIndex, (current) => ({
    ...current,
    rooms,
    walls: rebuildWallRoomIds(current.walls, rooms)
  }));
  return validateCanonicalResult(candidate, "Room deletion");
}

/**
 * Absorbs one Room into its unique adjacent Room without removing physical Walls.
 *
 * The shared boundary must cancel into one exact simple outer cycle whose area
 * equals both source regions. All current Room-scoped Door, Viewpoint, and
 * Staircase references are reassigned to the surviving Room because the full
 * dissolved region is incorporated into it. Ambiguous adjacency or invalid
 * union topology is rejected before any Project state is returned.
 */
export function dissolveRoom(project: Project, input: DissolveRoomInput): ProjectEditingResult {
  const levelIndex = findLevelIndex(project, input.levelId);
  if (levelIndex < 0) return failure(levelNotFound(input.levelId));
  const level = project.building.levels[levelIndex]!;
  const dissolvedRoom = level.rooms.find((room) => room.id === input.roomId);
  if (!dissolvedRoom) return failure(roomNotFound(input.levelId, input.roomId));

  const dissolvedWallIds = new Set(dissolvedRoom.boundary.map((edge) => edge.wallId));
  const adjacentRooms = level.rooms.filter(
    (room) =>
      room.id !== dissolvedRoom.id &&
      room.boundary.some((edge) => dissolvedWallIds.has(edge.wallId))
  );
  if (adjacentRooms.length !== 1) {
    return failure({
      code: ValidationErrorCode.ROOM_DISSOLUTION_AMBIGUOUS,
      path: "roomId",
      message: `Room "${dissolvedRoom.id}" does not have one unique adjacent Room.`
    });
  }

  const survivingRoom = adjacentRooms[0]!;
  const survivingEdgesByWallId = new Map(
    survivingRoom.boundary.map((edge) => [edge.wallId, edge])
  );
  const sharedWallIds = new Set(
    dissolvedRoom.boundary
      .map((edge) => edge.wallId)
      .filter((wallId) => survivingEdgesByWallId.has(wallId))
  );
  const sharedBoundaryIsOpposed = dissolvedRoom.boundary
    .filter((edge) => sharedWallIds.has(edge.wallId))
    .every(
      (edge) => survivingEdgesByWallId.get(edge.wallId)?.direction !== edge.direction
    );
  if (sharedWallIds.size === 0 || !sharedBoundaryIsOpposed) {
    return failure(invalidRoomDissolution(dissolvedRoom.id));
  }

  const mergedBoundary = canonicalizeCycle(
    [...survivingRoom.boundary, ...dissolvedRoom.boundary].filter(
      (edge) => !sharedWallIds.has(edge.wallId)
    ),
    level.walls
  );
  if (!mergedBoundary) return failure(invalidRoomDissolution(dissolvedRoom.id));

  const dissolvedArea = Math.abs(
    signedArea(getBoundaryVertices(dissolvedRoom.boundary, level.walls))
  );
  const survivingArea = Math.abs(
    signedArea(getBoundaryVertices(survivingRoom.boundary, level.walls))
  );
  const mergedArea = Math.abs(signedArea(getBoundaryVertices(mergedBoundary, level.walls)));
  if (!nearlyEqual(mergedArea, dissolvedArea + survivingArea)) {
    return failure(invalidRoomDissolution(dissolvedRoom.id));
  }

  const rooms = level.rooms
    .filter((room) => room.id !== dissolvedRoom.id)
    .map((room) =>
      room.id === survivingRoom.id ? { ...room, boundary: mergedBoundary } : room
    );
  const candidate: Project = {
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels.map((current, index) => {
        const wallsWithReferences = replaceDoorRoomReference(
          current.walls,
          dissolvedRoom.id,
          survivingRoom.id
        );
        return {
          ...current,
          rooms: index === levelIndex ? rooms : current.rooms,
          walls: index === levelIndex
            ? rebuildWallRoomIds(wallsWithReferences, rooms)
            : wallsWithReferences,
          staircases: current.staircases.map((staircase) => ({
            ...staircase,
            fromRoomId: staircase.fromRoomId === dissolvedRoom.id
              ? survivingRoom.id
              : staircase.fromRoomId,
            toRoomId: staircase.toRoomId === dissolvedRoom.id
              ? survivingRoom.id
              : staircase.toRoomId
          }))
        };
      })
    },
    viewpoints: project.viewpoints.map((viewpoint) =>
      viewpoint.roomId === dissolvedRoom.id
        ? { ...viewpoint, roomId: survivingRoom.id }
        : viewpoint
    )
  };
  return validateCanonicalResult(candidate, "Room dissolution");
}

/**
 * Moves an exact-coordinate junction as one semantic edit.
 *
 * All incident Wall endpoints are updated together. The expected incident Wall
 * IDs make a delayed pointer commit fail when topology changed during the drag.
 */
export function moveJunction(project: Project, input: MoveJunctionInput): ProjectEditingResult {
  const levelIndex = findLevelIndex(project, input.levelId);
  if (levelIndex < 0) return failure(levelNotFound(input.levelId));
  const position = Point2DSchema.safeParse(input.position);
  const destination = Point2DSchema.safeParse(input.destination);
  if (!position.success || !destination.success) {
    return failure({
      code: ValidationErrorCode.INVALID_WALL_ENDPOINT,
      path: "destination",
      message: "Junction coordinates must be finite numbers."
    });
  }
  const level = project.building.levels[levelIndex]!;
  const actualIds = level.walls
    .filter((wall) => samePoint(wall.start, position.data) || samePoint(wall.end, position.data))
    .map((wall) => wall.id)
    .sort();
  const expectedIds = [...new Set(input.incidentWallIds)].sort();
  if (actualIds.length < 2) {
    return failure({
      code: ValidationErrorCode.JUNCTION_NOT_FOUND,
      path: "position",
      message: "The requested point is not a shared Wall junction."
    });
  }
  if (actualIds.length !== expectedIds.length || actualIds.some((id, index) => id !== expectedIds[index])) {
    return failure({
      code: ValidationErrorCode.STALE_JUNCTION_TOPOLOGY,
      path: "incidentWallIds",
      message: "The Walls incident to this junction changed before the edit was committed."
    });
  }
  const candidate = mapLevel(project, levelIndex, (current) => ({
    ...current,
    walls: current.walls.map((wall) => ({
      ...wall,
      start: samePoint(wall.start, position.data) ? destination.data : wall.start,
      end: samePoint(wall.end, position.data) ? destination.data : wall.end
    }))
  }));
  return validateCanonicalResult(candidate, "Junction movement");
}

function canonicalizeCycle(
  requested: readonly RoomBoundaryEdge[],
  walls: readonly Wall[]
): RoomBoundaryEdge[] | undefined {
  if (requested.length < 3 || new Set(requested.map((edge) => edge.wallId)).size !== requested.length) {
    return undefined;
  }
  const wallsById = new Map(walls.map((wall) => [wall.id, wall]));
  const selected = requested.map((edge) => wallsById.get(edge.wallId));
  if (selected.some((wall) => !wall)) return undefined;
  const degree = new Map<string, number>();
  for (const wall of selected as Wall[]) {
    increment(degree, pointKey(wall.start));
    increment(degree, pointKey(wall.end));
  }
  if ([...degree.values()].some((value) => value !== 2)) return undefined;

  const startWall = [...(selected as Wall[])].sort((first, second) => first.id.localeCompare(second.id))[0]!;
  const traversals = [
    buildCycle(startWall, "FORWARD", selected as Wall[]),
    buildCycle(startWall, "REVERSE", selected as Wall[])
  ].filter((value): value is RoomBoundaryEdge[] => Boolean(value));
  const counterClockwise = traversals.filter(
    (boundary) => signedArea(getBoundaryVertices(boundary, walls)) > 0
  );
  if (counterClockwise.length !== 1) return undefined;
  const boundary = rotateBoundary(counterClockwise[0]!);
  return isSimplePolygon(getBoundaryVertices(boundary, walls)) ? boundary : undefined;
}

/**
 * Canonicalizes an already ordered directed Wall traversal without rebuilding it.
 *
 * The traversal must be continuous, closed, simple, and use each Wall once.
 * Canonicalization may reverse winding and rotate the starting use, but retains
 * every physical Wall and intermediate junction represented by the traversal.
 */
function canonicalizeDirectedCycle(
  requested: readonly RoomBoundaryEdge[],
  walls: readonly Wall[]
): RoomBoundaryEdge[] | undefined {
  if (requested.length < 3 || new Set(requested.map((edge) => edge.wallId)).size !== requested.length) {
    return undefined;
  }
  const wallsById = new Map(walls.map((wall) => [wall.id, wall]));
  const uses = requested.map((edge) => {
    const wall = wallsById.get(edge.wallId);
    if (!wall) return undefined;
    return {
      edge: { ...edge },
      start: edge.direction === "FORWARD" ? wall.start : wall.end,
      end: edge.direction === "FORWARD" ? wall.end : wall.start
    };
  });
  if (uses.some((use) => !use)) return undefined;
  const directedUses = uses as Array<{
    readonly edge: RoomBoundaryEdge;
    readonly start: Point2D;
    readonly end: Point2D;
  }>;
  if (directedUses.some((use, index) =>
    !samePoint(use.end, directedUses[(index + 1) % directedUses.length]!.start)
  )) {
    return undefined;
  }
  const vertices = directedUses.map((use) => use.start);
  const area = signedArea(vertices);
  if (area === 0 || !isSimplePolygon(vertices)) return undefined;
  const counterClockwise: RoomBoundaryEdge[] = area > 0
    ? directedUses.map((use) => use.edge)
    : [...directedUses].reverse().map((use) => ({
        wallId: use.edge.wallId,
        direction: use.edge.direction === "FORWARD" ? "REVERSE" as const : "FORWARD" as const
      }));
  return rotateBoundary(counterClockwise);
}

function buildCycle(
  firstWall: Wall,
  firstDirection: RoomBoundaryEdge["direction"],
  walls: readonly Wall[]
): RoomBoundaryEdge[] | undefined {
  const remaining = new Map(walls.map((wall) => [wall.id, wall]));
  const result: RoomBoundaryEdge[] = [];
  let wall = firstWall;
  let direction = firstDirection;
  const initialPoint = direction === "FORWARD" ? wall.start : wall.end;
  let nextPoint = direction === "FORWARD" ? wall.end : wall.start;
  while (result.length < walls.length) {
    result.push({ wallId: wall.id, direction });
    remaining.delete(wall.id);
    if (remaining.size === 0) return samePoint(nextPoint, initialPoint) ? result : undefined;
    const matches = [...remaining.values()].filter(
      (candidate) => samePoint(candidate.start, nextPoint) || samePoint(candidate.end, nextPoint)
    );
    if (matches.length !== 1) return undefined;
    wall = matches[0]!;
    direction = samePoint(wall.start, nextPoint) ? "FORWARD" : "REVERSE";
    nextPoint = direction === "FORWARD" ? wall.end : wall.start;
  }
  return undefined;
}

function rotateBoundary(boundary: readonly RoomBoundaryEdge[]): RoomBoundaryEdge[] {
  const rotations = boundary.map((_, index) => [...boundary.slice(index), ...boundary.slice(0, index)]);
  return rotations.sort((first, second) => boundaryKey(first).localeCompare(boundaryKey(second)))[0]!;
}

function rebuildWallRoomIds(walls: readonly Wall[], rooms: readonly Room[]): Wall[] {
  const roomOrder = new Map(rooms.map((room, index) => [room.id, index]));
  return walls.map((wall) => ({
    ...wall,
    roomIds: rooms
      .filter((room) => room.boundary.some((edge) => edge.wallId === wall.id))
      .map((room) => room.id)
      .sort((first, second) => roomOrder.get(first)! - roomOrder.get(second)!)
  }));
}

/** Reassigns Door connectivity when one complete Room region is absorbed. */
function replaceDoorRoomReference(
  walls: readonly Wall[],
  dissolvedRoomId: Identifier,
  survivingRoomId: Identifier
): Wall[] {
  return walls.map((wall) => ({
    ...wall,
    openings: wall.openings.map((opening) => {
      if (
        opening.type !== "DOOR" ||
        !opening.connectedRoomIds?.includes(dissolvedRoomId)
      ) {
        return opening;
      }
      return {
        ...opening,
        connectedRoomIds: [...new Set(opening.connectedRoomIds.map((roomId) =>
          roomId === dissolvedRoomId ? survivingRoomId : roomId
        ))]
      };
    })
  }));
}

function nextFaceUse(
  current: DirectedWallUse,
  outgoing: ReadonlyMap<string, readonly DirectedWallUse[]>
): DirectedWallUse | undefined {
  const uses = outgoing.get(pointKey(current.to));
  if (!uses?.length) return undefined;
  const reverseIndex = uses.findIndex(
    (use) => use.wall.id === current.wall.id && samePoint(use.to, current.from)
  );
  return reverseIndex < 0 ? undefined : uses[(reverseIndex - 1 + uses.length) % uses.length];
}

function addDirectedUse(map: Map<string, DirectedWallUse[]>, use: DirectedWallUse): void {
  const uses = map.get(pointKey(use.from)) ?? [];
  uses.push(use);
  map.set(pointKey(use.from), uses);
}

function getBoundaryVertices(boundary: readonly RoomBoundaryEdge[], walls: readonly Wall[]): Point2D[] {
  const wallsById = new Map(walls.map((wall) => [wall.id, wall]));
  return boundary.flatMap((edge) => {
    const wall = wallsById.get(edge.wallId);
    return wall ? [edge.direction === "FORWARD" ? wall.start : wall.end] : [];
  });
}

function isSimplePolygon(vertices: readonly Point2D[]): boolean {
  if (vertices.length < 3 || signedArea(vertices) === 0) return false;
  for (let first = 0; first < vertices.length; first += 1) {
    const a = vertices[first]!;
    const b = vertices[(first + 1) % vertices.length]!;
    for (let second = first + 1; second < vertices.length; second += 1) {
      if (Math.abs(first - second) === 1 || (first === 0 && second === vertices.length - 1)) continue;
      const c = vertices[second]!;
      const d = vertices[(second + 1) % vertices.length]!;
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const cross = (p: Point2D, q: Point2D, r: Point2D) =>
    (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (abC === 0 && onSegment(a, c, b)) return true;
  if (abD === 0 && onSegment(a, d, b)) return true;
  if (cdA === 0 && onSegment(c, a, d)) return true;
  if (cdB === 0 && onSegment(c, b, d)) return true;
  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
}

function onSegment(a: Point2D, p: Point2D, b: Point2D): boolean {
  return p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) &&
    p.z >= Math.min(a.z, b.z) && p.z <= Math.max(a.z, b.z);
}

function signedArea(vertices: readonly Point2D[]): number {
  return vertices.reduce((sum, point, index) => {
    const next = vertices[(index + 1) % vertices.length]!;
    return sum + point.x * next.z - next.x * point.z;
  }, 0) / 2;
}

/** Calculates the centroid of a non-degenerate ordered polygon. */
function polygonCentroid(
  vertices: readonly Point2D[],
  area = signedArea(vertices)
): Point2D | undefined {
  if (area === 0) return undefined;
  let x = 0;
  let z = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]!;
    const next = vertices[(index + 1) % vertices.length]!;
    const factor = current.x * next.z - next.x * current.z;
    x += (current.x + next.x) * factor;
    z += (current.z + next.z) * factor;
  }
  const scale = 1 / (6 * area);
  return { x: x * scale, z: z * scale };
}

/** Spatial relationship between one point and a simple polygon. */
type PointPolygonPosition = "INSIDE" | "BOUNDARY" | "OUTSIDE";

/** Classifies a point against a simple polygon, including its boundary. */
function pointInPolygon(point: Point2D, vertices: readonly Point2D[]): PointPolygonPosition {
  let inside = false;
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index++) {
    const current = vertices[index]!;
    const prior = vertices[previous]!;
    if (crossProduct(prior, current, point) === 0 && onSegment(prior, point, current)) {
      return "BOUNDARY";
    }
    if (
      (current.z > point.z) !== (prior.z > point.z) &&
      point.x < ((prior.x - current.x) * (point.z - current.z)) / (prior.z - current.z) + current.x
    ) {
      inside = !inside;
    }
  }
  return inside ? "INSIDE" : "OUTSIDE";
}

/** Returns the signed planar turn formed by three points. */
function crossProduct(first: Point2D, second: Point2D, third: Point2D): number {
  return (second.x - first.x) * (third.z - first.z) -
    (second.z - first.z) * (third.x - first.x);
}

/** Compares geometric measures with a scale-relative tolerance. */
function nearlyEqual(first: number, second: number): boolean {
  const scale = Math.max(1, Math.abs(first), Math.abs(second));
  return Math.abs(first - second) <= scale * 1e-9;
}

/** Selects the deterministic face that retains an existing Room identity. */
function selectIdentityPreservingFace(
  faces: readonly DerivedBoundedFace[],
  oldCentroid: Point2D
): DerivedBoundedFace {
  const containing = faces.filter(
    (face) => pointInPolygon(oldCentroid, face.vertices) === "INSIDE"
  );
  if (containing.length === 1) return containing[0]!;
  return [...faces].sort((first, second) =>
    second.area - first.area ||
    squaredDistance(first.centroid, oldCentroid) - squaredDistance(second.centroid, oldCentroid) ||
    first.key.localeCompare(second.key)
  )[0]!;
}

/** Returns squared planar distance without an unnecessary square root. */
function squaredDistance(first: Point2D, second: Point2D): number {
  return (first.x - second.x) ** 2 + (first.z - second.z) ** 2;
}

type DoorReferenceReconciliationResult =
  | { readonly ok: true; readonly walls: Wall[] }
  | { readonly ok: false; readonly error: ValidationError };

/** Rewrites Door connectivity from exact owning-Wall membership in resulting faces. */
function reconcileDoorRoomReferences(
  walls: readonly Wall[],
  oldRoomId: Identifier,
  faces: readonly DerivedBoundedFace[],
  faceRoomIds: ReadonlyMap<string, Identifier>,
  levelIndex: number
): DoorReferenceReconciliationResult {
  let error: ValidationError | undefined;
  const nextWalls = walls.map((wall, wallIndex) => {
    const replacementRoomIds = faces
      .filter((face) => face.boundary.some((edge) => edge.wallId === wall.id))
      .map((face) => faceRoomIds.get(face.key))
      .filter((roomId): roomId is Identifier => Boolean(roomId));
    const openings = wall.openings.map((opening, openingIndex) => {
      if (
        opening.type !== "DOOR" ||
        !opening.connectedRoomIds?.includes(oldRoomId)
      ) return opening;
      if (replacementRoomIds.length < 1 || replacementRoomIds.length > 2) {
        error = {
          code: ValidationErrorCode.ROOM_SUBDIVISION_DOOR_REFERENCE_AMBIGUOUS,
          path: `building.levels[${levelIndex}].walls[${wallIndex}].openings[${openingIndex}].connectedRoomIds`,
          message: `Door "${opening.id}" cannot be assigned from its owning Wall after Room subdivision.`
        };
        return opening;
      }
      const connectedRoomIds = [...new Set(opening.connectedRoomIds.flatMap((roomId) =>
        roomId === oldRoomId ? replacementRoomIds : [roomId]
      ))];
      return arraysEqual(connectedRoomIds, opening.connectedRoomIds)
        ? opening
        : { ...opening, connectedRoomIds };
    });
    return openings.every((opening, index) => opening === wall.openings[index])
      ? wall
      : { ...wall, openings };
  });
  return error ? { ok: false, error } : { ok: true, walls: nextWalls };
}

type ViewpointReferenceReconciliationResult =
  | { readonly ok: true; readonly viewpoints: Project["viewpoints"] }
  | { readonly ok: false; readonly error: ValidationError };

/** Reassigns Room-scoped Viewpoints by their Level-local camera XZ position. */
function reconcileViewpointRoomReferences(
  project: Project,
  levelId: Identifier,
  oldRoomId: Identifier,
  faces: readonly DerivedBoundedFace[],
  faceRoomIds: ReadonlyMap<string, Identifier>
): ViewpointReferenceReconciliationResult {
  let error: ValidationError | undefined;
  const viewpoints = project.viewpoints.map((viewpoint, viewpointIndex) => {
    if (viewpoint.roomId !== oldRoomId) return viewpoint;
    const point = { x: viewpoint.cameraPosition.x, z: viewpoint.cameraPosition.z };
    const positions = faces.map((face) => ({
      face,
      position: pointInPolygon(point, face.vertices)
    }));
    const containing = positions.filter(({ position }) => position === "INSIDE");
    if (
      viewpoint.levelId !== levelId ||
      positions.some(({ position }) => position === "BOUNDARY") ||
      containing.length !== 1
    ) {
      error = {
        code: ValidationErrorCode.ROOM_SUBDIVISION_VIEWPOINT_REFERENCE_AMBIGUOUS,
        path: `viewpoints[${viewpointIndex}].roomId`,
        message: `Viewpoint "${viewpoint.id}" does not lie uniquely inside one resulting Room.`
      };
      return viewpoint;
    }
    const roomId = faceRoomIds.get(containing[0]!.face.key);
    if (!roomId) {
      error = {
        code: ValidationErrorCode.ROOM_SUBDIVISION_VIEWPOINT_REFERENCE_AMBIGUOUS,
        path: `viewpoints[${viewpointIndex}].roomId`,
        message: `Viewpoint "${viewpoint.id}" has no resulting Room assignment.`
      };
      return viewpoint;
    }
    return roomId === viewpoint.roomId ? viewpoint : { ...viewpoint, roomId };
  });
  return error ? { ok: false, error } : { ok: true, viewpoints };
}

/** Finds a Staircase Room endpoint that lacks an explicit spatial anchor contract. */
function findAmbiguousStaircaseRoomReference(
  project: Project,
  roomId: Identifier
): ValidationError | undefined {
  for (const [levelIndex, level] of project.building.levels.entries()) {
    for (const [staircaseIndex, staircase] of level.staircases.entries()) {
      if (staircase.fromRoomId === roomId) {
        return {
          code: ValidationErrorCode.ROOM_SUBDIVISION_STAIRCASE_REFERENCE_AMBIGUOUS,
          path: `building.levels[${levelIndex}].staircases[${staircaseIndex}].fromRoomId`,
          message: `Staircase "${staircase.id}" has no explicit spatial anchor for its from-Room reference.`
        };
      }
      if (staircase.toRoomId === roomId) {
        return {
          code: ValidationErrorCode.ROOM_SUBDIVISION_STAIRCASE_REFERENCE_AMBIGUOUS,
          path: `building.levels[${levelIndex}].staircases[${staircaseIndex}].toRoomId`,
          message: `Staircase "${staircase.id}" has no explicit spatial anchor for its to-Room reference.`
        };
      }
    }
  }
  return undefined;
}

/** Compares ordered identifier collections without normalization. */
function arraysEqual(first: readonly Identifier[], second: readonly Identifier[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function boundaryIdentity(boundary: readonly RoomBoundaryEdge[]): string {
  return [...boundary.map((edge) => edge.wallId)].sort().join("|");
}

function boundaryKey(boundary: readonly RoomBoundaryEdge[]): string {
  return boundary.map((edge) => `${edge.wallId}:${edge.direction}`).join("|");
}

function directedUseKey(use: DirectedWallUse): string {
  return `${use.wall.id}:${use.direction}`;
}

function angle(from: Point2D, to: Point2D): number {
  return Math.atan2(to.z - from.z, to.x - from.x);
}

function pointKey(point: Point2D): string {
  return `${point.x}:${point.z}`;
}

function samePoint(first: Point2D, second: Point2D): boolean {
  return first.x === second.x && first.z === second.z;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function findLevelIndex(project: Project, levelId: Identifier): number {
  return project.building.levels.findIndex((level) => level.id === levelId);
}

function mapLevel(
  project: Project,
  levelIndex: number,
  transform: (level: Project["building"]["levels"][number]) => Project["building"]["levels"][number]
): Project {
  return {
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels.map((level, index) =>
        index === levelIndex ? transform(level) : level
      )
    }
  };
}

function validateCanonicalResult(project: Project, operation: string): ProjectEditingResult {
  const parsed = ProjectSchema.safeParse(project);
  if (!parsed.success) {
    return failure({
      code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
      path: "project",
      message: `${operation} produced a structurally invalid Project.`
    });
  }
  for (const validate of [
    validateProjectCrossReferences,
    validateProjectReferenceConsistency,
    validateProjectGeometry
  ]) {
    const result = validate(parsed.data);
    if (!result.valid) return { ok: false, errors: result.errors };
  }
  return { ok: true, project: parsed.data };
}

function levelNotFound(levelId: Identifier): ValidationError {
  return {
    code: ValidationErrorCode.LEVEL_NOT_FOUND,
    path: "levelId",
    message: `Level "${levelId}" could not be found.`
  };
}

function roomNotFound(levelId: Identifier, roomId: Identifier): ValidationError {
  return {
    code: ValidationErrorCode.ROOM_NOT_FOUND,
    path: "roomId",
    message: `Room "${roomId}" could not be found in level "${levelId}".`
  };
}

function invalidIdentifier(path: string, kind: string): ValidationError {
  return {
    code: ValidationErrorCode.INVALID_IDENTIFIER,
    path,
    message: `${kind} ID must be a non-empty lowercase kebab-case identifier.`
  };
}

function invalidRoomBoundary(path: string, roomId: Identifier): ValidationError {
  return {
    code: ValidationErrorCode.INVALID_ROOM_BOUNDARY,
    path,
    message: `Room "${roomId}" boundary must form one closed simple Wall cycle.`
  };
}

/** Creates the stable error returned when adjacent boundaries cannot form one Room. */
function invalidRoomDissolution(roomId: Identifier): ValidationError {
  return {
    code: ValidationErrorCode.INVALID_ROOM_DISSOLUTION,
    path: "roomId",
    message: `Room "${roomId}" cannot be dissolved into one exact simple adjacent region.`
  };
}

function nonPartitioningWall(wallId: Identifier): ValidationError {
  return {
    code: ValidationErrorCode.WALL_DOES_NOT_PARTITION_ROOM,
    path: "partitionWallId",
    message: `Wall "${wallId}" does not divide the Room boundary into two valid regions.`
  };
}

function failure(error: ValidationError): ProjectEditingResult {
  return { ok: false, errors: [error] };
}
