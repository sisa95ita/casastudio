import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { ProjectSchema } from "../src/project/project";

const schemaUrl = new URL("../json-schema/project.schema.json", import.meta.url);
const schemaPath = fileURLToPath(schemaUrl);

const projectJsonSchema = z.toJSONSchema(ProjectSchema, {
  target: "draft-2020-12",
  reused: "ref"
});

await mkdir(dirname(schemaPath), { recursive: true });
await writeFile(schemaPath, `${JSON.stringify(projectJsonSchema, null, 2)}\n`, "utf8");
