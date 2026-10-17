import {
  FurnitureCommandsSchema,
  createFurniture,
  createFurnitureItemFromDefinition,
  moveFurniture,
  rotateFurniture,
  updateFurniture,
  resolveFurnitureRoom,
  resolveBuiltinFurnitureDefinition,
  type FurnitureCommand,
  type Project
} from "@casastudio/schema";
import { validateFurniturePlacement } from "./furniture-placement.js";

export class FurnitureCommandError extends Error {}

/**
 * Pure atomic command transaction over the existing canonical mutation helpers.
 * Canonical angles are finite degrees, intentionally NOT normalized (manual editor policy).
 * An invalid intermediate operation rejects the whole batch; the input is never mutated.
 */
export function applyFurnitureCommands(
  project: Project,
  commands: readonly FurnitureCommand[],
  createId: () => string
): Project {
  const parsed = FurnitureCommandsSchema.safeParse(commands);
  if (!parsed.success)
    throw new FurnitureCommandError("Invalid Furniture commands.");
  let next = project;
  for (const command of parsed.data) {
    const existing =
      "furnitureId" in command
        ? next.building.furniture.find(
            (item) => item.id === command.furnitureId
          )
        : undefined;
    if ("furnitureId" in command && !existing)
      throw new FurnitureCommandError(
        "Furniture could not be found in this Project."
      );
    let result;
    switch (command.type) {
      case "MOVE_FURNITURE":
        result = moveFurniture(next, {
          furnitureId: command.furnitureId,
          position: command.targetPosition
        });
        break;
      case "ROTATE_FURNITURE":
        result = rotateFurniture(next, {
          furnitureId: command.furnitureId,
          rotation: command.targetRotation
        });
        break;
      case "TRANSFER_FURNITURE":
        result = updateFurniture(next, {
          furnitureId: command.furnitureId,
          changes: {
            roomId: command.targetRoomId,
            position: command.targetPosition,
            ...(command.targetRotation === undefined
              ? {}
              : { rotation: command.targetRotation })
          }
        });
        break;
      case "ADD_FURNITURE": {
        const definition = resolveBuiltinFurnitureDefinition(
          command.definitionId
        );
        if (!definition)
          throw new FurnitureCommandError(
            "Furniture definition is not in the canonical catalog."
          );
        result = createFurniture(next, {
          furniture: createFurnitureItemFromDefinition(definition, {
            id: createId(),
            roomId: command.roomId,
            position: command.position,
            rotation: command.rotation
          })
        });
        break;
      }
    }
    if (!result.ok)
      throw new FurnitureCommandError(
        result.errors.map((error) => error.message).join(" ")
      );
    const changed = result.project.building.furniture.find((item) =>
      command.type === "ADD_FURNITURE"
        ? !next.building.furniture.some((previous) => previous.id === item.id)
        : item.id === command.furnitureId
    )!;
    const owner = resolveFurnitureRoom(result.project, changed);
    if (!owner)
      throw new FurnitureCommandError("Target Room could not be found.");
    const placement = validateFurniturePlacement(
      result.project,
      owner.level.id,
      changed,
      changed.id
    );
    if (placement.status === "INVALID")
      throw new FurnitureCommandError(placement.issue);
    next = result.project;
  }
  return next;
}
