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

/** Neighbors explain passages from the target; they are not design targets. */
export type DesignAdjacentSpace = Readonly<{
  room: Readonly<{
    id: string;
    name: string;
    type: string;
    level: Readonly<{ id: string; name: string; elevation: number }>;
    floorElevation: number;
  }>;
  connections: readonly Readonly<{
    kind: "door" | "wall-opening";
    wallId: string;
    openingId: string;
    width: number;
    height: number;
    offsetFromWallStart: number;
    sillElevation: number;
    targetBoundaryDirection?: "FORWARD" | "REVERSE";
  }>[];
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
    area?: number;
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
  spatialContext: Readonly<{ adjacentSpaces: readonly DesignAdjacentSpace[] }>;
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

/** Saved visual design state is never canonical geometry. Bytes are loaded server-side. */
export type DesignRefinementRequest = Omit<DesignRequest, "iteration"> &
  Readonly<{
    baseProposal: Readonly<{
      id: string;
      target: DesignTarget;
      projectRevision: number;
      artifact: DesignArtifact;
    }>;
    preservation: "preserve-unrequested-design";
    providerContinuation?: Readonly<Record<string, string>>;
  }>;

export type DesignConversation = Readonly<{
  id: string;
  target: DesignTarget;
  rootProposalId: string;
  createdAt: string;
  updatedAt: string;
}>;

/** A child Proposal is also the durable design turn; no duplicate image or instruction. */
export type DesignProposalLineage = Readonly<{
  conversationId: string;
  parentProposalId: string;
  turnNumber: number;
}>;

export type DesignConversationPage = Readonly<{
  conversation: DesignConversation;
  rootProposal: DurableDesignProposal;
  iterations: readonly DurableDesignProposal[];
  nextAfterTurn?: number;
}>;

/** Provider-neutral usage reported by one generation request. */
export type DesignGenerationUsage = Readonly<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
  cacheWriteInputTokens?: number;
  reasoningTokens?: number;
}>;

/** Safe, normalized generation metadata used to compare development profiles. */
export type DesignGenerationTelemetry = Readonly<{
  provider: string;
  orchestrationModel?: string;
  imageModel?: string;
  generationMode?: "edit" | "generate";
  durationMs: number;
  generatedAt: string;
  image: Readonly<{
    width?: number;
    height?: number;
    format: "png" | "jpeg" | "webp";
    quality?: string;
  }>;
  usage?: DesignGenerationUsage;
  estimatedCost?: Readonly<{
    amount: number;
    currency: "USD";
    basis: string;
  }>;
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
  }>;
  telemetry?: DesignGenerationTelemetry;
  structuredSuggestions?: readonly unknown[];
}>;

/** Application-owned history; never part of canonical ProjectSchema. */
export type DurableDesignProposal = DesignProposal &
  Readonly<{
    projectRevision: number;
    instructions: string;
    referenceFingerprint: string;
    artifact: DesignArtifact & Readonly<{ byteSize: number; sha256: string }>;
    lineage?: DesignProposalLineage;
  }>;

export type DesignProposalHistory = Readonly<{
  proposals: readonly DurableDesignProposal[];
  nextCursor?: string;
}>;
