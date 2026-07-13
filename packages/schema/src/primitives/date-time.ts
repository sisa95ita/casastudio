import { z } from "zod";

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;
