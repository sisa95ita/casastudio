import {
  convertPhysicalLength,
  formatDisplayValue,
  validateRoomShapeDefinition,
  ValidationErrorCode,
  type Project,
  type RoomShapeDefinition,
  type RoomShapeRotation
} from "@casastudio/schema";

/** Editable physical parameters held for transient Room shape placement. */
export type RoomShapeDimensionDraft = {
  readonly width: string;
  readonly depth: string;
  readonly notchWidth: string;
  readonly notchDepth: string;
  readonly rotation: string;
};

/** Initial editable Room shape values in canonical centimeter Project units. */
export const defaultRoomShapeDimensions: RoomShapeDimensionDraft = Object.freeze({
  width: "400",
  depth: "300",
  notchWidth: "150",
  notchDepth: "120",
  rotation: "0"
});

/** Localized feedback categories for explicit Room authoring actions. */
export type RoomEditingErrorKey =
  | "errors.room.none"
  | "errors.room.assigned"
  | "errors.room.subdivision"
  | "errors.room.doorReference"
  | "errors.room.viewpointReference"
  | "errors.room.staircaseReference"
  | "errors.room.stale"
  | "errors.room.geometry"
  | "errors.room.referenced"
  | "errors.room.dissolutionAmbiguous"
  | "errors.room.dissolutionInvalid"
  | "errors.room.metadata"
  | "errors.room.invalid";

/** Returns sensible editable defaults expressed in canonical Project units. */
export function getDefaultRoomShapeDimensions(
  kind: "RECTANGLE" | "L_SHAPE"
): RoomShapeDimensionDraft {
  return kind === "RECTANGLE"
    ? { ...defaultRoomShapeDimensions }
    : {
        width: "500",
        depth: "400",
        notchWidth: "200",
        notchDepth: "150",
        rotation: "0"
      };
}

/** Parses locally editable fields into one validated authoring-only shape. */
export function parseRoomShapeDefinition(
  kind: "RECTANGLE" | "L_SHAPE",
  draft: RoomShapeDimensionDraft
): RoomShapeDefinition | undefined {
  const shape: RoomShapeDefinition = kind === "RECTANGLE"
    ? {
        kind,
        dimensions: { width: Number(draft.width), depth: Number(draft.depth) },
        rotation: Number(draft.rotation) as RoomShapeRotation
      }
    : {
        kind,
        dimensions: {
          width: Number(draft.width),
          depth: Number(draft.depth),
          notchWidth: Number(draft.notchWidth),
          notchDepth: Number(draft.notchDepth)
        },
        rotation: Number(draft.rotation) as RoomShapeRotation
      };
  return validateRoomShapeDefinition(shape) ? shape : undefined;
}

/** Formats compact physical dimensions for the transient Room preview. */
export function formatRoomShapePreviewLabel(
  shape: RoomShapeDefinition,
  unit: Project["units"]["length"],
  elevation?: number
): string {
  const format = (value: number) => formatDisplayValue(
    convertPhysicalLength(value, unit, "m"),
    2,
    true
  );
  const outer = `${format(shape.dimensions.width)} × ${format(shape.dimensions.depth)} m`;
  const shapeLabel = shape.kind === "RECTANGLE"
    ? outer
    : `L ${outer} · ${format(shape.dimensions.notchWidth)} × ${format(shape.dimensions.notchDepth)} m`;
  return elevation === undefined ? shapeLabel : `${shapeLabel} · +${format(elevation)} m`;
}

/** Maps Room-authoring validation codes to localized presentation messages. */
export function getRoomEditingErrorKey(
  code: ValidationErrorCode | undefined
): RoomEditingErrorKey {
  switch (code) {
    case ValidationErrorCode.DUPLICATE_ROOM_BOUNDARY:
      return "errors.room.assigned";
    case ValidationErrorCode.ROOM_SUBDIVISION_NOT_FOUND:
    case ValidationErrorCode.INVALID_ROOM_SUBDIVISION_INPUT:
      return "errors.room.subdivision";
    case ValidationErrorCode.ROOM_PARTITION_OPENING_AMBIGUOUS:
      return "errors.room.doorReference";
    case ValidationErrorCode.ROOM_SUBDIVISION_DOOR_REFERENCE_AMBIGUOUS:
      return "errors.room.doorReference";
    case ValidationErrorCode.ROOM_SUBDIVISION_VIEWPOINT_REFERENCE_AMBIGUOUS:
      return "errors.room.viewpointReference";
    case ValidationErrorCode.ROOM_SUBDIVISION_STAIRCASE_REFERENCE_AMBIGUOUS:
      return "errors.room.staircaseReference";
    case ValidationErrorCode.STALE_ROOM_TOPOLOGY:
      return "errors.room.stale";
    case ValidationErrorCode.INVALID_ROOM_BOUNDARY:
    case ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED:
    case ValidationErrorCode.SELF_INTERSECTING_ROOM_BOUNDARY:
      return "errors.room.geometry";
    default:
      return "errors.room.invalid";
  }
}
