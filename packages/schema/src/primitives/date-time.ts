import { z } from "zod";

/**
 * Validates persisted timestamps as ISO 8601 date-times with an explicit offset.
 *
 * CasaStudio stores project history and rendering workflow times with timezone
 * information so project files remain understandable outside the originating environment.
 */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

/**
 * ISO 8601 timestamp string used for Project metadata and derived rendering artifacts.
 */
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;
