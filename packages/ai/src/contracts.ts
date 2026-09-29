/** Stable reference to the canonical entity being designed. */
export type DesignTarget = Readonly<{
  kind: "room";
  projectId: string;
  levelId: string;
  roomId: string;
}>;

export type DesignPoint2D = Readonly<{ x: number; z: number }>;
export type DesignPoint3D = Readonly<{ x: number; y: number; z: number }>;

/** Ordered, canonical Room perimeter segment. */
export type DesignBoundarySegment = Readonly<{
  kind: "wall" | "free";
  start: DesignPoint2D;
  end: DesignPoint2D;
  wallId?: string;
}>;

export type DesignOpeningContext = Readonly<{
  id: string;
  type: "door" | "window" | "opening";
  offsetFromWallStart: number;
  width: number;
  height: number;
  sillElevation: number;
  connectedRoomIds?: readonly string[];
}>;

export type DesignWallContext = Readonly<{
  id: string;
  name?: string;
  start: DesignPoint2D;
  end: DesignPoint2D;
  height: number;
  thickness: number;
  openings: readonly DesignOpeningContext[];
}>;

export type DesignStairContext = Readonly<{
  id: string;
  name?: string;
  owningLevelId: string;
  fromLevelId: string;
  toLevelId: string;
  fromRoomId?: string;
  toRoomId?: string;
  width: number;
  flights: readonly Readonly<{
    start: DesignPoint2D;
    end: DesignPoint2D;
    startElevation: number;
    endElevation: number;
    stepCount: number;
  }>[];
  landings: readonly Readonly<{
    position: DesignPoint2D;
    width: number;
    depth: number;
    elevation: number;
  }>[];
}>;

export type DesignFurnitureContext = Readonly<{
  id: string;
  name?: string;
  definitionId: string;
  position: DesignPoint2D;
  rotationDegrees: number;
  width: number;
  depth: number;
  height: number;
}>;

/** Provider-neutral semantic snapshot derived from canonical Project data. */
export type DesignContext = Readonly<{
  project: Readonly<{ id: string; name: string; revision: number }>;
  level: Readonly<{ id: string; name: string; elevation: number }>;
  room: Readonly<{
    id: string;
    name: string;
    type: string;
    description?: string;
    elevation: number;
    floorElevation: number;
    boundary: readonly DesignBoundarySegment[];
    extents?: Readonly<{
      minX: number;
      minZ: number;
      maxX: number;
      maxZ: number;
      width: number;
      depth: number;
    }>;
  }>;
  walls: readonly DesignWallContext[];
  stairs: readonly DesignStairContext[];
  furniture: readonly DesignFurnitureContext[];
  units: Readonly<{ length: "cm"; angle: "deg" }>;
  coordinateSystem: Readonly<{
    handedness: "right-handed";
    horizontalAxes: "X/Z";
    elevationAxis: "+Y";
  }>;
}>;

export type DesignReferenceViewKind =
  | "room-axonometric"
  | "room-interior-a"
  | "room-interior-b"
  | "current-user-view";

/** Browser-produced visual evidence; no renderer object crosses this boundary. */
export type DesignReferenceView = Readonly<{
  kind: DesignReferenceViewKind;
  target: DesignTarget;
  image: Readonly<{
    dataUrl: string;
    mimeType: "image/png" | "image/jpeg" | "image/webp";
    width: number;
    height: number;
  }>;
  camera: Readonly<{
    projection: "perspective";
    position: DesignPoint3D;
    direction: DesignPoint3D;
    up: DesignPoint3D;
    verticalFovDegrees?: number;
  }>;
}>;

export type DesignRequest = Readonly<{
  target: DesignTarget;
  instructions: string;
  context: DesignContext;
  referenceViews: readonly DesignReferenceView[];
  preferences?: Readonly<Record<string, string>>;
  constraints?: readonly string[];
  elementsToPreserve?: readonly string[];
  iteration?: Readonly<{
    sessionId?: string;
    previousProposalId?: string;
    providerContinuation?: Readonly<Record<string, string>>;
  }>;
}>;

export type DesignArtifact = Readonly<{
  kind: "image";
  uri: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width?: number;
  height?: number;
}>;

export type DesignProposal = Readonly<{
  id: string;
  target: DesignTarget;
  status: "succeeded";
  artifact: DesignArtifact;
  createdAt: string;
  session?: Readonly<{
    id: string;
    previousProposalId?: string;
  }>;
  providerMetadata?: Readonly<{
    provider: string;
    requestId?: string;
    continuation?: Readonly<Record<string, string>>;
  }>;
  structuredSuggestions?: readonly unknown[];
}>;
