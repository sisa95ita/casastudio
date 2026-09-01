import { IdentifierSchema } from "@casastudio/schema";

/** Creates a collision-resistant Level identifier accepted by the schema. */
export function createLevelIdentifier(
  randomUuid: () => string = () => crypto.randomUUID()
): string {
  return IdentifierSchema.parse(`level-${randomUuid().toLowerCase()}`);
}
