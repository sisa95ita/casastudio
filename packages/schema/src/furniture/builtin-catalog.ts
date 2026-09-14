import type { FurnitureDefinition } from "./furniture.js";

/**
 * Small deterministic product catalog, separate from Project composition and validation.
 * IDs are durable; persisted instances retain their own dimensions when these defaults evolve.
 */
export const builtinFurnitureDefinitions: readonly Readonly<FurnitureDefinition>[] =
  Object.freeze(
    [
      {
        id: "generic-single-bed",
        category: "BED",
        name: "Single bed",
        defaultWidth: 90,
        defaultDepth: 200,
        defaultHeight: 50
      },
      {
        id: "generic-double-bed",
        category: "BED",
        name: "Double bed",
        defaultWidth: 160,
        defaultDepth: 200,
        defaultHeight: 50
      },
      {
        id: "generic-sofa",
        category: "SOFA",
        name: "Sofa",
        defaultWidth: 200,
        defaultDepth: 90,
        defaultHeight: 85
      },
      {
        id: "generic-dining-table",
        category: "TABLE",
        name: "Dining table",
        defaultWidth: 160,
        defaultDepth: 90,
        defaultHeight: 75
      },
      {
        id: "generic-chair",
        category: "CHAIR",
        name: "Chair",
        defaultWidth: 45,
        defaultDepth: 50,
        defaultHeight: 85
      },
      {
        id: "generic-cabinet",
        category: "CABINET",
        name: "Cabinet",
        defaultWidth: 100,
        defaultDepth: 45,
        defaultHeight: 180
      },
      {
        id: "generic-desk",
        category: "DESK",
        name: "Desk",
        defaultWidth: 120,
        defaultDepth: 60,
        defaultHeight: 75
      },
      {
        id: "generic-furniture",
        category: "GENERIC",
        name: "Furniture",
        defaultWidth: 100,
        defaultDepth: 100,
        defaultHeight: 100
      }
    ].map((definition) => Object.freeze(definition as FurnitureDefinition))
  );

/** Resolves a built-in identity; unknown external or retired definitions remain unresolved. */
export function resolveBuiltinFurnitureDefinition(
  id: string
): Readonly<FurnitureDefinition> | undefined {
  return builtinFurnitureDefinitions.find((definition) => definition.id === id);
}
