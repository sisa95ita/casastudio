import { ProjectSchema } from "@casastudio/schema";

import { geometryPlaygroundProject } from "../geometry-playground/geometry-playground-fixture";

export const demoProjectFixture = ProjectSchema.parse({
  ...geometryPlaygroundProject,
  id: "demo-project",
  name: "Demo Project"
});
