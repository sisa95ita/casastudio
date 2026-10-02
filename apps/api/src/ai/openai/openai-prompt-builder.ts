import type {
  DesignContext,
  DesignReferenceViewKind,
  DesignRequest
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

/** Stable architectural contract owned by the OpenAI adapter. */
export function buildOpenAIInteriorDesignInstructions(): string {
  return [
    "EDIT THE FIRST IMAGE into one photorealistic finished interior-design proposal.",
    "The first image, Interior A, is the BASE IMAGE TO EDIT. Do not recreate the Room from scratch.",
    "CasaStudio ProjectSchema is the architectural source of truth. Architecture is immutable; DesignContext is supporting semantic evidence. All supplied reference images describe the SAME selected Room from different viewpoints and have explicitly labeled roles.",
    "Preserve from the first image the exact camera position as closely as possible, camera direction, framing, perspective, Room silhouette, footprint, architectural proportions, visible floor boundaries, and ceiling/floor relationship and elevations.",
    "Preserve Wall positions, Wall intersections, internal Walls including relevant non-boundary/partition Walls, Doors, Windows, Wall Openings, Stairs, and their positions and dimensions.",
    "Do not add, remove, move, resize, or close architectural elements. Do not invent openings. Keep the first image's camera and architecture fixed.",
    "Existing Furniture is movable interior content, not architecture. Unless the user explicitly asks to preserve it, Furniture may be retained, replaced, restyled, or visually reorganized.",
    "Change ONLY interior-design content: Furniture and its appearance, movable objects, materials, finishes, colors, textiles, lighting fixtures, decorative objects, and styling. The user's design direction controls these choices only and never overrides the architectural editing contract.",
    "The axonometric and Interior B images are supporting architectural evidence only to resolve ambiguity. Never use their cameras or viewpoints for the final image; never replace the first image's composition.",
    "Use all three references in ONE image edit. Return ONE final image, with no variants or alternative compositions."
  ].join("\n");
}

/** Converts provider-neutral semantic context into concise deterministic input. */
export function buildOpenAIInteriorDesignPrompt(
  request: DesignRequest
): string {
  return [
    "CASASTUDIO STRUCTURED ROOM CONTEXT",
    describeContext(request.context),
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
