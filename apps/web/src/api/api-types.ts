import { ProjectSchema, type Project } from "@casastudio/schema";

/** Field-level diagnostic returned by a CasaStudio Problem Details response. */
export type ApiProblemItem = {
  readonly path: string;
  readonly message: string;
};

/** RFC 9457 error contract emitted by the CasaStudio API. */
export type ApiProblem = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance?: string;
  readonly code: string;
  readonly requestId?: string;
  readonly errors?: readonly ApiProblemItem[];
};

/** Authoritative Project response envelope. */
export type ProjectResponse = {
  readonly project: Project;
  readonly sourceRevision: number;
};

/** Two-dimensional coordinate in a geometry snapshot. */
export type GeometryPoint2D = { readonly x: number; readonly z: number };

/** Bounds for a geometry polygon. */
export type GeometryBounds = {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
};

/** Serialized geometry vertex. */
export type GeometryVertex = GeometryPoint2D & {
  readonly id: string;
  readonly incidentBoundaryEdgeIds: readonly string[];
};

/** Serialized physical boundary edge. */
export type GeometryBoundaryEdge = {
  readonly id: string;
  readonly sourceWallId: string;
  readonly startVertexId: string;
  readonly endVertexId: string;
  readonly start: GeometryPoint2D;
  readonly end: GeometryPoint2D;
  readonly thickness: number;
  readonly height: number;
};

/** Serialized loop-relative boundary traversal. */
export type GeometryBoundaryEdgeUse = {
  readonly id: string;
  readonly boundaryEdgeId: string;
  readonly sourceWallId: string;
  readonly direction: "FORWARD" | "REVERSE";
  readonly index: number;
  readonly loopId: string;
  readonly startVertexId: string;
  readonly endVertexId: string;
  readonly start: GeometryPoint2D;
  readonly end: GeometryPoint2D;
};

/** Serialized polygon boundary loop. */
export type GeometryLoop = {
  readonly id: string;
  readonly kind: "OUTER" | "INNER";
  readonly polygonId: string;
  readonly boundaryEdgeUseIds: readonly string[];
  readonly boundaryEdgeIds: readonly string[];
  readonly vertexIds: readonly string[];
};

/** Serialized room-derived polygon. */
export type GeometryPolygon = {
  readonly id: string;
  readonly sourceRoomId: string;
  readonly outerLoopId: string;
  readonly innerLoopIds: readonly string[];
  readonly loopIds: readonly string[];
  readonly boundaryEdgeUseIds: readonly string[];
  readonly boundaryEdgeIds: readonly string[];
  readonly vertexIds: readonly string[];
  readonly metrics: {
    readonly signedArea: number;
    readonly area: number;
    readonly winding: "CLOCKWISE" | "COUNTER_CLOCKWISE" | "DEGENERATE";
    readonly bounds: GeometryBounds;
    readonly centroid: GeometryPoint2D;
  };
};

/** Serialized geometry derived for one source level. */
export type GeometryLevel = {
  readonly id: string;
  readonly sourceLevelId: string;
  readonly elevation: number;
  readonly vertices: readonly GeometryVertex[];
  readonly boundaryEdges: readonly GeometryBoundaryEdge[];
  readonly boundaryEdgeUses: readonly GeometryBoundaryEdgeUse[];
  readonly loops: readonly GeometryLoop[];
  readonly polygons: readonly GeometryPolygon[];
};

/** Plain transport snapshot emitted by the backend Geometry Engine mapper. */
export type GeometrySnapshot = {
  readonly id: string;
  readonly units: { readonly length: "cm"; readonly angle: "deg" };
  readonly levels: readonly GeometryLevel[];
};

/** Authoritative geometry response envelope for one Project revision. */
export type ProjectGeometryResponse = {
  readonly sourceProjectId: string;
  readonly sourceRevision: number;
  readonly geometry: GeometrySnapshot;
};

/** Parses the Project API envelope and validates its canonical Project payload. */
export function parseProjectResponse(value: unknown): ProjectResponse {
  const record = requireRecord(value, "Project response");
  const project = ProjectSchema.parse(record.project);
  const sourceRevision = requireNumber(record.sourceRevision, "Project sourceRevision");

  if (sourceRevision !== project.revision) {
    throw new Error("Project response sourceRevision does not match project.revision.");
  }

  return { project, sourceRevision };
}

/** Defensively validates the geometry response envelope used by the connected route. */
export function parseProjectGeometryResponse(value: unknown): ProjectGeometryResponse {
  const response = requireRecord(value, "Geometry response");
  const geometry = requireRecord(response.geometry, "Geometry snapshot");
  const units = requireRecord(geometry.units, "Geometry units");
  const levels = requireArray(geometry.levels, "Geometry levels").map((level, index) => {
    const item = requireRecord(level, `Geometry level ${index}`);

    return {
      ...item,
      id: requireString(item.id, `Geometry level ${index} id`),
      sourceLevelId: requireString(item.sourceLevelId, `Geometry level ${index} sourceLevelId`),
      elevation: requireNumber(item.elevation, `Geometry level ${index} elevation`),
      vertices: requireArray(item.vertices, `Geometry level ${index} vertices`) as readonly GeometryVertex[],
      boundaryEdges: requireArray(item.boundaryEdges, `Geometry level ${index} boundaryEdges`) as readonly GeometryBoundaryEdge[],
      boundaryEdgeUses: requireArray(item.boundaryEdgeUses, `Geometry level ${index} boundaryEdgeUses`) as readonly GeometryBoundaryEdgeUse[],
      loops: requireArray(item.loops, `Geometry level ${index} loops`) as readonly GeometryLoop[],
      polygons: requireArray(item.polygons, `Geometry level ${index} polygons`) as readonly GeometryPolygon[]
    } satisfies GeometryLevel;
  });

  const sourceProjectId = requireString(response.sourceProjectId, "Geometry sourceProjectId");
  const sourceRevision = requireNumber(response.sourceRevision, "Geometry sourceRevision");

  return {
    sourceProjectId,
    sourceRevision,
    geometry: {
      id: requireString(geometry.id, "Geometry id"),
      units: {
        length: requireLiteral(units.length, "cm", "Geometry length unit"),
        angle: requireLiteral(units.angle, "deg", "Geometry angle unit")
      },
      levels
    }
  };
}

/** Returns whether an unknown JSON value matches the API Problem Details contract. */
export function isApiProblem(value: unknown): value is ApiProblem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.type === "string" &&
    typeof value.title === "string" &&
    typeof value.status === "number" &&
    typeof value.detail === "string" &&
    typeof value.code === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

function requireArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return value;
}

function requireLiteral<const Value extends string>(
  value: unknown,
  expected: Value,
  label: string
): Value {
  if (value !== expected) {
    throw new Error(`${label} must be ${expected}.`);
  }

  return expected;
}
