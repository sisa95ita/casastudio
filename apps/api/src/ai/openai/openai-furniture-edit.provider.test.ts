import { describe, expect, it, vi } from "vitest";
import {
  furnitureEditInstructions,
  OpenAIFurnitureEditProvider
} from "./openai-furniture-edit.provider";
import type { FurnitureEditContext } from "@casastudio/ai";
import { FurnitureEditResultSchema } from "@casastudio/ai";
import OpenAI from "openai";
import { buildOpenAIFurnitureEditRequest } from "./openai-furniture-edit.request";
import type { OpenAIResponseLike } from "./openai-interior-design.provider";

const context = {
  projectId: "synthetic",
  projectRevision: 1,
  selectedFurniture: [{ id: "item-a", rotation: 30 }],
  placementHint: { roomId: "room-a", position: { x: 300, z: 300 } }
} as unknown as FurnitureEditContext;
const output = (result: unknown) => ({
  output: [
    {
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify({ result }) }]
    }
  ]
});

describe("OpenAI Furniture interpretation with deterministic Responses fixtures only", () => {
  it.each([
    [
      "Move this Furniture to X 350 Z 350",
      {
        kind: "EDIT_PROPOSAL",
        operations: [
          {
            type: "MOVE_FURNITURE",
            furnitureId: "item-a",
            targetPosition: { x: 350, z: 350 }
          }
        ]
      }
    ],
    [
      "Ruota questo mobile di 90 gradi",
      {
        kind: "EDIT_PROPOSAL",
        operations: [
          {
            type: "ROTATE_FURNITURE",
            furnitureId: "item-a",
            targetRotation: 120
          }
        ]
      }
    ],
    [
      "Set its rotation to 90 degrees",
      {
        kind: "EDIT_PROPOSAL",
        operations: [
          {
            type: "ROTATE_FURNITURE",
            furnitureId: "item-a",
            targetRotation: 90
          }
        ]
      }
    ],
    [
      "Move the chair",
      { kind: "CLARIFICATION_REQUIRED", message: "Which chair, and where?" }
    ],
    [
      "Move to the room next door",
      { kind: "CLARIFICATION_REQUIRED", message: "Which Room?" }
    ],
    [
      "Add Furniture here without an anchor",
      { kind: "CLARIFICATION_REQUIRED", message: "Set an anchor first." }
    ],
    [
      "Add a door between these Rooms",
      {
        kind: "UNSUPPORTED_REQUEST",
        message: "Architectural editing is outside AI-D1."
      }
    ]
  ])(
    "returns the typed fixture for %s with exactly one text call",
    async (instructions, result) => {
      const create = vi.fn(async () => output(result));
      const provider = new OpenAIFurnitureEditProvider("mock-model", {
        create
      });
      expect(
        await provider.interpretFurnitureEdit({ instructions, context })
      ).toEqual(result);
      expect(create).toHaveBeenCalledTimes(1);
      const call = create.mock.calls[0] as unknown as [Record<string, unknown>];
      expect(call[0]).toMatchObject({
        store: false,
        model: "mock-model",
        text: { format: { type: "json_schema", strict: true } }
      });
      expect(call[0]).not.toHaveProperty("tools");
      expect(JSON.parse(call[0].input as string).context).toEqual(context);
      expect(furnitureEditInstructions).toContain("CLARIFICATION_REQUIRED");
      expect(furnitureEditInstructions).toContain(
        "MUST return UNSUPPORTED_REQUEST"
      );
    }
  );
  it("converts nullable transfer rotation to canonical preservation", async () => {
    const result = {
      kind: "EDIT_PROPOSAL",
      operations: [
        {
          type: "TRANSFER_FURNITURE",
          furnitureId: "item-a",
          targetRoomId: "room-b",
          targetPosition: { x: 1000, z: 100 },
          targetRotation: null
        }
      ]
    };
    const provider = new OpenAIFurnitureEditProvider("mock", {
      create: async () => output(result)
    });
    expect(
      await provider.interpretFurnitureEdit({
        instructions: "transfer",
        context
      })
    ).toEqual({
      ...result,
      operations: [
        {
          type: "TRANSFER_FURNITURE",
          furnitureId: "item-a",
          targetRoomId: "room-b",
          targetPosition: { x: 1000, z: 100 }
        }
      ]
    });
  });
  it.each([
    { output: [] },
    {
      output: [
        { type: "message", content: [{ type: "refusal", refusal: "no" }] }
      ]
    },
    output({ kind: "EDIT_PROPOSAL", operations: [{ type: "MOVE_WALL" }] })
  ])("rejects malformed/refused responses without retry", async (response) => {
    const create = vi.fn(async () => response);
    await expect(
      new OpenAIFurnitureEditProvider("mock", {
        create
      }).interpretFurnitureEdit({ instructions: "edit", context })
    ).rejects.toMatchObject({ code: "invalid_provider_response" });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("maps a provider failure once with no fallback or retry", async () => {
    const create = vi.fn(async () => {
      throw { status: 429 };
    });
    await expect(
      new OpenAIFurnitureEditProvider("mock", {
        create
      }).interpretFurnitureEdit({ instructions: "edit", context })
    ).rejects.toMatchObject({ code: "rate_limited" });
    expect(create).toHaveBeenCalledTimes(1);
  });
});

type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  anyOf?: Schema[];
  oneOf?: Schema[];
  const?: unknown;
  items?: Schema;
  minItems?: number;
  maxItems?: number;
};

function schemaOf(
  input: ReturnType<typeof buildOpenAIFurnitureEditRequest>
): Schema {
  if (input.text?.format?.type !== "json_schema")
    throw new Error("Expected Structured Outputs.");
  return input.text.format.schema as Schema;
}

function assertStrictSubset(node: Schema) {
  expect(node).not.toHaveProperty("oneOf");
  expect(node).not.toHaveProperty("allOf");
  if (node.type === "object") {
    expect(node.additionalProperties).toBe(false);
    expect([...(node.required ?? [])].sort()).toEqual(
      Object.keys(node.properties ?? {}).sort()
    );
  }
  Object.values(node.properties ?? {}).forEach(assertStrictSubset);
  node.anyOf?.forEach(assertStrictSubset);
  if (node.items) assertStrictSubset(node.items);
}

describe("production Furniture Responses request and strict schema regression", () => {
  it("emits a text-only Responses request with both discriminated unions represented as nested anyOf", () => {
    const request = { instructions: "Synthetic rotation", context };
    const input = buildOpenAIFurnitureEditRequest(
      "gpt-5.6-sol",
      furnitureEditInstructions,
      request
    );
    expect(Object.keys(input).sort()).toEqual([
      "input",
      "instructions",
      "max_output_tokens",
      "model",
      "store",
      "text"
    ]);
    expect(input).toMatchObject({
      model: "gpt-5.6-sol",
      store: false,
      input: JSON.stringify(request),
      max_output_tokens: 4000,
      text: {
        format: { type: "json_schema", name: "furniture_edit", strict: true }
      }
    });
    const schema = schemaOf(input);
    assertStrictSubset(schema);
    expect(schema.type).toBe("object");
    expect(schema.anyOf).toBeUndefined();
    const results = schema.properties!.result!.anyOf!;
    expect(results.map((branch) => branch.properties!.kind!.const)).toEqual([
      "EDIT_PROPOSAL",
      "CLARIFICATION_REQUIRED",
      "UNSUPPORTED_REQUEST"
    ]);
    const operations = results[0]!.properties!.operations!;
    expect(operations).toMatchObject({
      type: "array",
      minItems: 1,
      maxItems: 8
    });
    expect(
      operations.items!.anyOf!.map((branch) => branch.properties!.type!.const)
    ).toEqual([
      "MOVE_FURNITURE",
      "ROTATE_FURNITURE",
      "ADD_FURNITURE",
      "TRANSFER_FURNITURE"
    ]);
    const transfer = operations.items!.anyOf![3]!;
    expect(transfer.required).toContain("targetRotation");
    expect(transfer.properties!.targetRotation).toMatchObject({
      anyOf: [{ type: "number" }, { type: "null" }]
    });
    // Null is a wire-only preservation sentinel; canonical commands still omit it.
    expect(
      FurnitureEditResultSchema.safeParse({
        kind: "EDIT_PROPOSAL",
        operations: [
          {
            type: "TRANSFER_FURNITURE",
            furnitureId: "item-a",
            targetRoomId: "room-b",
            targetPosition: { x: 1000, z: 100 },
            targetRotation: null
          }
        ]
      }).success
    ).toBe(false);
  });

  it("serializes the exact schema through the installed SDK using only a fake fetch transport", async () => {
    const result = {
      kind: "EDIT_PROPOSAL",
      operations: [
        {
          type: "MOVE_FURNITURE",
          furnitureId: "item-a",
          targetPosition: { x: 350, z: 350 }
        }
      ]
    };
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(init!.body as string) as ReturnType<
        typeof buildOpenAIFurnitureEditRequest
      >;
      assertStrictSubset(schemaOf(body));
      expect(body).not.toHaveProperty("tools");
      expect(body).not.toHaveProperty("response_format");
      return new Response(
        JSON.stringify({ ...output(result), object: "response" }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-request-id": "req_offline_success"
          }
        }
      );
    });
    const sdk = new OpenAI({
      apiKey: "offline-test-key",
      baseURL: "http://openai.invalid/v1",
      maxRetries: 0,
      fetch: fetchMock
    });
    const provider = new OpenAIFurnitureEditProvider("gpt-5.6-sol", {
      create: async (body) =>
        (await sdk.responses.create(
          body as never
        )) as unknown as OpenAIResponseLike
    });
    expect(
      await provider.interpretFurnitureEdit({
        instructions: "Synthetic move",
        context
      })
    ).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [400, "invalid_json_schema", "generation_failed"],
    [400, "unsupported_parameter", "generation_failed"],
    [401, "invalid_api_key", "authentication_failed"],
    [500, "server_error", "provider_unavailable"],
    [503, "server_error", "provider_unavailable"]
  ])(
    "retains sanitized SDK HTTP %i diagnostics without retry or public upstream disclosure",
    async (status, code, publicCode) => {
      const fetchMock = vi.fn<typeof fetch>(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code,
                type: "invalid_request_error",
                param: "text.format.schema",
                message:
                  "Invalid schema: 'oneOf' is not permitted. sk-secret PRIVATE INSTRUCTION Authorization: Bearer private"
              }
            }),
            {
              status: status as number,
              headers: {
                "content-type": "application/json",
                "x-request-id": "req_offline_failure"
              }
            }
          )
      );
      const sdk = new OpenAI({
        apiKey: "offline-test-key",
        baseURL: "http://openai.invalid/v1",
        maxRetries: 0,
        fetch: fetchMock
      });
      const provider = new OpenAIFurnitureEditProvider("gpt-5.6-sol", {
        create: async (body) =>
          (await sdk.responses.create(
            body as never
          )) as unknown as OpenAIResponseLike
      });
      const error = await provider
        .interpretFurnitureEdit({ instructions: "Synthetic move", context })
        .catch((failure: unknown) => failure);
      expect(error).toMatchObject({
        code: publicCode,
        stage: "provider_request",
        diagnostics: {
          upstreamStatus: status,
          providerCode: code,
          providerType: "invalid_request_error",
          providerRequestId: "req_offline_failure"
        }
      });
      expect(
        JSON.stringify((error as { diagnostics: unknown }).diagnostics)
      ).not.toMatch(/sk-secret|PRIVATE INSTRUCTION|Bearer/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it("identifies local request-construction failure before the SDK boundary", async () => {
    const create = vi.fn();
    const cyclic = { ...context };
    Object.assign(cyclic, { self: cyclic });
    await expect(
      new OpenAIFurnitureEditProvider("mock", {
        create
      }).interpretFurnitureEdit({ instructions: "Synthetic", context: cyclic })
    ).rejects.toMatchObject({
      stage: "request_construction",
      diagnostics: { errorClass: "TypeError" }
    });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    [
      {
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "{malformed" }]
          }
        ]
      },
      "response_decoding"
    ],
    [
      output({ kind: "EDIT_PROPOSAL", operations: [{ type: "MOVE_WALL" }] }),
      "provider_result_validation"
    ],
    [
      output({
        kind: "EDIT_PROPOSAL",
        operations: Array(9).fill({
          type: "ROTATE_FURNITURE",
          furnitureId: "item-a",
          targetRotation: 90
        })
      }),
      "provider_result_validation"
    ]
  ])(
    "distinguishes structured decoding from provider result contract failure",
    async (response, stage) => {
      const create = vi.fn(async () => ({
        ...response,
        _request_id: "req_offline_response"
      }));
      await expect(
        new OpenAIFurnitureEditProvider("mock", {
          create
        }).interpretFurnitureEdit({ instructions: "Synthetic", context })
      ).rejects.toMatchObject({
        code: "invalid_provider_response",
        stage,
        diagnostics: { providerRequestId: "req_offline_response" }
      });
      expect(create).toHaveBeenCalledTimes(1);
    }
  );
});
