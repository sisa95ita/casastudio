import { measureLevel, type RoomMeasurement } from "@casastudio/geometry";
import type {
  Opening,
  Project,
  Room,
  UpdateOpeningProperties,
  UpdateRoomProperties,
  Wall
} from "@casastudio/schema";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { useState } from "react";

import { useCasaTranslation } from "../../../../core/i18n";
import { ProjectLayerControls } from "../../../editor-2d/components/ProjectLayerControls";
import type {
  OpeningAuthoringProperties,
  PlaceOpeningInteraction,
  ProjectWorkspaceMode
} from "../../../editor-2d/state/project-editor-slice";
import type { WallEndpointEditingAvailability } from "../../../editor-2d/tools/wall/project-wall-editing";
import type { GeometryPresentationModel2D } from "../../../geometry-2d/presentation/geometry-presentation-model-2d";
import type { GeometrySelectionState } from "../../../geometry-2d/selection/geometry-selection-state";
import type { GeometryDisplayOptions } from "../../../geometry-2d/viewer/GeometrySvgViewer";
import {
  ProjectPropertiesDetails,
  ProjectSelectionDetails
} from "./ProjectSelectionDetails";

type ProjectWorkspaceInspectorProps = {
  readonly model: GeometryPresentationModel2D;
  readonly selectionState: GeometrySelectionState;
  readonly options: GeometryDisplayOptions;
  readonly onOptionsChange: (options: GeometryDisplayOptions) => void;
  readonly mode: ProjectWorkspaceMode;
  readonly selectedWall?: Wall;
  readonly selectedOpening?: { readonly wall: Wall; readonly opening: Opening };
  readonly selectedRoom?: Room;
  readonly selectedRoomMeasurement?: RoomMeasurement;
  readonly levelMeasurement?: ReturnType<typeof measureLevel>;
  /** Transient Wall-local Opening offset used only for Inspector display. */
  readonly selectedOpeningDisplayOffset?: number;
  readonly openingAuthoring?: PlaceOpeningInteraction;
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
  readonly onDeleteRoom: () => void;
  readonly onUpdateRoomProperties: (properties: Partial<UpdateRoomProperties>) => boolean;
};

/** Provides the durable Layers, Selection, and Properties inspector foundation. */
export function ProjectWorkspaceInspector({
  model,
  selectionState,
  options,
  onOptionsChange,
  mode,
  selectedWall,
  selectedOpening,
  selectedRoom,
  selectedRoomMeasurement,
  levelMeasurement,
  selectedOpeningDisplayOffset,
  openingAuthoring,
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
  onDeleteRoom,
  onUpdateRoomProperties
}: ProjectWorkspaceInspectorProps) {
  const { t } = useCasaTranslation("project-viewer");
  const [tab, setTab] = useState<"layers" | "selection" | "properties">(
    "layers"
  );

  return (
    <Box className="project-inspector">
      <Tabs
        value={tab}
        onChange={(_event, value) => setTab(value)}
        variant="fullWidth"
        aria-label={t("inspector.tabsLabel")}
      >
        <Tab value="layers" label={t("inspector.layers")} />
        <Tab value="selection" label={t("inspector.selection")} />
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
        ) : tab === "selection" ? (
          units ? (
            <ProjectSelectionDetails
              model={model}
              selectionState={selectionState}
              wall={selectedWall}
              opening={selectedOpening?.opening}
              openingWall={selectedOpening?.wall}
              openingDisplayOffsetFromStart={selectedOpeningDisplayOffset}
              room={selectedRoom}
              roomMeasurement={selectedRoomMeasurement}
              units={units}
              endpointAvailability={endpointAvailability}
              selectedVertexRemovable={selectedVertexRemovable}
              onDeleteWall={onDeleteWall}
              onAddWallVertex={onAddWallVertex}
              onRemoveVertex={onRemoveVertex}
              onDeleteOpening={onDeleteOpening}
              onUpdateOpening={onUpdateOpening}
              onDeleteRoom={onDeleteRoom}
              editable={mode === "edit"}
            />
          ) : null
        ) : (
          units && mode === "edit" ? (
            <ProjectPropertiesDetails
              selectionState={selectionState}
              wall={selectedWall}
              opening={selectedOpening?.opening}
              openingWall={selectedOpening?.wall}
              openingDisplayOffsetFromStart={selectedOpeningDisplayOffset}
              room={selectedRoom}
              units={units}
              onUpdateWallProperties={onUpdateWallProperties}
              onUpdateOpening={onUpdateOpening}
              openingAuthoring={openingAuthoring}
              onUpdateOpeningAuthoring={onUpdateOpeningAuthoring}
              onUpdateRoomProperties={onUpdateRoomProperties}
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
