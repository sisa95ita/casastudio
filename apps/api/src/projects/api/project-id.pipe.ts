import { Injectable, type PipeTransform } from "@nestjs/common";
import { IdentifierSchema } from "@casastudio/schema";

import { ProjectIdInvalidError } from "../application/project-read.errors";

/**
 * Validates Project route parameters with CasaStudio's canonical identifier schema.
 *
 * Invalid identifiers are rejected before repository access and converted into
 * safe RFC 9457 validation details by the global Problem Details filter.
 */
@Injectable()
export class ProjectIdPipe implements PipeTransform<string, string> {
  /**
   * Returns the validated Project domain ID or raises `PROJECT_ID_INVALID`.
   */
  transform(value: string): string {
    const result = IdentifierSchema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new ProjectIdInvalidError(value, [
      {
        path: "id",
        message: "Project ID must be a non-empty lowercase kebab-case identifier."
      }
    ]);
  }
}
