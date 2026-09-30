import type {
  DesignContext,
  DesignReferenceViewKind,
  DesignRequest
} from "@casastudio/ai";

const referenceRoles: Readonly<
  Record<DesignReferenceViewKind, { readonly title: string; readonly role: string }>
> = Object.freeze({
  "room-interior-a": {
    title: "PRIMARY OUTPUT VIEW — INTERIOR PERSPECTIVE A",
    role: "Use this as the primary photographic composition and viewpoint for the generated interior render."
  },
  "room-axonometric": {
    title: "STRUCTURAL/LAYOUT REFERENCE — ROOM AXONOMETRIC",
    role: "Use this to preserve the room footprint, wall and partition relationships, opening placement, spatial proportions, and existing movable furniture context. Do not reproduce its dollhouse/axonometric viewpoint."
  },
  "room-interior-b": {
    title: "SUPPORTING GEOMETRY — INTERIOR PERSPECTIVE B",
    role: "Use this complementary view to preserve geometry, openings, and wall relationships hidden from the primary view."
  },
  "current-user-view": {
    title: "OPTIONAL SUPPORTING VIEW — CURRENT USER VIEW",
    role: "Use this only as additional evidence; it does not override the primary output view or canonical architecture."
  }
});

/** Stable architectural contract owned by the OpenAI adapter. */
export function buildOpenAIInteriorDesignInstructions(): string {
  return [
    "You are CasaStudio's professional interior-design renderer.",
    "The CasaStudio architectural geometry is authoritative and immutable. All supplied reference images describe the SAME selected Room from different viewpoints and have explicitly labeled roles.",
    "This task is INTERIOR DESIGN OF AN EXISTING ARCHITECTURE, not ARCHITECTURAL REDESIGN.",
    "Preserve the Room shape, footprint, proportions, floor and ceiling elevations, every visible or declared Wall, relevant internal/partition Walls, Doors, Windows, Wall Openings, Stairs, and their positions and dimensions.",
    "Do not add, remove, move, resize, or close structural Walls, Doors, Windows, Wall Openings, or Stairs. Do not invent architectural openings or redesign the architecture.",
    "Existing Furniture is movable interior content, not architecture. Unless the user explicitly asks to preserve it, Furniture may be retained, replaced, restyled, or visually reorganized.",
    "The user's design direction may control Furniture, materials, finishes, decoration, lighting, colors, textiles, and movable objects, but it never overrides the architectural constraints above.",
    "Create one photorealistic, real-world interior-design render. Match the labeled PRIMARY OUTPUT VIEW rather than producing an axonometric, dollhouse, floor-plan, cutaway, or whole-building image.",
    "Use every supplied reference intentionally and reconcile them with the canonical semantic Room context."
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
    "Each following image is preceded by its semantic role. Use Interior Perspective A as the output composition; use the other views as architectural evidence."
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
