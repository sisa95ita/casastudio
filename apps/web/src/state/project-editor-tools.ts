/** Tools available to the manual 2D Project editor. */
export type ProjectEditorTool = "select" | "draw-wall" | "pan";

/** Interaction capabilities consumed by the shared geometry viewer. */
export type ProjectEditorInteraction = {
  readonly selectionEnabled: boolean;
  readonly panEnabled: boolean;
  readonly drawWallEnabled: boolean;
  readonly wallEndpointEditingEnabled: boolean;
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
        drawWallEnabled: false,
        wallEndpointEditingEnabled: true
      }
    },
    {
      id: "draw-wall",
      enabled: true,
      interaction: {
        selectionEnabled: false,
        panEnabled: false,
        drawWallEnabled: true,
        wallEndpointEditingEnabled: false
      }
    },
    {
      id: "pan",
      enabled: true,
      interaction: {
        selectionEnabled: false,
        panEnabled: true,
        drawWallEnabled: false,
        wallEndpointEditingEnabled: false
      }
    }
  ]);

/** Returns the interaction capabilities for the active editor tool. */
export function getProjectEditorInteraction(
  tool: ProjectEditorTool | null
): ProjectEditorInteraction {
  return (
    projectEditorTools.find((definition) => definition.id === tool)
      ?.interaction ?? {
      selectionEnabled: false,
      panEnabled: false,
      drawWallEnabled: false,
      wallEndpointEditingEnabled: false
    }
  );
}
