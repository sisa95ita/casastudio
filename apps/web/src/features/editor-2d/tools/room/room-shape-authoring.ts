import {
  convertPhysicalLength,
  formatDisplayValue,
  validateRoomShapeDefinition,
  ValidationErrorCode,
  type Project,
  type RoomType,
  type RoomShapeDefinition,
  type RoomShapeKind,
  type RoomShapeRotation
} from "@casastudio/schema";

/** Editable physical parameters held for transient Room shape placement. */
export type RoomShapeDimensionDraft = {
  readonly width: string;
  readonly depth: string;
  readonly notchWidth: string;
  readonly notchDepth: string;
  readonly leftWingWidth: string;
  readonly rightWingWidth: string;
  readonly stemWidth: string;
  readonly stemDepth: string;
  readonly rotation: string;
};

/** Initial editable Room shape values in canonical centimeter Project units. */
export const defaultRoomShapeDimensions: RoomShapeDimensionDraft = Object.freeze({
  width: "400",
  depth: "300",
  notchWidth: "150",
  notchDepth: "120",
  leftWingWidth: "120",
  rightWingWidth: "120",
  stemWidth: "160",
  stemDepth: "220",
  rotation: "0"
});

/** Product-level Room suggestions that compile to ordinary canonical Rooms. */
export type RoomAuthoringPreset = "CUSTOM" | "BEDROOM" | "BATHROOM" | "KITCHEN" | "LIVING_ROOM";

/** Deterministic, non-persisted values supplied by one Room authoring preset. */
export type RoomAuthoringPresetValues = {
  readonly roomType: RoomType;
  readonly shape: RoomShapeKind;
  readonly dimensions: RoomShapeDimensionDraft;
};

/** Resolves one transient Room preset without introducing canonical metadata. */
export function getRoomAuthoringPresetValues(preset: RoomAuthoringPreset): RoomAuthoringPresetValues {
  switch (preset) {
    case "BEDROOM":
      return { roomType: "BEDROOM", shape: "RECTANGLE", dimensions: dimensions(360, 320) };
    case "BATHROOM":
      return { roomType: "BATHROOM", shape: "RECTANGLE", dimensions: dimensions(240, 200) };
    case "KITCHEN":
      return { roomType: "KITCHEN", shape: "L_SHAPE", dimensions: { ...dimensions(420, 340), notchWidth: "140", notchDepth: "120" } };
    case "LIVING_ROOM":
      return { roomType: "LIVING_ROOM", shape: "RECTANGLE", dimensions: dimensions(500, 400) };
    default:
      return { roomType: "OTHER", shape: "RECTANGLE", dimensions: getDefaultRoomShapeDimensions("RECTANGLE") };
  }
}

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
  kind: RoomShapeKind
): RoomShapeDimensionDraft {
  if (kind === "RECTANGLE") return { ...defaultRoomShapeDimensions };
  if (kind === "L_SHAPE") return {
        width: "500",
        depth: "400",
        notchWidth: "200",
        notchDepth: "150",
        leftWingWidth: "120",
        rightWingWidth: "120",
        stemWidth: "160",
        stemDepth: "220",
        rotation: "0"
      };
  if (kind === "U_SHAPE") return {
    ...defaultRoomShapeDimensions,
    width: "520", depth: "420", leftWingWidth: "140", rightWingWidth: "140", notchDepth: "260"
  };
  return {
    ...defaultRoomShapeDimensions,
    width: "500", depth: "420", stemWidth: "180", stemDepth: "260"
  };
}

/** Parses locally editable fields into one validated authoring-only shape. */
export function parseRoomShapeDefinition(
  kind: RoomShapeKind,
  draft: RoomShapeDimensionDraft
): RoomShapeDefinition | undefined {
  const rotation = Number(draft.rotation) as RoomShapeRotation;
  const shape: RoomShapeDefinition = kind === "RECTANGLE"
    ? {
        kind,
        dimensions: { width: Number(draft.width), depth: Number(draft.depth) },
        rotation
      }
    : kind === "L_SHAPE" ? {
        kind,
        dimensions: {
          width: Number(draft.width),
          depth: Number(draft.depth),
          notchWidth: Number(draft.notchWidth),
          notchDepth: Number(draft.notchDepth)
        },
        rotation
      }
    : kind === "U_SHAPE" ? {
        kind,
        dimensions: {
          width: Number(draft.width), depth: Number(draft.depth),
          leftWingWidth: Number(draft.leftWingWidth),
          rightWingWidth: Number(draft.rightWingWidth),
          notchDepth: Number(draft.notchDepth)
        },
        rotation
      }
    : {
        kind,
        dimensions: {
          width: Number(draft.width), depth: Number(draft.depth),
          stemWidth: Number(draft.stemWidth), stemDepth: Number(draft.stemDepth)
        },
        rotation
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
  const shapeLabel = shape.kind === "RECTANGLE" ? outer
    : shape.kind === "L_SHAPE"
      ? `L ${outer} · ${format(shape.dimensions.notchWidth)} × ${format(shape.dimensions.notchDepth)} m`
      : shape.kind === "U_SHAPE"
        ? `U ${outer} · ${format(shape.dimensions.leftWingWidth)} / ${format(shape.dimensions.rightWingWidth)} m`
        : `T ${outer} · ${format(shape.dimensions.stemWidth)} × ${format(shape.dimensions.stemDepth)} m`;
  return elevation === undefined ? shapeLabel : `${shapeLabel} · +${format(elevation)} m`;
}

function dimensions(width: number, depth: number): RoomShapeDimensionDraft {
  return { ...defaultRoomShapeDimensions, width: String(width), depth: String(depth) };
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
