import { ProjectSchema } from "@casastudio/schema";

import { demoProjectEntry } from "../development/demo-project-entry";
import { geometryPlaygroundProject } from "../geometry-playground/geometry-playground-fixture";

export const demoProjectFixture = ProjectSchema.parse({
  ...geometryPlaygroundProject,
  ...demoProjectEntry
});
