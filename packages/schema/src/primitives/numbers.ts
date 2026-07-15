import { z } from "zod";

export const PositiveNumberSchema = z.number().positive();
export const PositiveIntegerSchema = z.number().int().positive();

export type PositiveNumber = z.infer<typeof PositiveNumberSchema>;
export type PositiveInteger = z.infer<typeof PositiveIntegerSchema>;
