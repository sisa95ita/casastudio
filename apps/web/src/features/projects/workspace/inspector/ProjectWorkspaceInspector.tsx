import { measureLevel, type RoomMeasurement } from "@casastudio/geometry";
import type {
  Opening,
  Level,
  Project,
  Room,
  StairFlight,
  StairLanding,
  Staircase,
  UpdateOpeningProperties,
  UpdateRoomProperties,
  Wall
} from "@casastudio/schema";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { useCasaTranslation } from "../../../../core/i18n";
import { ProjectLayerControls } from "../../../editor-2d/components/ProjectLayerControls";
import type { ProjectEditorTool } from "../../../editor-2d/state/project-editor-tools";
import type {
  OpeningAuthoringProperties,
  PlaceOpeningInteraction,
  ProjectWorkspaceMode
} from "../../../editor-2d/state/project-editor-slice";
import { ProjectRoomAuthoringDetails } from "../../../editor-2d/tools/room/ProjectRoomAuthoringDetails";
import type { RoomShapeDimensionDraft } from "../../../editor-2d/tools/room/room-shape-authoring";
import type { WallEndpointEditingAvailability } from "../../../editor-2d/tools/wall/project-wall-editing";
import type { StairAuthoringParameters, StairParameterChanges, StairProposal, StairTemplate } from "../../../editor-2d/tools/stair/project-stair-authoring";
import type { GeometryPresentationModel2D } from "../../../geometry-2d/presentation/geometry-presentation-model-2d";
import type { GeometrySelectionState } from "../../../geometry-2d/selection/geometry-selection-state";
import type { GeometryDisplayOptions } from "../../../geometry-2d/viewer/GeometrySvgViewer";
import { ProjectPropertiesDetails } from "./ProjectSelectionDetails";
import { ProjectStairAuthoringDetails } from "./ProjectStairSelectionDetails";

type ProjectWorkspaceInspectorProps = {
  readonly model: GeometryPresentationModel2D;
  readonly selectionState: GeometrySelectionState;
  readonly options: GeometryDisplayOptions;
  readonly onOptionsChange: (options: GeometryDisplayOptions) => void;
  readonly mode: ProjectWorkspaceMode;
  readonly activeTool: ProjectEditorTool | null;
  readonly selectedWall?: Wall;
  readonly selectedOpening?: { readonly wall: Wall; readonly opening: Opening };
  readonly selectedRoom?: Room;
  readonly selectedRoomLevelElevation?: number;
  readonly selectedStair?: { readonly staircase: Staircase; readonly part?: StairFlight | StairLanding };
  readonly stairAuthoring?: {
    readonly levels: readonly Level[];
    readonly owningLevelId: string;
    readonly targetLevelId: string;
    readonly targetRoomId?: string;
    readonly template: StairTemplate;
    readonly parameters: StairAuthoringParameters;
    readonly proposal?: StairProposal;
    readonly locked: boolean;
  };
  readonly selectedRoomMeasurement?: RoomMeasurement;
  readonly levelMeasurement?: ReturnType<typeof measureLevel>;
  /** Transient Wall-local Opening offset used only for Inspector display. */
  readonly selectedOpeningDisplayOffset?: number;
  readonly openingAuthoring?: PlaceOpeningInteraction;
  readonly roomAuthoring?: {
    readonly activeShape?: "RECTANGLE" | "L_SHAPE";
    readonly boundaryKind?: "WALLS" | "FREE";
    readonly detectionActive: boolean;
    readonly elevation: string;
    readonly levelElevation: number;
    readonly dimensions: RoomShapeDimensionDraft;
    readonly valid: boolean;
  };
  readonly endpointAvailability?: WallEndpointEditingAvailability;
  readonly selectedVertexRemovable: boolean;
  readonly units?: Project["units"];
  readonly onDeleteWall: () => void;
  readonly onAddWallVertex: () => void;
  readonly onRemoveVertex: () => void;
  readonly onUpdateWallProperties: (properties: {
    readonly length?: number;
    readonly anchoredEndpoint?: "START" | "END";
    readonly height?: number;
    readonly thickness?: number;
  }) => boolean;
  readonly onDeleteOpening: () => void;
  readonly onUpdateOpening: (properties: UpdateOpeningProperties) => boolean;
  readonly onUpdateOpeningAuthoring: (
    properties: Partial<OpeningAuthoringProperties>
  ) => void;
  readonly onUpdateRoomAuthoringDimension: (
    field: keyof RoomShapeDimensionDraft,
    value: string
  ) => void;
  readonly onUpdateRoomAuthoringElevation: (value: string) => void;
  readonly onRoomAuthoringSpacePanChange: (active: boolean) => void;
  readonly onCancelRoomAuthoring: () => void;
  readonly onDeleteRoom: () => void;
  readonly onUpdateRoomProperties: (properties: Partial<UpdateRoomProperties>) => boolean;
  readonly onDeleteStair: () => void;
  readonly onUpdateStair: (properties: StairParameterChanges) => boolean;
  readonly onStairAuthoringTemplateChange: (template: StairTemplate) => void;
  readonly onStairAuthoringParametersChange: (parameters: StairAuthoringParameters) => void;
  readonly onConfirmStairAuthoring: () => void;
  readonly onCancelStairAuthoring: () => void;
};

/** Provides the durable Layers and contextual Properties inspector foundation. */
export function ProjectWorkspaceInspector({
  model,
  selectionState,
  options,
  onOptionsChange,
  mode,
  activeTool,
  selectedWall,
  selectedOpening,
  selectedRoom,
  selectedRoomLevelElevation,
  selectedStair,
  stairAuthoring,
  selectedRoomMeasurement,
  levelMeasurement,
  selectedOpeningDisplayOffset,
  openingAuthoring,
  roomAuthoring,
  endpointAvailability,
  selectedVertexRemovable,
  units,
  onDeleteWall,
  onAddWallVertex,
  onRemoveVertex,
  onUpdateWallProperties,
  onDeleteOpening,
  onUpdateOpening,
  onUpdateOpeningAuthoring,
  onUpdateRoomAuthoringDimension,
  onUpdateRoomAuthoringElevation,
  onRoomAuthoringSpacePanChange,
  onCancelRoomAuthoring,
  onDeleteRoom,
  onUpdateRoomProperties,
  onDeleteStair,
  onUpdateStair,
  onStairAuthoringTemplateChange,
  onStairAuthoringParametersChange,
  onConfirmStairAuthoring,
  onCancelStairAuthoring
}: ProjectWorkspaceInspectorProps) {
  const { t } = useCasaTranslation("project-viewer");
  const [tab, setTab] = useState<"layers" | "properties">("layers");
  const selectionKey = selectionState.selected
    .map((selection) => `${selection.kind}:${selection.geometryId}`)
    .join("|");
  useEffect(() => {
    if (
      selectionKey ||
      (mode === "edit" && activeTool && activeTool !== "select") ||
      stairAuthoring ||
      roomAuthoring ||
      openingAuthoring
    ) {
      setTab("properties");
    }
  }, [activeTool, mode, openingAuthoring, roomAuthoring, selectionKey, stairAuthoring]);

  return (
    <Box className="project-inspector">
      <Tabs
        value={tab}
        onChange={(_event, value) => setTab(value)}
        variant="fullWidth"
        aria-label={t("inspector.tabsLabel")}
      >
        <Tab value="layers" label={t("inspector.layers")} />
        <Tab value="properties" label={t("inspector.properties")} />
      </Tabs>
      <Box className="project-inspector__content" role="tabpanel">
        {tab === "layers" ? (
          <ProjectLayerControls
            options={options}
            onOptionsChange={onOptionsChange}
            measurement={levelMeasurement}
            units={units}
          />
        ) : (
          units && mode === "edit" && stairAuthoring ? (
            <ProjectStairAuthoringDetails
              {...stairAuthoring}
              units={units}
              onTemplateChange={onStairAuthoringTemplateChange}
              onParametersChange={onStairAuthoringParametersChange}
              onConfirm={onConfirmStairAuthoring}
              onCancel={onCancelStairAuthoring}
            />
          ) : units && mode === "edit" && roomAuthoring ? (
            <ProjectRoomAuthoringDetails
              {...roomAuthoring}
              unit={units.length}
              onDimensionChange={onUpdateRoomAuthoringDimension}
              onElevationChange={onUpdateRoomAuthoringElevation}
              onSpacePanChange={onRoomAuthoringSpacePanChange}
              onCancel={onCancelRoomAuthoring}
            />
          ) : units ? (
            <ProjectPropertiesDetails
              model={model}
              selectionState={selectionState}
              wall={selectedWall}
              opening={selectedOpening?.opening}
              openingWall={selectedOpening?.wall}
              openingDisplayOffsetFromStart={selectedOpeningDisplayOffset}
              room={selectedRoom}
              roomLevelElevation={selectedRoomLevelElevation}
              stair={selectedStair}
              roomMeasurement={selectedRoomMeasurement}
              endpointAvailability={endpointAvailability}
              selectedVertexRemovable={selectedVertexRemovable}
              units={units}
              activeTool={activeTool}
              editable={mode === "edit"}
              onDeleteWall={onDeleteWall}
              onAddWallVertex={onAddWallVertex}
              onRemoveVertex={onRemoveVertex}
              onUpdateWallProperties={onUpdateWallProperties}
              onDeleteOpening={onDeleteOpening}
              onUpdateOpening={onUpdateOpening}
              openingAuthoring={openingAuthoring}
              onUpdateOpeningAuthoring={onUpdateOpeningAuthoring}
              onDeleteRoom={onDeleteRoom}
              onUpdateRoomProperties={onUpdateRoomProperties}
              onDeleteStair={onDeleteStair}
              onUpdateStair={onUpdateStair}
            />
          ) : (
            <Typography variant="caption" color="text.secondary">
              {t("properties.editModeOnly")}
            </Typography>
          )
        )}
      </Box>
    </Box>
  );
}
