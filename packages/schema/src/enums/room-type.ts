import { z } from "zod";

/**
 * Stable vocabulary for the functional purpose of a Room.
 */
export const RoomTypeValues = [
  "LIVING_ROOM",
  "KITCHEN",
  "BEDROOM",
  "BATHROOM",
  "STUDIO",
  "CORRIDOR",
  "STORAGE",
  "OTHER"
] as const;

/**
 * Validates the supported functional Room classifications for the MVP.
 */
export const RoomTypeSchema = z.enum(RoomTypeValues);

/**
 * Functional classification of an architectural Room.
 */
export type RoomType = z.infer<typeof RoomTypeSchema>;
