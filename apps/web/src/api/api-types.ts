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

/** Complete Project replacement request based on one authoritative revision. */
export type ReplaceProjectRequest = {
  readonly baseRevision: number;
  readonly project: Project;
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

/** Defensively validates the geometry response envelope used by the Project viewer. */
export function parseProjectGeometryResponse(value: unknown): ProjectGeometryResponse {
  const response = requireRecord(value, "Geometry response");
  const geometry = requireRecord(response.geometry, "Geometry snapshot");
  const units = requireRecord(geometry.units, "Geometry units");
  const levels = requireArray(geometry.levels, "Geometry levels").map((level, index) => {
    const item = requireRecord(level, `Geometry level ${index}`);
    const label = `Geometry level ${index}`;

    return {
      id: requireString(item.id, `${label} id`),
      sourceLevelId: requireString(item.sourceLevelId, `${label} sourceLevelId`),
      elevation: requireNumber(item.elevation, `${label} elevation`),
      vertices: requireArray(item.vertices, `${label} vertices`).map((vertex, itemIndex) =>
        parseGeometryVertex(vertex, `${label} vertex ${itemIndex}`)
      ),
      boundaryEdges: requireArray(item.boundaryEdges, `${label} boundaryEdges`).map(
        (edge, itemIndex) => parseGeometryBoundaryEdge(edge, `${label} boundary edge ${itemIndex}`)
      ),
      boundaryEdgeUses: requireArray(item.boundaryEdgeUses, `${label} boundaryEdgeUses`).map(
        (edgeUse, itemIndex) =>
          parseGeometryBoundaryEdgeUse(edgeUse, `${label} boundary edge use ${itemIndex}`)
      ),
      loops: requireArray(item.loops, `${label} loops`).map((loop, itemIndex) =>
        parseGeometryLoop(loop, `${label} loop ${itemIndex}`)
      ),
      polygons: requireArray(item.polygons, `${label} polygons`).map((polygon, itemIndex) =>
        parseGeometryPolygon(polygon, `${label} polygon ${itemIndex}`)
      )
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

function parseGeometryVertex(value: unknown, label: string): GeometryVertex {
  const item = requireRecord(value, label);

  return {
    id: requireString(item.id, `${label} id`),
    x: requireNumber(item.x, `${label} x`),
    z: requireNumber(item.z, `${label} z`),
    incidentBoundaryEdgeIds: requireStringArray(
      item.incidentBoundaryEdgeIds,
      `${label} incidentBoundaryEdgeIds`
    )
  };
}

function parseGeometryBoundaryEdge(value: unknown, label: string): GeometryBoundaryEdge {
  const item = requireRecord(value, label);

  return {
    id: requireString(item.id, `${label} id`),
    sourceWallId: requireString(item.sourceWallId, `${label} sourceWallId`),
    startVertexId: requireString(item.startVertexId, `${label} startVertexId`),
    endVertexId: requireString(item.endVertexId, `${label} endVertexId`),
    start: parseGeometryPoint(item.start, `${label} start`),
    end: parseGeometryPoint(item.end, `${label} end`),
    thickness: requireNumber(item.thickness, `${label} thickness`),
    height: requireNumber(item.height, `${label} height`)
  };
}

function parseGeometryBoundaryEdgeUse(
  value: unknown,
  label: string
): GeometryBoundaryEdgeUse {
  const item = requireRecord(value, label);

  return {
    id: requireString(item.id, `${label} id`),
    boundaryEdgeId: requireString(item.boundaryEdgeId, `${label} boundaryEdgeId`),
    sourceWallId: requireString(item.sourceWallId, `${label} sourceWallId`),
    direction: requireOneOf(item.direction, ["FORWARD", "REVERSE"] as const, `${label} direction`),
    index: requireNumber(item.index, `${label} index`),
    loopId: requireString(item.loopId, `${label} loopId`),
    startVertexId: requireString(item.startVertexId, `${label} startVertexId`),
    endVertexId: requireString(item.endVertexId, `${label} endVertexId`),
    start: parseGeometryPoint(item.start, `${label} start`),
    end: parseGeometryPoint(item.end, `${label} end`)
  };
}

function parseGeometryLoop(value: unknown, label: string): GeometryLoop {
  const item = requireRecord(value, label);

  return {
    id: requireString(item.id, `${label} id`),
    kind: requireOneOf(item.kind, ["OUTER", "INNER"] as const, `${label} kind`),
    polygonId: requireString(item.polygonId, `${label} polygonId`),
    boundaryEdgeUseIds: requireStringArray(item.boundaryEdgeUseIds, `${label} boundaryEdgeUseIds`),
    boundaryEdgeIds: requireStringArray(item.boundaryEdgeIds, `${label} boundaryEdgeIds`),
    vertexIds: requireStringArray(item.vertexIds, `${label} vertexIds`)
  };
}

function parseGeometryPolygon(value: unknown, label: string): GeometryPolygon {
  const item = requireRecord(value, label);
  const metrics = requireRecord(item.metrics, `${label} metrics`);

  return {
    id: requireString(item.id, `${label} id`),
    sourceRoomId: requireString(item.sourceRoomId, `${label} sourceRoomId`),
    outerLoopId: requireString(item.outerLoopId, `${label} outerLoopId`),
    innerLoopIds: requireStringArray(item.innerLoopIds, `${label} innerLoopIds`),
    loopIds: requireStringArray(item.loopIds, `${label} loopIds`),
    boundaryEdgeUseIds: requireStringArray(item.boundaryEdgeUseIds, `${label} boundaryEdgeUseIds`),
    boundaryEdgeIds: requireStringArray(item.boundaryEdgeIds, `${label} boundaryEdgeIds`),
    vertexIds: requireStringArray(item.vertexIds, `${label} vertexIds`),
    metrics: {
      signedArea: requireNumber(metrics.signedArea, `${label} signedArea`),
      area: requireNumber(metrics.area, `${label} area`),
      winding: requireOneOf(
        metrics.winding,
        ["CLOCKWISE", "COUNTER_CLOCKWISE", "DEGENERATE"] as const,
        `${label} winding`
      ),
      bounds: parseGeometryBounds(metrics.bounds, `${label} bounds`),
      centroid: parseGeometryPoint(metrics.centroid, `${label} centroid`)
    }
  };
}

function parseGeometryPoint(value: unknown, label: string): GeometryPoint2D {
  const item = requireRecord(value, label);

  return {
    x: requireNumber(item.x, `${label} x`),
    z: requireNumber(item.z, `${label} z`)
  };
}

function parseGeometryBounds(value: unknown, label: string): GeometryBounds {
  const item = requireRecord(value, label);

  return {
    minX: requireNumber(item.minX, `${label} minX`),
    minZ: requireNumber(item.minZ, `${label} minZ`),
    maxX: requireNumber(item.maxX, `${label} maxX`),
    maxZ: requireNumber(item.maxZ, `${label} maxZ`)
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

function requireStringArray(value: unknown, label: string): readonly string[] {
  return requireArray(value, label).map((item, index) => requireString(item, `${label} ${index}`));
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

function requireOneOf<const Values extends readonly string[]>(
  value: unknown,
  expected: Values,
  label: string
): Values[number] {
  if (typeof value !== "string" || !expected.includes(value)) {
    throw new Error(`${label} must be one of ${expected.join(", ")}.`);
  }

  return value as Values[number];
}
