import { Logger } from "@nestjs/common";
import OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FurnitureEditProvider } from "@casastudio/ai";
import type { AuthorizedProjectLoader } from "../../projects/application/authorized-project-loader.service";
import { furnitureEditFixture } from "../test/furniture-edit-fixture";
import { OpenAIFurnitureEditProvider } from "../openai/openai-furniture-edit.provider";
import { ProposeFurnitureEditService } from "./propose-furniture-edit.service";

afterEach(() => vi.restoreAllMocks());
const principal = { subject: "synthetic-owner", roles: [] };
const input = {
  instructions: "PRIVATE INSTRUCTION",
  baseRevision: 1,
  levelId: "ground",
  selectedFurnitureIds: ["item-a"]
};
const responseWith = (result: unknown) => ({
  _request_id: "req_offline_result",
  output: [
    {
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify({ result }) }]
    }
  ]
});

function setup(provider: FurnitureEditProvider) {
  const project = furnitureEditFixture();
  const snapshot = JSON.stringify(project);
  const warn = vi
    .spyOn(Logger.prototype, "warn")
    .mockImplementation(() => undefined);
  const loader = { load: vi.fn(async () => ({ loadedProject: { project } })) };
  const service = new ProposeFurnitureEditService(
    loader as unknown as AuthorizedProjectLoader,
    provider
  );
  return { project, snapshot, warn, service };
}

describe("Furniture interpretation safe diagnostics and public error boundary", () => {
  it.each([400, 500])(
    "logs sanitized upstream SDK HTTP %i metadata before translating to a public Problem",
    async (status) => {
      const sdkError =
        status === 400
          ? new OpenAI.BadRequestError(
              400,
              {
                code: "invalid_json_schema",
                type: "invalid_request_error",
                param: "text.format.schema",
                message:
                  "'oneOf' is not permitted. sk-secret PRIVATE INSTRUCTION"
              },
              "sensitive raw body",
              new Headers({
                "x-request-id": "req_offline_schema",
                authorization: "Bearer private"
              })
            )
          : new OpenAI.InternalServerError(
              500,
              {
                code: "server_error",
                type: "server_error",
                message: "sk-secret PRIVATE INSTRUCTION"
              },
              "sensitive raw body",
              new Headers({ "x-request-id": "req_offline_schema" })
            );
      const create = vi.fn(async () => {
        throw sdkError;
      });
      const { project, snapshot, service, warn } = setup(
        new OpenAIFurnitureEditProvider("gpt-5.6-sol", { create })
      );
      const problem = await service
        .propose(project.id, input, principal)
        .catch((error: unknown) => error);
      expect(problem).toMatchObject({
        name: "ApiProblemError",
        status: status === 400 ? 502 : 503,
        code:
          status === 400 ? "AI_GENERATION_FAILED" : "AI_PROVIDER_UNAVAILABLE"
      });
      expect(problem).toHaveProperty("cause", undefined); // raw SDK errors never reach the generic logger
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "furniture-edit",
          provider: "openai",
          stage: "provider_request",
          errorClass:
            status === 400 ? "BadRequestError" : "InternalServerError",
          upstreamStatus: status,
          providerCode: status === 400 ? "invalid_json_schema" : "server_error",
          providerRequestId: "req_offline_schema"
        }),
        "AI Furniture interpretation failed"
      );
      if (status === 400) {
        expect(problem).toMatchObject({
          title: "AI Furniture interpretation failed",
          detail: "The AI provider could not interpret the Furniture edit."
        });
        expect(warn.mock.calls[0]![0]).toMatchObject({
          providerType: "invalid_request_error",
          providerParam: "text.format.schema",
          unsupportedSchemaKeyword: "oneOf",
          safeMessage: "OpenAI rejected the Structured Outputs JSON schema."
        });
      }
      expect(JSON.stringify(warn.mock.calls)).not.toMatch(
        /sk-secret|PRIVATE INSTRUCTION|Bearer|sensitive raw body|authorization/
      );
      expect(JSON.stringify(problem)).not.toMatch(
        /sk-secret|PRIVATE INSTRUCTION|req_offline_schema|invalid_json_schema|could not generate the design/
      );
      expect(create).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(project)).toBe(snapshot);
    }
  );

  it.each([
    [
      {
        _request_id: "req_offline_result",
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: "malformed PRIVATE INSTRUCTION" }
            ]
          }
        ]
      },
      "response_decoding"
    ],
    [
      responseWith({
        kind: "EDIT_PROPOSAL",
        operations: [{ type: "MOVE_WALL", secret: "PRIVATE INSTRUCTION" }]
      }),
      "provider_result_validation"
    ]
  ])(
    "distinguishes decoding and provider-neutral parsing failures without logging output content",
    async (response, stage) => {
      const { project, snapshot, service, warn } = setup(
        new OpenAIFurnitureEditProvider("mock", {
          create: async () => response
        })
      );
      await expect(
        service.propose(project.id, input, principal)
      ).rejects.toMatchObject({
        status: 502,
        code: "AI_INVALID_PROVIDER_RESPONSE",
        title: "Invalid AI Furniture edit response"
      });
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({
          stage,
          providerRequestId: "req_offline_result"
        }),
        expect.any(String)
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(
        "PRIVATE INSTRUCTION"
      );
      expect(JSON.stringify(project)).toBe(snapshot);
    }
  );

  it("reports command validation after a successful typed provider response separately from SDK failures", async () => {
    const create = vi.fn(async () =>
      responseWith({
        kind: "EDIT_PROPOSAL",
        operations: [
          {
            type: "ROTATE_FURNITURE",
            furnitureId: "foreign-item",
            targetRotation: 90
          }
        ]
      })
    );
    const { project, snapshot, service, warn } = setup(
      new OpenAIFurnitureEditProvider("mock", { create })
    );
    await expect(
      service.propose(project.id, input, principal)
    ).rejects.toMatchObject({
      status: 502,
      code: "AI_INVALID_PROVIDER_RESPONSE"
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "command_validation",
        safeMessage: "Furniture commands failed CasaStudio validation."
      }),
      expect.any(String)
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("distinguishes stale context before any provider request", async () => {
    const interpretFurnitureEdit = vi.fn();
    const { project, service, warn } = setup({
      name: "mock",
      interpretFurnitureEdit
    });
    await expect(
      service.propose(project.id, { ...input, baseRevision: 2 }, principal)
    ).rejects.toMatchObject({ status: 409, code: "AI_STALE_CONTEXT" });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "context_validation" }),
      expect.any(String)
    );
    expect(interpretFurnitureEdit).not.toHaveBeenCalled();
  });
});
