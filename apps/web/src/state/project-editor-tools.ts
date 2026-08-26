/** Tools available to the manual 2D Project editor. */
export type ProjectEditorTool = "select" | "draw-wall" | "door" | "window" | "room" | "measure";

/** Interaction capabilities consumed by the shared geometry viewer. */
export type ProjectEditorInteraction = {
  readonly selectionEnabled: boolean;
  readonly panEnabled: boolean;
  /** Whether viewport panning may begin over any rendered SVG content. */
  readonly panAnywhere?: boolean;
  readonly drawWallEnabled: boolean;
  readonly wallEndpointEditingEnabled: boolean;
  readonly openingPlacement?: "DOOR" | "WINDOW";
  readonly openingEditingEnabled?: boolean;
  readonly measurementEnabled?: boolean;
  /** Whether the canvas accepts and preserves Room shape placement input. */
  readonly roomShapePlacementEnabled?: boolean;
};

/** Durable UI and interaction contract for one editor tool. */
export type ProjectEditorToolDefinition = {
  readonly id: ProjectEditorTool;
  readonly enabled: boolean;
  readonly interaction: ProjectEditorInteraction;
};

/** Central tool definitions used by editor controls and pointer behavior. */
export const projectEditorTools: readonly ProjectEditorToolDefinition[] =
  Object.freeze([
    {
      id: "select",
      enabled: true,
      interaction: {
        selectionEnabled: true,
        panEnabled: true,
        panAnywhere: false,
        drawWallEnabled: false,
        wallEndpointEditingEnabled: true,
        openingEditingEnabled: true
      }
    },
    {
      id: "draw-wall",
      enabled: true,
      interaction: {
        selectionEnabled: false,
        panEnabled: true,
        panAnywhere: false,
        drawWallEnabled: true,
        wallEndpointEditingEnabled: false,
        openingEditingEnabled: false
      }
    },
    {
      id: "door",
      enabled: true,
      interaction: {
        selectionEnabled: false,
        panEnabled: true,
        panAnywhere: false,
        drawWallEnabled: false,
        wallEndpointEditingEnabled: false,
        openingPlacement: "DOOR",
        openingEditingEnabled: false
      }
    },
    {
      id: "window",
      enabled: true,
      interaction: {
        selectionEnabled: false,
        panEnabled: true,
        panAnywhere: false,
        drawWallEnabled: false,
        wallEndpointEditingEnabled: false,
        openingPlacement: "WINDOW",
        openingEditingEnabled: false
      }
    },
    {
      id: "room",
      enabled: true,
      interaction: {
        selectionEnabled: false,
        panEnabled: true,
        panAnywhere: false,
        drawWallEnabled: false,
        wallEndpointEditingEnabled: false,
        openingEditingEnabled: false,
        roomShapePlacementEnabled: true
      }
    },
    {
      id: "measure",
      enabled: true,
      interaction: {
        selectionEnabled: false,
        panEnabled: true,
        panAnywhere: false,
        drawWallEnabled: false,
        wallEndpointEditingEnabled: false,
        openingEditingEnabled: false,
        measurementEnabled: true
      }
    }
  ]);

/**
 * Returns pointer capabilities for the active editor tool and transient
 * viewport-pan modifier.
 *
 * The modifier suppresses every architectural interaction without changing
 * the active tool, allowing its durable and in-progress state to resume when
 * the modifier is released.
 */
export function getProjectEditorInteraction(
  tool: ProjectEditorTool | null,
  viewportPanModifierActive = false
): ProjectEditorInteraction {
  if (viewportPanModifierActive) {
    return {
      selectionEnabled: false,
      panEnabled: true,
      panAnywhere: true,
      drawWallEnabled: false,
      wallEndpointEditingEnabled: false,
      openingEditingEnabled: false,
      measurementEnabled: false,
      roomShapePlacementEnabled: tool === "room"
    };
  }

  return (
    projectEditorTools.find((definition) => definition.id === tool)
      ?.interaction ?? {
      selectionEnabled: false,
      panEnabled: true,
      panAnywhere: false,
      drawWallEnabled: false,
      wallEndpointEditingEnabled: false,
      openingEditingEnabled: false,
      measurementEnabled: false
    }
  );
}
