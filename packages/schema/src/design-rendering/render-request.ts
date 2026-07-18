import { z } from "zod";

import { RenderStatusSchema } from "../enums";
import { CommonMetadataSchema, IdentifierSchema, IsoDateTimeSchema, PositiveIntegerSchema } from "../primitives";

const NonEmptyStringSchema = z.string().min(1);

const isEarlierThan = (candidate: string, reference: string) => Date.parse(candidate) < Date.parse(reference);

/**
 * Represents one AI-assisted design generation attempt.
 *
 * A RenderRequest records the Viewpoint, BaseImage, DesignBrief, and lifecycle
 * metadata used to ask a rendering provider for design proposals.
 */
export const RenderRequestSchema = z
  .strictObject({
    ...CommonMetadataSchema.shape,
    viewpointId: IdentifierSchema,
    baseImageId: IdentifierSchema,
    designBriefId: IdentifierSchema,
    status: RenderStatusSchema,
    requestedProviderId: NonEmptyStringSchema.optional(),
    requestedModelId: NonEmptyStringSchema.optional(),
    requestedResultCount: PositiveIntegerSchema.optional(),
    createdAt: IsoDateTimeSchema,
    startedAt: IsoDateTimeSchema.optional(),
    completedAt: IsoDateTimeSchema.optional(),
    error: NonEmptyStringSchema.optional()
  })
  .superRefine((request, context) => {
    if (request.startedAt && isEarlierThan(request.startedAt, request.createdAt)) {
      context.addIssue({
        code: "custom",
        message: "startedAt must not be earlier than createdAt.",
        path: ["startedAt"]
      });
    }

    if (request.completedAt && isEarlierThan(request.completedAt, request.createdAt)) {
      context.addIssue({
        code: "custom",
        message: "completedAt must not be earlier than createdAt.",
        path: ["completedAt"]
      });
    }

    if (request.startedAt && request.completedAt && isEarlierThan(request.completedAt, request.startedAt)) {
      context.addIssue({
        code: "custom",
        message: "completedAt must not be earlier than startedAt.",
        path: ["completedAt"]
      });
    }

    if (request.status === "PENDING" && request.completedAt) {
      context.addIssue({
        code: "custom",
        message: "PENDING render requests must not have completedAt.",
        path: ["completedAt"]
      });
    }

    if (request.status === "RUNNING") {
      if (!request.startedAt) {
        context.addIssue({
          code: "custom",
          message: "RUNNING render requests require startedAt.",
          path: ["startedAt"]
        });
      }

      if (request.completedAt) {
        context.addIssue({
          code: "custom",
          message: "RUNNING render requests must not have completedAt.",
          path: ["completedAt"]
        });
      }
    }

    if (request.status === "SUCCEEDED") {
      if (!request.startedAt) {
        context.addIssue({
          code: "custom",
          message: "SUCCEEDED render requests require startedAt.",
          path: ["startedAt"]
        });
      }

      if (!request.completedAt) {
        context.addIssue({
          code: "custom",
          message: "SUCCEEDED render requests require completedAt.",
          path: ["completedAt"]
        });
      }

      if (request.error) {
        context.addIssue({
          code: "custom",
          message: "SUCCEEDED render requests must not have error.",
          path: ["error"]
        });
      }
    }

    if (request.status === "FAILED") {
      if (!request.startedAt) {
        context.addIssue({
          code: "custom",
          message: "FAILED render requests require startedAt.",
          path: ["startedAt"]
        });
      }

      if (!request.completedAt) {
        context.addIssue({
          code: "custom",
          message: "FAILED render requests require completedAt.",
          path: ["completedAt"]
        });
      }

      if (!request.error) {
        context.addIssue({
          code: "custom",
          message: "FAILED render requests require error.",
          path: ["error"]
        });
      }
    }

    if (request.status === "CANCELLED" && !request.completedAt) {
      context.addIssue({
        code: "custom",
        message: "CANCELLED render requests require completedAt.",
        path: ["completedAt"]
      });
    }
  });

/**
 * Traceable design-rendering request and its provider-selection metadata.
 */
export type RenderRequest = z.infer<typeof RenderRequestSchema>;
