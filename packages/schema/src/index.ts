import { z } from "zod";

export const WorkspacePackageSchema = z.object({
  name: z.string()
});

export type WorkspacePackage = z.infer<typeof WorkspacePackageSchema>;
