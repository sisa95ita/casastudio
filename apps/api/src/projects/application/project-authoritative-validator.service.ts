import { Inject, Injectable } from "@nestjs/common";
import {
  validateProjectRenderability,
  type Project,
  type ValidationError
} from "@casastudio/schema";

import type { ProblemDetailItemDto } from "../../common/problem-details/problem-details.dto";
import {
  PROJECT_GEOMETRY_BUILDER,
  type ProjectGeometryBuilder
} from "../geometry-api/project-geometry-builder";
import { validateProjectForPersistence } from "../persistence/project-aggregate.mapper";
import { PersistedProjectInvalidError } from "../persistence/project-persistence-error";
import { ProjectStateInvalidError } from "./project-write.errors";

/**
 * Validates proposed state before it may cross the authoritative write boundary.
 *
 * Validation applies structural schema rules, semantic references, persisted
 * geometry rules, rendering-workflow prerequisites when render requests exist,
 * and a canonical Geometry Engine build. It does not persist or mutate input.
 */
@Injectable()
export class ProjectAuthoritativeValidator {
  constructor(
    @Inject(PROJECT_GEOMETRY_BUILDER)
    private readonly geometryBuilder: ProjectGeometryBuilder
  ) {}

  /** Returns canonical state or raises a sanitized 422 Problem Details error. */
  validate(candidate: unknown): Project {
    let project: Project;

    try {
      project = validateProjectForPersistence(candidate);
    } catch (error) {
      if (error instanceof PersistedProjectInvalidError) {
        throw new ProjectStateInvalidError(toProblemItems(error.validationErrors), error);
      }

      throw error;
    }

    if (project.renderRequests.length > 0) {
      const renderability = validateProjectRenderability(project);
      if (!renderability.valid) {
        throw new ProjectStateInvalidError(toProblemItems(renderability.errors));
      }
    }

    const geometryResult = this.geometryBuilder.build(project);
    if (!geometryResult.ok) {
      throw new ProjectStateInvalidError(
        geometryResult.errors.map((error) => ({
          path: error.path ?? "project",
          message: error.message
        }))
      );
    }

    return project;
  }
}

function toProblemItems(errors: readonly ValidationError[]): readonly ProblemDetailItemDto[] {
  return errors.map((error) => ({
    path: error.path,
    message: error.message
  }));
}
