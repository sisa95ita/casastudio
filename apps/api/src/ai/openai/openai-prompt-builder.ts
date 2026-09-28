import type { DesignRequest } from "@casastudio/ai";

/** Stable architectural guardrails owned by the provider adapter. */
export function buildOpenAIInteriorDesignInstructions(): string {
  return [
    "You are CasaStudio's interior design renderer.",
    "The supplied CasaStudio geometry and reference view are authoritative.",
    "Preserve the exact room proportions, perspective, walls, floor, ceiling, doors, windows, wall openings, stairs, and their positions.",
    "This is interior design, not architectural redesign: never add, remove, resize, or move structural elements or openings.",
    "You may change furniture, materials, colors, decoration, and lighting unless the user asks to preserve an element.",
    "Produce one photorealistic interior image that remains recognizably grounded in the supplied reference view."
  ].join("\n");
}

/** Converts provider-neutral semantic context into deterministic model input. */
export function buildOpenAIInteriorDesignPrompt(
  request: DesignRequest
): string {
  return [
    `User design instruction: ${request.instructions.trim()}`,
    request.constraints?.length
      ? `Constraints: ${request.constraints.join("; ")}`
      : "Constraints: none beyond the architectural guardrails.",
    request.elementsToPreserve?.length
      ? `Elements to preserve: ${request.elementsToPreserve.join("; ")}`
      : "Elements to preserve: all architectural elements.",
    "Canonical CasaStudio semantic context (measurements use the declared units):",
    JSON.stringify(request.context)
  ].join("\n\n");
}
