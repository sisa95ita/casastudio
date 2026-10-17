import {
  createFurniture,
  createFurnitureItemFromDefinition,
  duplicateFurniture,
  moveFurniture,
  reassignFurniture,
  resizeFurniture,
  rotateFurniture,
  resolveBuiltinFurnitureDefinition,
  type FurnitureItem,
  type Point2D,
  type Project,
  type ProjectEditingResult
} from "@casastudio/schema";
import {
  furnitureRoomCandidates,
  validateFurniturePlacement,
  type FurnitureRoomCandidate
} from "@casastudio/geometry";
export {
  furnitureRoomCandidates,
  validateFurniturePlacement,
  type FurnitureRoomCandidate,
  type FurniturePlacementIssue,
  type FurniturePlacementWarning,
  type FurniturePlacementValidation
} from "@casastudio/geometry";
import type { PrecisionTranslationResult } from "../../../geometry-2d/precision/precision-assistance-2d";

/** Properties editable without replacing canonical identity or catalog definition. */
export type FurniturePropertyChanges = Partial<
  Pick<
    FurnitureItem,
    "position" | "width" | "depth" | "height" | "rotation" | "roomId"
  >
>;

/** Serializable authoring proposal; an empty roomId is transient and can never commit. */
export type FurnitureInteraction = {
  readonly kind: "furniture";
  readonly intent: "place" | "duplicate" | "move" | "rotate";
  readonly item: FurnitureItem;
  readonly sourceId?: string;
  readonly positioned: boolean;
  /** Spatial preview becomes visible only after the canvas supplies its first anchor. */
  readonly previewVisible?: boolean;
  readonly awaitingRoom?: boolean;
  /** Explicit placement target retained only while its Room contains the center. */
  readonly explicitRoomId?: string;
  /** Exact transient assistance shared by preview and gesture commit. */
  readonly precision?: PrecisionTranslationResult;
  readonly gesture?: {
    readonly pointerId: number;
    readonly start: Point2D;
    readonly original: FurnitureItem;
  };
};

/** Preserves an eligible target, auto-resolves one candidate, and never guesses among overlaps. */
export function resolveFurnitureTarget(
  candidates: readonly FurnitureRoomCandidate[],
  preferred?: string
): string {
  return candidates.some((candidate) => candidate.roomId === preferred)
    ? preferred!
    : candidates.length === 1
      ? candidates[0]!.roomId
      : "";
}

/** Copies canonical catalog defaults into a detached placement proposal. */
export function startFurniturePlacement(
  definitionId: string
): FurnitureInteraction | undefined {
  const definition = resolveBuiltinFurnitureDefinition(definitionId);
  if (!definition) return undefined;
  const item = createFurnitureItemFromDefinition(definition, {
    id: "furniture-preview",
    roomId: "pending-room",
    position: { x: 0, z: 0 }
  });
  return {
    kind: "furniture",
    intent: "place",
    item: { ...item, roomId: "" },
    positioned: false,
    previewVisible: false
  };
}

/** Updates only transient geometry and safely re-resolves ownership at the new center. */
export function positionFurniture(
  project: Project,
  levelId: string,
  interaction: FurnitureInteraction,
  position: Point2D
): FurnitureInteraction {
  const candidates = furnitureRoomCandidates(project, levelId, position);
  const placing =
    interaction.intent === "place" || interaction.intent === "duplicate";
  const explicitRoomId = candidates.some(
    (candidate) => candidate.roomId === interaction.explicitRoomId
  )
    ? interaction.explicitRoomId
    : undefined;
  const roomId = resolveFurnitureTarget(
    candidates,
    placing ? explicitRoomId : interaction.item.roomId
  );
  return {
    ...interaction,
    explicitRoomId,
    positioned: true,
    previewVisible: true,
    item: { ...interaction.item, position, roomId }
  };
}

/** Commits a validated placement, duplicate, or move through canonical operations. */
export function commitFurnitureInteraction(
  project: Project,
  levelId: string,
  interaction: FurnitureInteraction,
  newId: string
): ProjectEditingResult | undefined {
  const { item } = interaction;
  const ignoreFurnitureId =
    interaction.intent === "move" || interaction.intent === "rotate"
      ? interaction.sourceId
      : undefined;
  if (
    !interaction.positioned ||
    validateFurniturePlacement(project, levelId, item, ignoreFurnitureId)
      .status === "INVALID"
  )
    return undefined;
  if (interaction.intent === "rotate" && interaction.sourceId) {
    return rotateFurniture(project, {
      furnitureId: interaction.sourceId,
      rotation: item.rotation
    });
  }
  if (interaction.intent === "duplicate" && interaction.sourceId) {
    const duplicated = duplicateFurniture(project, {
      furnitureId: interaction.sourceId,
      newId,
      position: item.position,
      roomId: item.roomId
    });
    if (!duplicated.ok) return duplicated;
    const resized = resizeFurniture(duplicated.project, {
      furnitureId: newId,
      width: item.width,
      depth: item.depth,
      height: item.height
    });
    return resized.ok
      ? rotateFurniture(resized.project, {
          furnitureId: newId,
          rotation: item.rotation
        })
      : resized;
  }
  if (interaction.intent === "move" && interaction.sourceId) {
    const moved = moveFurniture(project, {
      furnitureId: interaction.sourceId,
      position: item.position
    });
    return moved.ok
      ? reassignFurniture(moved.project, {
          furnitureId: interaction.sourceId,
          roomId: item.roomId
        })
      : moved;
  }
  return interaction.intent === "place"
    ? createFurniture(project, { furniture: { ...item, id: newId } })
    : undefined;
}
