import {
  FurnitureEditResultSchema,
  type FurnitureEditProvider
} from "@casastudio/ai";
import {
  FurnitureCommandSchema,
  furnitureCommandLimit
} from "@casastudio/schema";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { z } from "zod";

const [move, rotate, add, transfer] = FurnitureCommandSchema.options;
const [proposal, clarification, unsupported] =
  FurnitureEditResultSchema.options;

/** Wire-only nullability: strict output requires every key; null preserves rotation. */
export const OpenAIFurnitureEditEnvelopeSchema = z.strictObject({
  result: z.discriminatedUnion("kind", [
    proposal.extend({
      operations: z
        .array(
          z.discriminatedUnion("type", [
            move,
            rotate,
            add,
            transfer.extend({
              targetRotation: transfer.shape.targetRotation.unwrap().nullable()
            })
          ])
        )
        .min(1)
        .max(furnitureCommandLimit)
    }),
    clarification,
    unsupported
  ])
});

/** Offline-inspectable production request builder; no SDK client or credentials. */
export function buildOpenAIFurnitureEditRequest(
  model: string,
  instructions: string,
  request: Parameters<FurnitureEditProvider["interpretFurnitureEdit"]>[0]
): ResponseCreateParamsNonStreaming {
  return {
    model,
    store: false,
    instructions,
    input: JSON.stringify(request),
    // The SDK converts Zod's discriminated oneOf unions to supported anyOf.
    // Discriminator literals are mutually exclusive, so this preserves the contract.
    text: {
      format: zodTextFormat(OpenAIFurnitureEditEnvelopeSchema, "furniture_edit")
    },
    max_output_tokens: 4000
  };
}
