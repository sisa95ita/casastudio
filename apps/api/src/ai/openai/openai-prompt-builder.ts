import type {
  DesignContext,
  DesignReferenceViewKind,
  DesignRequest,
  DesignRefinementRequest
} from "@casastudio/ai";

const referenceRoles: Readonly<
  Record<
    DesignReferenceViewKind,
    { readonly title: string; readonly role: string }
  >
> = Object.freeze({
  "room-interior-a": {
    title: "REFERENCE 1 — INTERIOR A — BASE IMAGE TO EDIT",
    role: "EDIT THE FIRST IMAGE. Its composition and camera are authoritative for the final image. Preserve its layout, proportions, framing and perspective; change only interior-design content."
  },
  "room-axonometric": {
    title: "REFERENCE 2 — AXONOMETRIC — STRUCTURAL / LAYOUT EVIDENCE ONLY",
    role: "Use this only to resolve ambiguity and verify Room footprint, partitions, Walls and Openings. Do NOT copy its camera or viewpoint into the final image or replace the first image's composition."
  },
  "room-interior-b": {
    title:
      "REFERENCE 3 — INTERIOR B — COMPLEMENTARY ARCHITECTURAL EVIDENCE ONLY",
    role: "Use this only to resolve ambiguity about architecture not visible in Interior A. Do NOT switch the final viewpoint to this image or replace the first image's composition."
  },
  "current-user-view": {
    title: "OPTIONAL SUPPORTING VIEW — CURRENT USER VIEW",
    role: "Use this only as additional evidence; it does not override the primary output view or canonical architecture."
  }
});

export function buildOpenAIRefinementInstructions(): string {
  return [
    "DESIGN REFINEMENT EDIT CONTRACT",
    "EDIT THE FIRST IMAGE, the previous Proposal, as the PRIMARY BASE IMAGE TO EDIT. Never generate from scratch or replace its camera/composition with a supporting view.",
    "BASE DESIGN: previous Proposal pixels describe current visual design state, never canonical geometry.",
    "ARCHITECTURE: CasaStudio ProjectSchema, current DesignContext and Room references are immutable architectural truth. Re-anchor EVERY turn to this evidence, including Room shape, Walls, internal/non-boundary partitions, Doors, Windows, Wall Openings, Stairs, dimensions, elevations and direct Room adjacency. If base pixels conflict with canonical architecture, canonical architecture takes precedence.",
    "USER CHANGE: interpret the follow-up instruction as a delta to the base design in this same image edit.",
    "DEFAULT RULE: preserve everything not requested to change. Keep unrelated furniture, arrangement, materials, finishes, lighting and decoration stable. Change only the requested design elements. A broader request such as a more minimal arrangement permits broader design/layout changes, while architecture always remains fixed.",
    "Design only the selected Room; adjacent spaces are context only. Preserve their connecting geometry. Do not redesign or merge adjacent Rooms.",
    "Use all four intended images in ONE edit. Return ONE final image; no variants, retries or alternative compositions."
  ].join("\n");
}

export function buildOpenAIRefinementPrompt(
  request: DesignRefinementRequest
): string {
  return [
    "BASE DESIGN: first image is the persisted previous Proposal, not architectural truth.",
    "CURRENT CANONICAL ROOM ARCHITECTURE",
    describeContext(request.context),
    // Include precise evidence every turn, without canonical Project serialization.
    JSON.stringify({
      boundary: request.context.room.boundary,
      walls: request.context.walls,
      stairs: request.context.stairs,
      floorElevation: request.context.room.floorElevation,
      units: request.context.units,
      coordinateSystem: request.context.coordinateSystem
    }),
    "LOCAL SPATIAL CONTEXT",
    describeSpatialContext(request.context).replaceAll(
      "Interior A",
      "the base Proposal"
    ),
    "USER CHANGE — FOLLOW-UP DELTA",
    request.instructions.trim(),
    "PRESERVE BY DEFAULT: everything not requested to change remains stable; architecture remains fixed.",
    ...(request.constraints?.length
      ? [`Additional design constraints: ${request.constraints.join("; ")}`]
      : []),
    ...(request.elementsToPreserve?.length
      ? [
          `Design elements to preserve: ${request.elementsToPreserve.join("; ")}`
        ]
      : []),
    "Image order: previous Proposal (primary edit); axonometric (layout); Interior A (canonical camera evidence); Interior B (complementary architecture). Supporting references never replace the base design."
  ].join("\n\n");
}

export function describeOpenAIRefinementReference(
  kind: DesignReferenceViewKind
): string {
  const roles: Record<DesignReferenceViewKind, string> = {
    "room-axonometric":
      "REFERENCE 2 — AXONOMETRIC — CANONICAL STRUCTURAL / LAYOUT EVIDENCE",
    "room-interior-a":
      "REFERENCE 3 — INTERIOR A — CANONICAL CAMERA / ARCHITECTURAL EVIDENCE",
    "room-interior-b":
      "REFERENCE 4 — INTERIOR B — COMPLEMENTARY ARCHITECTURAL EVIDENCE",
    "current-user-view": "OPTIONAL SUPPORTING VIEW — CURRENT USER VIEW"
  };
  return `${roles[kind]}\nSupporting immutable architecture only; do not substitute this image for the base Proposal or copy its viewpoint.`;
}

/** Stable architectural contract owned by the OpenAI adapter. */
export function buildOpenAIInteriorDesignInstructions(): string {
  return [
    "ARCHITECTURAL EDIT CONTRACT",
    "EDIT THE FIRST IMAGE into one photorealistic finished interior-design proposal.",
    "The first image, Interior A, is the BASE IMAGE TO EDIT. Do not recreate the Room from scratch.",
    "CasaStudio ProjectSchema is the architectural source of truth. Architecture is immutable; DesignContext is supporting semantic evidence. All supplied reference images describe the SAME selected Room from different viewpoints and have explicitly labeled roles.",
    "Preserve from the first image the exact camera position as closely as possible, camera direction, framing, perspective, Room silhouette, footprint, architectural proportions, visible floor boundaries, and ceiling/floor relationship and elevations.",
    "Preserve Wall positions, Wall intersections, internal Walls including relevant non-boundary/partition Walls, Doors, Windows, Wall Openings, Stairs, and their positions and dimensions.",
    "Do not add, remove, move, resize, or close architectural elements. Do not invent openings. Keep the first image's camera and architecture fixed.",
    "Existing Furniture is movable interior content, not architecture. Unless the user explicitly asks to preserve it, Furniture may be retained, replaced, restyled, or visually reorganized.",
    "Change ONLY interior-design content: Furniture and its appearance, movable objects, materials, finishes, colors, textiles, lighting fixtures, decorative objects, and styling. The user's design direction controls these choices only and never overrides the architectural editing contract.",
    "The axonometric and Interior B images are supporting architectural evidence only to resolve ambiguity. Never use their cameras or viewpoints for the final image; never replace the first image's composition.",
    "Design only the selected target Room. Adjacent Rooms are context only, not secondary design targets. If visible through a canonical connection in Interior A, represent their canonical identity/type, preserve the connecting architecture, and do not merge them into the target Room or treat them as a second design brief. Background contents remain non-canonical proposal pixels.",
    "Use all three references in ONE image edit. Return ONE final image, with no variants or alternative compositions."
  ].join("\n");
}

/** Converts provider-neutral semantic context into concise deterministic input. */
export function buildOpenAIInteriorDesignPrompt(
  request: DesignRequest
): string {
  return [
    "TARGET ROOM CONTEXT — CASASTUDIO STRUCTURED ROOM CONTEXT",
    describeContext(request.context),
    "LOCAL SPATIAL CONTEXT",
    describeSpatialContext(request.context),
    "USER DESIGN DIRECTION",
    request.instructions.trim(),
    request.constraints?.length
      ? `Additional non-architectural constraints: ${request.constraints.join("; ")}`
      : "Additional non-architectural constraints: none.",
    request.elementsToPreserve?.length
      ? `Movable/design elements to preserve: ${request.elementsToPreserve.join("; ")}`
      : "Movable/design elements to preserve: none specified.",
    "REFERENCE IMAGE GUIDE",
    "Each following image is preceded by its semantic role. EDIT THE FIRST IMAGE (Interior A); the axonometric and Interior B are supporting evidence only, never alternative compositions."
  ].join("\n\n");
}

export function describeOpenAIReferenceRole(
  kind: DesignReferenceViewKind
): string {
  const descriptor = referenceRoles[kind];
  return `${descriptor.title}\n${descriptor.role}`;
}

function describeContext(context: DesignContext): string {
  const boundaryWallIds = new Set(
    context.room.boundary.flatMap((edge) => (edge.wallId ? [edge.wallId] : []))
  );
  const openingCounts = context.walls
    .flatMap((wall) => wall.openings)
    .reduce(
      (counts, opening) => ({
        ...counts,
        [opening.type]: counts[opening.type] + 1
      }),
      { door: 0, window: 0, opening: 0 }
    );
  const lines = [
    `Room: ${context.room.name} (${context.room.type}).`,
    context.room.description
      ? `Canonical description: ${context.room.description}.`
      : undefined,
    context.room.extents
      ? `Approximate plan extents: ${format(context.room.extents.width)} × ${format(context.room.extents.depth)} ${context.units.length}.`
      : undefined,
    context.room.area !== undefined
      ? `Approximate plan area: ${format(context.room.area)} square ${context.units.length}.`
      : undefined,
    `Level: ${context.level.name}; Level elevation ${format(context.level.elevation)} ${context.units.length}; Room floor elevation ${format(context.room.floorElevation)} ${context.units.length}.`,
    `Architecture: ${context.walls.length} relevant Walls (${boundaryWallIds.size} boundary, ${context.walls.length - boundaryWallIds.size} additional internal/partition); ${openingCounts.door} Doors; ${openingCounts.window} Windows; ${openingCounts.opening} Wall Openings; ${context.stairs.length} relevant Stairs.`,
    ...context.walls.map((wall, index) => {
      const kind = boundaryWallIds.has(wall.id)
        ? "boundary Wall"
        : "internal/partition Wall";
      const length = Math.hypot(
        wall.end.x - wall.start.x,
        wall.end.z - wall.start.z
      );
      const openings = wall.openings.length
        ? ` Hosted openings: ${wall.openings
            .map(
              (opening) =>
                `${opening.type} ${format(opening.width)}w × ${format(opening.height)}h at ${format(opening.offsetFromWallStart)} from Wall start, sill ${format(opening.sillElevation)} ${context.units.length}`
            )
            .join("; ")}.`
        : " No hosted openings.";
      return `Wall ${index + 1} (${kind}${wall.name ? `, ${wall.name}` : ""}): ${format(length)} long × ${format(wall.height)} high × ${format(wall.thickness)} thick ${context.units.length}.${openings}`;
    }),
    ...context.stairs.map(
      (stair, index) =>
        `Stair ${index + 1}${stair.name ? ` (${stair.name})` : ""}: width ${format(stair.width)} ${context.units.length}, ${stair.flights.length} flights, ${stair.landings.length} landings; connects the Room across Levels.`
    ),
    context.furniture.length
      ? `Existing movable Furniture (${context.furniture.length}): ${context.furniture
          .map(
            (item) =>
              `${item.name ?? "unnamed item"} (${format(item.width)} × ${format(item.depth)} × ${format(item.height)} ${context.units.length})`
          )
          .join("; ")}.`
      : "Existing movable Furniture: none.",
    `Canonical units: lengths are ${context.units.length}; angles are ${context.units.angle}.`
  ];
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Bound only provider prose; the neutral context retains every direct passage. */
function describeSpatialContext(context: DesignContext): string {
  const spaces = [...context.spatialContext.adjacentSpaces].sort(
    (a, b) =>
      b.connections.reduce((width, item) => Math.max(width, item.width), 0) -
        a.connections.reduce((width, item) => Math.max(width, item.width), 0) ||
      compare(a.room.id, b.room.id)
  );
  const shown = spaces.slice(0, 12);
  const lines = [
    "Only direct same-Level canonical connections are listed. Adjacent Rooms are context only, not secondary design targets. The selected Room remains the sole design target.",
    "If a listed space is visible through its connection in edited Interior A, depict it consistently with its canonical name/type. Preserve connection geometry; do not merge Rooms, reinterpret the neighbor as an extension of the target, or redesign background architecture. Do not reveal spaces hidden in Interior A or use background context as a second full design brief.",
    ...(spaces.length
      ? []
      : [
          "No resolved direct Room connections. Do not infer neighbor identity from proximity or an unidentified opening."
        ])
  ];
  for (const space of shown) {
    const passages = [...space.connections].sort(
      (a, b) =>
        b.width - a.width ||
        compare(a.wallId, b.wallId) ||
        compare(a.openingId, b.openingId)
    );
    const descriptions = passages.slice(0, 4).map((connection) => {
      const wallIndex = context.walls.findIndex(
        (wall) => wall.id === connection.wallId
      );
      return `${connection.kind === "door" ? "Door" : "Wall Opening"}${wallIndex >= 0 ? ` on Wall ${wallIndex + 1}` : ""}, ${format(connection.width)}w × ${format(connection.height)}h at ${format(connection.offsetFromWallStart)} from canonical Wall start, sill ${format(connection.sillElevation)} ${context.units.length}`;
    });
    lines.push(
      `Directly connected Room ${label(space.room.name)} (type ${label(space.room.type)}), Level ${label(space.room.level.name)}, floor elevation ${format(space.room.floorElevation)} ${context.units.length}: ${descriptions.join("; ")}.${passages.length > 4 ? ` ${passages.length - 4} additional connections omitted.` : ""}`
    );
  }
  if (spaces.length > shown.length) {
    lines.push(
      `${spaces.length - shown.length} additional direct spaces omitted. Widest passages take priority; omitted identities must not be guessed.`
    );
  }
  return lines.join("\n");
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function label(value: string): string {
  return JSON.stringify(value.length > 120 ? `${value.slice(0, 119)}…` : value);
}
