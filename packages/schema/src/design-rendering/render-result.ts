import { z } from "zod";

import { RenderStatusSchema } from "../enums";
import { CommonMetadataSchema, IdentifierSchema, IsoDateTimeSchema, PositiveIntegerSchema } from "../primitives";

const NonEmptyStringSchema = z.string().min(1);

export const RenderResultSchema = z
  .strictObject({
    ...CommonMetadataSchema.shape,
    renderRequestId: IdentifierSchema,
    status: RenderStatusSchema,
    createdAt: IsoDateTimeSchema,
    assetRef: NonEmptyStringSchema.optional(),
    providerId: NonEmptyStringSchema.optional(),
    modelId: NonEmptyStringSchema.optional(),
    notes: NonEmptyStringSchema.optional(),
    favorite: z.boolean().optional(),
    error: NonEmptyStringSchema.optional(),
    width: PositiveIntegerSchema.optional(),
    height: PositiveIntegerSchema.optional()
  })
  .superRefine((result, context) => {
    if (result.status === "SUCCEEDED") {
      if (!result.assetRef) {
        context.addIssue({
          code: "custom",
          message: "SUCCEEDED render results require assetRef.",
          path: ["assetRef"]
        });
      }

      if (result.error) {
        context.addIssue({
          code: "custom",
          message: "SUCCEEDED render results must not have error.",
          path: ["error"]
        });
      }
    }

    if (result.status === "FAILED" && !result.error) {
      context.addIssue({
        code: "custom",
        message: "FAILED render results require error.",
        path: ["error"]
      });
    }

    if ((result.status === "PENDING" || result.status === "RUNNING") && result.assetRef) {
      context.addIssue({
        code: "custom",
        message: "PENDING and RUNNING render results must not have assetRef.",
        path: ["assetRef"]
      });
    }
  });

export type RenderResult = z.infer<typeof RenderResultSchema>;
