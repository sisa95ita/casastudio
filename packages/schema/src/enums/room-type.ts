import { z } from "zod";

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

export const RoomTypeSchema = z.enum(RoomTypeValues);

export type RoomType = z.infer<typeof RoomTypeSchema>;
