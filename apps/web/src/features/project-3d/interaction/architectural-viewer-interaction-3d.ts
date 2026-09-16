import {
  getArchitecturalEntityKey3D,
  type ArchitecturalEntityIdentity3D
} from "./architectural-selection-3d";

/** Minimal camera and selection actions supported by the read-only 3D workspace. */
export type Project3DShortcutAction = "fit" | "reset" | "clear-selection";

/** Restrained visual state for a selectable renderer entity. */
export type ArchitecturalEntityPresentationState3D = "idle" | "hovered" | "selected";

/** Resolves a product-consistent 3D shortcut from an unmodified keyboard event. */
export function getProject3DShortcutAction(
  event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey">
): Project3DShortcutAction | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey) return undefined;
  if (event.key === "Escape") return "clear-selection";
  if (event.key.toLowerCase() === "f") return "fit";
  if (event.key.toLowerCase() === "r") return "reset";
  return undefined;
}

/** Tests a pointer displacement against the viewer's screen-space click tolerance. */
export function hasPointerGestureExceededSelectionThreshold3D(
  origin: Readonly<{ x: number; y: number }>,
  current: Readonly<{ x: number; y: number }>,
  threshold = 5
): boolean {
  return Math.hypot(current.x - origin.x, current.y - origin.y) > threshold;
}

/** Resolves selection precedence over transient hover for one canonical identity. */
export function getArchitecturalEntityPresentationState3D(
  identity: ArchitecturalEntityIdentity3D,
  selectedKey: string,
  hoveredKey: string
): ArchitecturalEntityPresentationState3D {
  const key = getArchitecturalEntityKey3D(identity);
  if (key === selectedKey) return "selected";
  return key === hoveredKey ? "hovered" : "idle";
}

/** Applies the shared CasaStudio blue selection language and a quieter hover tint. */
export function getArchitecturalEntityColor3D(
  idleColor: string,
  state: ArchitecturalEntityPresentationState3D
): string {
  if (state === "selected") return "#246caf";
  if (state === "hovered") return "#e7b980";
  return idleColor;
}

/** Creates consistent semantic pointer events for any architectural hit assembly. */
export function createEntityPointerHandlers3D(
  identity: ArchitecturalEntityIdentity3D,
  interaction: Readonly<{
    pointerGestureRef: Readonly<{ current: Readonly<{ dragged: boolean }> | undefined }>;
    onHoverChange: (identity?: ArchitecturalEntityIdentity3D) => void;
    onSelectionChange: (identity?: ArchitecturalEntityIdentity3D) => void;
  }>,
  setHovered: (hovered: boolean) => void
) {
  return {
    onPointerOver: (event: Readonly<{ stopPropagation: () => void }>) => {
      event.stopPropagation();
      setHovered(true);
      interaction.onHoverChange(identity);
    },
    onPointerOut: (event: Readonly<{ stopPropagation: () => void }>) => {
      event.stopPropagation();
      setHovered(false);
      interaction.onHoverChange(undefined);
    },
    onPointerDown: (event: Readonly<{ stopPropagation: () => void }>) => {
      event.stopPropagation();
    },
    onPointerUp: (event: Readonly<{ stopPropagation: () => void }>) => {
      event.stopPropagation();
      if (!interaction.pointerGestureRef.current?.dragged) {
        interaction.onSelectionChange(identity);
      }
    }
  };
}
