import type { Level, Project } from "@casastudio/schema";
import type { ComponentProps, ReactNode } from "react";
import { useMemo } from "react";

import type { GeometryLevel } from "../../../core/api/api-types";
import { useAppShellContent } from "../../../shell/AppShellContext";
import { ProjectEditorStatusBar } from "../../editor-2d/components/ProjectEditorStatusBar";
import {
  editorActiveLevelChanged,
  editorDocumentScaleChanged,
  editorGridSnappingChanged,
  editorGridSpacingChanged,
  editorGridVisibilityChanged,
  editorRedoRequested,
  editorUndoRequested,
  type ProjectEditorState,
  type ProjectWorkspaceMode
} from "../../editor-2d/state/project-editor-slice";
import type { AppDispatch } from "../../../app/store/store";
import type { ViewportState } from "../../geometry-2d/viewport/viewport-transform-2d";
import {
  getVisibleLevelReferences3D,
  type ArchitecturalScene3DModel,
  type LevelVisibility3D
} from "../../project-3d/model/architectural-scene-3d-model";
import {
  ProjectEditHeaderActions,
  ProjectViewEditAction
} from "./components/ProjectHeaderActions";
import { ProjectLevelControl } from "./components/ProjectLevelControl";
import {
  WorkspaceRepresentationControl,
  type ProjectWorkspaceRepresentation
} from "./components/WorkspaceRepresentationControl";
import type { ProjectPersistenceDialog } from "./components/ProjectPersistenceDialogs";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type UseProjectWorkspaceShellOptions = {
  readonly project?: Project;
  readonly consistencyFailure: boolean;
  readonly mode: ProjectWorkspaceMode;
  readonly viewLevels: readonly GeometryLevel[];
  readonly selectedViewLevel?: GeometryLevel;
  readonly selectedLevel?: GeometryLevel | { readonly id: string };
  readonly editor: ProjectEditorState;
  readonly activeProject?: Project | null;
  readonly activeProjectLevel?: Level;
  readonly viewport: ViewportState;
  readonly representation: ProjectWorkspaceRepresentation;
  readonly scene3D?: ArchitecturalScene3DModel;
  readonly levelVisibility3D: LevelVisibility3D;
  readonly activeLevelId3D?: string;
  readonly saveInteractionBlocked: boolean;
  readonly isPhone: boolean;
  readonly isTablet: boolean;
  readonly inspector?: ReactNode;
  readonly dispatch: AppDispatch;
  readonly onViewLevelChange: (levelId: string) => void;
  readonly onCreateLevel: ComponentProps<
    typeof ProjectLevelControl
  >["onCreateLevel"];
  readonly onUpdateActiveLevel: ComponentProps<
    typeof ProjectLevelControl
  >["onUpdateActiveLevel"];
  readonly canCreateFromBelow: ComponentProps<
    typeof ProjectLevelControl
  >["canCreateFromBelow"];
  readonly onCreateFromBelow: ComponentProps<
    typeof ProjectLevelControl
  >["onCreateFromBelow"];
  readonly onDeleteActiveLevel: ComponentProps<
    typeof ProjectLevelControl
  >["onDeleteActiveLevel"];
  readonly onModeChange: (mode: ProjectWorkspaceMode | null) => void;
  readonly onRepresentationChange: (
    representation: ProjectWorkspaceRepresentation | null
  ) => void;
  readonly onSave: () => void;
  readonly onFitViewport: () => void;
  readonly onZoomViewport: (zoomFactor: number) => void;
  readonly onPersistenceDialogChange: (
    dialog: ProjectPersistenceDialog
  ) => void;
  readonly t: Translate;
};

/** Projects workspace controls and status into the shared application shell. */
export function useProjectWorkspaceShell({
  project,
  consistencyFailure,
  mode,
  viewLevels,
  selectedViewLevel,
  selectedLevel,
  editor,
  activeProject,
  activeProjectLevel,
  viewport,
  representation,
  scene3D,
  levelVisibility3D,
  activeLevelId3D,
  saveInteractionBlocked,
  isPhone,
  isTablet,
  inspector,
  dispatch,
  onViewLevelChange,
  onCreateLevel,
  onUpdateActiveLevel,
  canCreateFromBelow,
  onCreateFromBelow,
  onDeleteActiveLevel,
  onModeChange,
  onRepresentationChange,
  onSave,
  onFitViewport,
  onZoomViewport,
  onPersistenceDialogChange,
  t
}: UseProjectWorkspaceShellOptions): void {
  const shellContent = useMemo(
    () => ({
      title: project?.name ?? t("shell.title"),
      breadcrumb:
        mode === "edit"
          ? t("workspace.editingLevel", {
              level: activeProjectLevel?.name ?? ""
            })
          : t("shell.breadcrumb"),
      headerContextAccessory:
        !isPhone && project && !consistencyFailure ? (
          <ProjectLevelControl
            mode={mode}
            viewLevels={viewLevels}
            selectedViewLevel={selectedViewLevel}
            draftLevelIds={
              editor.draft?.building.levels.map((level) => ({
                id: level.id,
                name: level.name,
                elevation: level.elevation
              })) ?? []
            }
            projectLevelNames={project.building.levels.map((level) => ({
              id: level.id,
              name: level.name
            }))}
            activeEditLevelId={editor.activeLevelId}
            onViewLevelChange={onViewLevelChange}
            onEditLevelChange={(levelId) =>
              dispatch(editorActiveLevelChanged(levelId))
            }
            onCreateLevel={onCreateLevel}
            onUpdateActiveLevel={onUpdateActiveLevel}
            canCreateFromBelow={canCreateFromBelow}
            onCreateFromBelow={onCreateFromBelow}
            onDeleteActiveLevel={onDeleteActiveLevel}
          />
        ) : undefined,
      headerCenter:
        !isPhone && project && !consistencyFailure ? (
          <WorkspaceRepresentationControl
            representation={representation}
            disabled={saveInteractionBlocked}
            threeDDisabled={false}
            onChange={onRepresentationChange}
          />
        ) : undefined,
      headerAccessory:
        !isPhone && project && !consistencyFailure ? (
          mode === "view" ? (
            <ProjectViewEditAction
              fromThreeD={representation === "3d"}
              disabled={saveInteractionBlocked}
              onEdit={() => onModeChange("edit")}
            />
          ) : (
            <ProjectEditHeaderActions
              dirty={editor.dirty}
              disabled={saveInteractionBlocked}
              canUndo={editor.history.past.length > 0}
              canRedo={editor.history.future.length > 0}
              onBack={() => onModeChange("view")}
              onUndo={() => dispatch(editorUndoRequested())}
              onRedo={() => dispatch(editorRedoRequested())}
              onDiscard={() => onPersistenceDialogChange("discard")}
              onSave={onSave}
            />
          )
        ) : undefined,
      inspector: isTablet || isPhone ? undefined : inspector,
      status:
        representation === "3d" && scene3D ? (
          t(mode === "edit" ? "threeD.editStatus" : "threeD.status", {
            count: getVisibleLevelReferences3D(
              scene3D,
              levelVisibility3D,
              activeLevelId3D
            ).length
          })
        ) : selectedLevel && activeProject ? (
          <ProjectEditorStatusBar
            scale={mode === "edit" ? editor.presentation.scaleDenominator : 75}
            units={activeProject.units}
            gridVisible={mode === "edit" && editor.precision.gridVisible}
            snapToGrid={mode === "edit" && editor.precision.snapToGrid}
            gridSpacing={editor.precision.gridSpacing}
            zoom={viewport.zoom}
            editing={mode === "edit"}
            onScaleChange={(scale) =>
              dispatch(editorDocumentScaleChanged(scale))
            }
            onGridVisibleChange={(visible) =>
              dispatch(editorGridVisibilityChanged(visible))
            }
            onSnapToGridChange={(enabled) =>
              dispatch(editorGridSnappingChanged(enabled))
            }
            onGridSpacingChange={(spacing) =>
              dispatch(editorGridSpacingChanged(spacing))
            }
            onZoom={onZoomViewport}
            onFit={onFitViewport}
          />
        ) : (
          t("status.unavailable")
        ),
      immersiveWorkspace: true
    }),
    [
      activeLevelId3D,
      activeProject,
      activeProjectLevel?.name,
      consistencyFailure,
      canCreateFromBelow,
      dispatch,
      editor,
      inspector,
      isPhone,
      isTablet,
      levelVisibility3D,
      mode,
      onCreateLevel,
      onCreateFromBelow,
      onDeleteActiveLevel,
      onFitViewport,
      onModeChange,
      onPersistenceDialogChange,
      onRepresentationChange,
      onSave,
      onUpdateActiveLevel,
      onViewLevelChange,
      onZoomViewport,
      project,
      representation,
      saveInteractionBlocked,
      scene3D,
      selectedLevel,
      selectedViewLevel,
      t,
      viewLevels,
      viewport.zoom
    ]
  );

  useAppShellContent(shellContent);
}
