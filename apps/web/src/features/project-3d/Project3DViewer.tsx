import CenterFocusStrongRoundedIcon from "@mui/icons-material/CenterFocusStrongRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";

import { useCasaTranslation } from "../../core/i18n";
import { isEditableShortcutTarget } from "../geometry-2d/viewport/geometry-viewer-shortcuts";
import {
  createArchitecturalCameraPose3D,
  createArchitecturalScreenParityLandmarks3D,
  projectScenePointToArchitecturalScreen3D,
  type ArchitecturalCameraPose3D
} from "./camera/architectural-camera-3d";
import { CameraController } from "./camera/CameraController";
import {
  collectVisibleSceneBounds3D,
  getLevelReferenceOrientation3D,
  getVisibleLevelReferences3D,
  type ArchitecturalScene3DModel,
  type Door3D,
  type Floor3D,
  type LevelReference3D,
  type LevelVisibility3D,
  type SceneBounds3D,
  type Wall3D,
  type WallOpening3D,
  type Window3D
} from "./model/architectural-scene-3d-model";
import {
  collectArchitecturalSelectionTargets3D,
  getArchitecturalEntityKey3D,
  type ArchitecturalEntityIdentity3D
} from "./interaction/architectural-selection-3d";
import {
  getArchitecturalEntityColor3D,
  getArchitecturalEntityPresentationState3D,
  getProject3DShortcutAction,
  hasPointerGestureExceededSelectionThreshold3D
} from "./interaction/architectural-viewer-interaction-3d";

/** Inputs for the read-only architectural 3D viewport. */
export type Project3DViewerProps = {
  readonly model: ArchitecturalScene3DModel;
  readonly activeLevelId?: string;
  readonly visibility: LevelVisibility3D;
  readonly onVisibilityChange: (visibility: LevelVisibility3D) => void;
  readonly selection?: ArchitecturalEntityIdentity3D;
  readonly onSelectionChange: (selection?: ArchitecturalEntityIdentity3D) => void;
};

/** Renderer telemetry exposed for deterministic browser-level viewport checks. */
type ArchitecturalCameraTelemetry3D = Readonly<{
  position: string;
  viewDirection: string;
  projectedLandmarks: string;
  projectedSelectionTargets: string;
}>;

/** Empty camera telemetry used until the Canvas applies its first framing. */
const emptyArchitecturalCameraTelemetry3D: ArchitecturalCameraTelemetry3D =
  Object.freeze({
    position: "",
    viewDirection: "",
    projectedLandmarks: "",
    projectedSelectionTargets: ""
  });

/** Renders a resilient, read-only React Three Fiber architectural workspace. */
export function Project3DViewer({
  model,
  activeLevelId,
  visibility,
  onVisibilityChange,
  selection,
  onSelectionChange
}: Project3DViewerProps) {
  const { t } = useCasaTranslation("project-viewer");
  const [fitRequest, setFitRequest] = useState(0);
  const [resetRequest, setResetRequest] = useState(0);
  const [rendererStatus, setRendererStatus] = useState<"initializing" | "ready">(
    "initializing"
  );
  const [cameraTelemetry, setCameraTelemetry] = useState(
    emptyArchitecturalCameraTelemetry3D
  );
  const [hoveredEntity, setHoveredEntity] = useState<ArchitecturalEntityIdentity3D>();
  const [orbitDragging, setOrbitDragging] = useState(false);
  const pointerGestureRef = useRef<PointerGesture3D | undefined>(undefined);
  const webGlSupported = useMemo(detectWebGLSupport, []);
  const visibleLevels = useMemo(
    () => getVisibleLevelReferences3D(model, visibility, activeLevelId),
    [activeLevelId, model, visibility]
  );
  const visibleBounds = useMemo(
    () => collectVisibleSceneBounds3D(model, visibility, activeLevelId),
    [activeLevelId, model, visibility]
  );
  const initialPose = useMemo(
    () => createArchitecturalCameraPose3D(visibleBounds, 16 / 9),
    [visibleBounds]
  );
  const selectedKey = getArchitecturalEntityKey3D(selection);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const action = getProject3DShortcutAction(event);
      if (action === "clear-selection") {
        onSelectionChange(undefined);
        return;
      }
      if (action === "fit") {
        event.preventDefault();
        setFitRequest((request) => request + 1);
      } else if (action === "reset") {
        event.preventDefault();
        setResetRequest((request) => request + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectionChange]);

  useEffect(() => {
    setHoveredEntity(undefined);
  }, [activeLevelId, model.sourceProjectId, visibility]);

  const handlePointerDownCapture = useCallback((event: ReactPointerEvent) => {
    pointerGestureRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragged: false
    };
  }, []);
  const handlePointerMoveCapture = useCallback((event: ReactPointerEvent) => {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.dragged) return;
    if (hasPointerGestureExceededSelectionThreshold3D(
      gesture,
      { x: event.clientX, y: event.clientY }
    )) {
      gesture.dragged = true;
      setOrbitDragging(true);
    }
  }, []);
  const handlePointerUpCapture = useCallback(() => {
    setOrbitDragging(false);
  }, []);

  return (
    <Paper
      component="section"
      className="project-3d-viewer"
      square
      role="region"
      aria-labelledby="project-3d-viewer-title"
      aria-describedby="project-3d-viewer-description"
      data-testid="project-3d-workspace"
      data-renderer-status={webGlSupported ? rendererStatus : "unsupported"}
      data-camera-position={cameraTelemetry.position}
      data-camera-view-direction={cameraTelemetry.viewDirection}
      data-projected-landmarks={cameraTelemetry.projectedLandmarks}
      data-projected-selection-targets={cameraTelemetry.projectedSelectionTargets}
      data-visible-level-elevations={visibleLevels.map((level) => level.y).join(",")}
      data-visible-reference-orientations={visibleLevels
        .map((level) => `${level.id}:${getLevelReferenceOrientation3D(level)}`)
        .join(",")}
      data-architectural-wall-count={visibleLevels.reduce(
        (count, level) => count + level.walls.length,
        0
      )}
      data-architectural-wall-section-count={visibleLevels.reduce(
        (count, level) => count + level.walls.reduce(
          (levelCount, wall) => levelCount + wall.sections.length,
          0
        ),
        0
      )}
      data-architectural-floor-count={visibleLevels.reduce(
        (count, level) => count + level.floors.length,
        0
      )}
      data-architectural-opening-kinds={visibleLevels.flatMap((level) =>
        level.walls.flatMap((wall) => wall.openings.map((opening) => opening.kind))
      ).join(",")}
      data-architectural-door-count={visibleLevels.reduce(
        (count, level) => count + level.walls.reduce(
          (levelCount, wall) => levelCount + wall.doors.length,
          0
        ),
        0
      )}
      data-architectural-window-count={visibleLevels.reduce(
        (count, level) => count + level.walls.reduce(
          (levelCount, wall) => levelCount + wall.windows.length,
          0
        ),
        0
      )}
      data-architectural-wall-opening-count={visibleLevels.reduce(
        (count, level) => count + level.walls.reduce(
          (levelCount, wall) => levelCount + wall.wallOpenings.length,
          0
        ),
        0
      )}
      data-architectural-door-poses={JSON.stringify(visibleLevels.flatMap((level) =>
        level.walls.flatMap((wall) => wall.doors.map((door) => ({
          id: door.id,
          hingeSide: door.hingeSide,
          swingSide: door.swingSide,
          hinge: door.hinge,
          leafEnd: door.leafEnd
        })))
      ))}
      data-visible-architectural-bounds={visibleBounds
        ? JSON.stringify({ min: visibleBounds.min, max: visibleBounds.max })
        : ""}
      data-selected-entity-kind={selection?.kind ?? ""}
      data-selected-entity-id={selection?.id ?? ""}
      data-selected-level-id={selection?.levelId ?? ""}
    >
      <Box className="project-3d-viewer__toolbar">
        <Box>
          <Typography id="project-3d-viewer-title" variant="subtitle2">
            {t("threeD.title")}
          </Typography>
          <Typography
            id="project-3d-viewer-description"
            variant="caption"
            color="text.secondary"
          >
            {t("threeD.description")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} className="project-3d-viewer__actions">
          <ToggleButtonGroup
            exclusive
            size="small"
            value={visibility}
            onChange={(_event, value: LevelVisibility3D | null) => {
              if (value) onVisibilityChange(value);
            }}
            aria-label={t("threeD.visibility.label")}
          >
            <ToggleButton value="all">{t("threeD.visibility.all")}</ToggleButton>
            <ToggleButton value="active" disabled={!activeLevelId}>
              {t("threeD.visibility.active")}
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CenterFocusStrongRoundedIcon />}
            onClick={() => setFitRequest((request) => request + 1)}
          >
            {t("threeD.fit")}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RestartAltRoundedIcon />}
            onClick={() => setResetRequest((request) => request + 1)}
          >
            {t("threeD.reset")}
          </Button>
        </Stack>
      </Box>

      <Box
        className="project-3d-viewer__canvas"
        data-testid="project-3d-canvas"
        onPointerDownCapture={handlePointerDownCapture}
        onPointerMoveCapture={handlePointerMoveCapture}
        onPointerUpCapture={handlePointerUpCapture}
        onPointerCancel={handlePointerUpCapture}
        sx={{ cursor: orbitDragging ? "grabbing" : hoveredEntity ? "pointer" : "default" }}
      >
        {webGlSupported ? (
          <Project3DRenderErrorBoundary
            fallback={
              <RendererMessage
                severity="error"
                title={t("threeD.errors.runtimeTitle")}
                detail={t("threeD.errors.runtimeDetail")}
              />
            }
          >
            <Canvas
              camera={{
                fov: 45,
                near: initialPose.near,
                far: initialPose.far,
                position: [
                  initialPose.position.x,
                  initialPose.position.y,
                  initialPose.position.z
                ]
              }}
              dpr={[1, 2]}
              frameloop="demand"
              gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
              onCreated={() => setRendererStatus("ready")}
              onPointerMissed={() => {
                if (!pointerGestureRef.current?.dragged) onSelectionChange(undefined);
              }}
              fallback={
                <RendererMessage
                  severity="error"
                  title={t("threeD.errors.unsupportedTitle")}
                  detail={t("threeD.errors.unsupportedDetail")}
                />
              }
              aria-hidden="true"
            >
              <ArchitecturalFoundationScene
                levels={visibleLevels}
                bounds={visibleBounds}
                fitRequest={fitRequest}
                resetRequest={resetRequest}
                onCameraChange={setCameraTelemetry}
                selectedKey={selectedKey}
                pointerGestureRef={pointerGestureRef}
                onHoverChange={setHoveredEntity}
                onSelectionChange={onSelectionChange}
              />
            </Canvas>
          </Project3DRenderErrorBoundary>
        ) : (
          <RendererMessage
            severity="warning"
            title={t("threeD.errors.unsupportedTitle")}
            detail={t("threeD.errors.unsupportedDetail")}
          />
        )}

        {webGlSupported && !model.hasArchitecturalGeometry ? (
          <Box className="project-3d-viewer__empty" role="status">
            <Typography variant="subtitle2">{t("threeD.empty.title")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("threeD.empty.detail")}
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Paper>
  );
}

/** Props for a product-level renderer failure message. */
type RendererMessageProps = {
  readonly severity: "warning" | "error";
  readonly title: string;
  readonly detail: string;
};

/** Renders textual WebGL failure information without taking down the Project page. */
function RendererMessage({ severity, title, detail }: RendererMessageProps) {
  return (
    <Stack className="project-3d-viewer__message" sx={{ p: 3 }}>
      <Alert severity={severity}>
        <Typography component="h2" variant="subtitle1">{title}</Typography>
        <Typography variant="body2">{detail}</Typography>
      </Alert>
    </Stack>
  );
}

/** Props for the renderer-local React error boundary. */
type Project3DRenderErrorBoundaryProps = {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
};

/** State retained by the renderer-local React error boundary. */
type Project3DRenderErrorBoundaryState = { readonly failed: boolean };

/** Contains runtime renderer failures inside the 3D workspace. */
class Project3DRenderErrorBoundary extends Component<
  Project3DRenderErrorBoundaryProps,
  Project3DRenderErrorBoundaryState
> {
  override state: Project3DRenderErrorBoundaryState = { failed: false };

  /** Converts a descendant exception into the stable renderer fallback state. */
  static getDerivedStateFromError(): Project3DRenderErrorBoundaryState {
    return { failed: true };
  }

  /** Reports the caught exception while preserving the surrounding Project UI. */
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("CasaStudio 3D renderer failed.", error, info.componentStack);
  }

  /** Renders the Canvas or its product-level fallback. */
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Inputs for the R3F-owned foundation scene. */
type ArchitecturalFoundationSceneProps = {
  readonly levels: readonly LevelReference3D[];
  readonly bounds?: SceneBounds3D;
  readonly fitRequest: number;
  readonly resetRequest: number;
  readonly onCameraChange: (telemetry: ArchitecturalCameraTelemetry3D) => void;
  readonly selectedKey: string;
  readonly pointerGestureRef: MutableRefObject<PointerGesture3D | undefined>;
  readonly onHoverChange: (identity?: ArchitecturalEntityIdentity3D) => void;
  readonly onSelectionChange: (identity?: ArchitecturalEntityIdentity3D) => void;
};

/** Screen-space pointer gesture used to distinguish selection clicks from Orbit drags. */
type PointerGesture3D = {
  pointerId: number;
  x: number;
  y: number;
  dragged: boolean;
};

/** Renders restrained Project-derived references, lighting, and camera controls. */
function ArchitecturalFoundationScene({
  levels,
  bounds,
  fitRequest,
  resetRequest,
  onCameraChange,
  selectedKey,
  pointerGestureRef,
  onHoverChange,
  onSelectionChange
}: ArchitecturalFoundationSceneProps) {
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const { camera, size } = useThree();
  const ground = useMemo(() => createGroundReference(bounds), [bounds]);
  const reportCameraChange = useCallback(() => {
    const target = controlsRef.current?.target ?? bounds?.center ?? { x: 0, y: 0, z: 0 };
    const position = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    };
    const directionLength = Math.hypot(
      position.x - target.x,
      position.y - target.y,
      position.z - target.z
    );
    const pose: ArchitecturalCameraPose3D = {
      position,
      target: { x: target.x, y: target.y, z: target.z },
      near: camera.near,
      far: camera.far
    };
    const landmarks = bounds
      ? createArchitecturalScreenParityLandmarks3D(bounds)
      : undefined;
    const projectedLandmarks = landmarks
      ? Object.fromEntries(
          Object.entries(landmarks).map(([name, point]) => {
            const projected = projectScenePointToArchitecturalScreen3D(
              point,
              pose,
              size.width / size.height
            );
            return [name, projected
              ? { x: projected.x, y: projected.y }
              : null];
          })
        )
      : {};
    const projectedSelectionTargets = Object.fromEntries(
      collectArchitecturalSelectionTargets3D(levels).map((target) => {
        const projected = projectScenePointToArchitecturalScreen3D(
          target.point,
          pose,
          size.width / size.height
        );
        return [getArchitecturalEntityKey3D(target.identity), projected
          ? { x: projected.x, y: projected.y, depth: projected.depth }
          : null];
      })
    );
    onCameraChange({
      position: [position.x, position.y, position.z]
        .map(formatCameraTelemetryNumber)
        .join(","),
      viewDirection: directionLength > 0
        ? [
            (position.x - target.x) / directionLength,
            (position.y - target.y) / directionLength,
            (position.z - target.z) / directionLength
          ].map(formatCameraTelemetryNumber).join(",")
        : "",
      projectedLandmarks: JSON.stringify(projectedLandmarks),
      projectedSelectionTargets: JSON.stringify(projectedSelectionTargets)
    });
  }, [bounds, camera, levels, onCameraChange, size.height, size.width]);

  return (
    <>
      <color attach="background" args={["#f7f3ec"]} />
      <hemisphereLight args={["#fffdf8", "#b9b1a4", 1.45]} />
      <directionalLight position={[8, 12, 6]} intensity={1.15} color="#fff8ed" />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[ground.centerX, ground.y, ground.centerZ]}
        onPointerOver={() => onHoverChange(undefined)}
        onPointerUp={(event) => {
          if (!pointerGestureRef.current?.dragged) {
            event.stopPropagation();
            onSelectionChange(undefined);
          }
        }}
      >
        <planeGeometry args={[ground.size, ground.size]} />
        <meshStandardMaterial color="#f2ede4" roughness={1} metalness={0} />
      </mesh>
      <gridHelper
        args={[ground.size, ground.divisions, "#c9c0b3", "#ded7cc"]}
        position={[ground.centerX, ground.y + 0.002, ground.centerZ]}
        raycast={() => null}
      />
      {levels.map((level) => (
        <ArchitecturalLevel3D
          key={level.id}
          model={level}
          selectedKey={selectedKey}
          pointerGestureRef={pointerGestureRef}
          onHoverChange={onHoverChange}
          onSelectionChange={onSelectionChange}
        />
      ))}
      <CameraController
        bounds={bounds}
        controlsRef={controlsRef}
        fitRequest={fitRequest}
        resetRequest={resetRequest}
        onCameraChange={reportCameraChange}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={0.35}
        maxDistance={500}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI / 2 - 0.025}
        screenSpacePanning={false}
        onChange={reportCameraChange}
      />
    </>
  );
}

/** Renders the already-derived architectural entities for one Level. */
const ArchitecturalLevel3D = memo(function ArchitecturalLevel3D({
  model,
  ...interaction
}: { readonly model: LevelReference3D } & ArchitecturalInteractionContext3D) {
  return (
    <group name={`architectural-level:${model.id}`}>
      {model.floors.map((floor) => (
        <ArchitecturalFloor3D
          key={floor.id}
          model={floor}
          levelId={model.id}
          {...interaction}
        />
      ))}
      {model.walls.map((wall) => (
        <ArchitecturalWall3D
          key={wall.id}
          model={wall}
          levelId={model.id}
          {...interaction}
        />
      ))}
    </group>
  );
});

/** Extrudes the immutable rectangular sections belonging to one architectural Wall. */
function ArchitecturalWall3D({
  model,
  levelId,
  ...interaction
}: { readonly model: Wall3D; readonly levelId: string } & ArchitecturalInteractionContext3D) {
  const rotationY = Math.atan2(-model.u.z, model.u.x);
  const identity = useMemo<ArchitecturalEntityIdentity3D>(
    () => Object.freeze({ kind: "wall", id: model.id, levelId }),
    [levelId, model.id]
  );
  const { state, handlers } = useArchitecturalEntityInteraction3D(identity, interaction);
  return (
    <group name={`architectural-wall:${model.id}`}>
      <group
        position={[model.origin.x, model.origin.y, model.origin.z]}
        rotation={[0, rotationY, 0]}
      >
        {model.sections.map((section, index) => {
          const width = section.end - section.start;
          const height = section.top - section.bottom;
          return (
            <mesh
              key={`${section.start}:${section.end}:${section.bottom}:${section.top}:${index}`}
              name={`architectural-wall-section:${model.id}:${index}`}
              position={[
                section.start + width / 2,
                section.bottom + height / 2,
                0
              ]}
              {...handlers}
            >
              <boxGeometry args={[width, height, model.thickness]} />
              <meshStandardMaterial
                color={getArchitecturalEntityColor3D("#d9c8b2", state)}
                roughness={0.92}
                metalness={0}
                side={DoubleSide}
              />
            </mesh>
          );
        })}
      </group>
      {model.doors.map((door) => (
        <ArchitecturalDoor3D key={door.id} model={door} levelId={levelId} {...interaction} />
      ))}
      {model.windows.map((window) => (
        <ArchitecturalWindow3D key={window.id} model={window} levelId={levelId} {...interaction} />
      ))}
      {model.wallOpenings.map((opening) => (
        <ArchitecturalWallOpening3D
          key={opening.id}
          model={opening}
          levelId={levelId}
          {...interaction}
        />
      ))}
    </group>
  );
}

/** Renders one already-posed architectural Door leaf without domain interpretation. */
function ArchitecturalDoor3D({
  model,
  levelId,
  ...interaction
}: { readonly model: Door3D; readonly levelId: string } & ArchitecturalInteractionContext3D) {
  const rotationY = Math.atan2(-model.leaf.u.z, model.leaf.u.x);
  const identity = useMemo<ArchitecturalEntityIdentity3D>(
    () => Object.freeze({ kind: "door", id: model.id, levelId }),
    [levelId, model.id]
  );
  const { state, handlers } = useArchitecturalEntityInteraction3D(identity, interaction);
  return (
    <mesh
      name={`architectural-door:${model.id}`}
      position={[model.leaf.center.x, model.leaf.center.y, model.leaf.center.z]}
      rotation={[0, rotationY, 0]}
      {...handlers}
    >
      <boxGeometry args={[model.leaf.width, model.leaf.height, model.leaf.thickness]} />
      <meshStandardMaterial
        color={getArchitecturalEntityColor3D("#7e7162", state)}
        roughness={0.88}
        metalness={0}
        side={DoubleSide}
      />
    </mesh>
  );
}

/** Renders one minimal four-bar Window frame and lightly tinted glazing panel. */
function ArchitecturalWindow3D({
  model,
  levelId,
  ...interaction
}: { readonly model: Window3D; readonly levelId: string } & ArchitecturalInteractionContext3D) {
  const rotationY = Math.atan2(-model.frame.u.z, model.frame.u.x);
  const identity = useMemo<ArchitecturalEntityIdentity3D>(
    () => Object.freeze({ kind: "window", id: model.id, levelId }),
    [levelId, model.id]
  );
  const { state, handlers } = useArchitecturalEntityInteraction3D(identity, interaction);
  return (
    <group
      name={`architectural-window:${model.id}`}
      {...handlers}
    >
      {model.frameBars.map((bar, index) => (
        <mesh
          key={`${bar.center.x}:${bar.center.y}:${bar.center.z}:${index}`}
          name={`architectural-window-frame:${model.id}:${index}`}
          position={[bar.center.x, bar.center.y, bar.center.z]}
          rotation={[0, rotationY, 0]}
        >
          <boxGeometry args={[bar.width, bar.height, bar.depth]} />
          <meshStandardMaterial
            color={getArchitecturalEntityColor3D("#5f6668", state)}
            roughness={0.8}
            metalness={0.05}
            side={DoubleSide}
          />
        </mesh>
      ))}
      <mesh
        name={`architectural-window-glazing:${model.id}`}
        position={[
          model.glazing.center.x,
          model.glazing.center.y,
          model.glazing.center.z
        ]}
        rotation={[0, rotationY, 0]}
      >
        <boxGeometry
          args={[model.glazing.width, model.glazing.height, model.glazing.thickness]}
        />
        <meshStandardMaterial
          color={getArchitecturalEntityColor3D("#84b9c8", state)}
          transparent
          opacity={0.34}
          roughness={0.45}
          metalness={0}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** Retains Wall ownership for an unadorned passage while rendering no fake entity. */
function ArchitecturalWallOpening3D({
  model,
  levelId,
  ...interaction
}: {
  readonly model: WallOpening3D;
  readonly levelId: string;
} & ArchitecturalInteractionContext3D) {
  const rotationY = Math.atan2(-model.frame.u.z, model.frame.u.x);
  const identity = useMemo<ArchitecturalEntityIdentity3D>(
    () => Object.freeze({ kind: "wall-opening", id: model.id, levelId }),
    [levelId, model.id]
  );
  const { state, handlers } = useArchitecturalEntityInteraction3D(identity, interaction);
  return (
    <mesh
      name={`architectural-wall-opening:${model.id}`}
      position={[model.frame.center.x, model.frame.center.y, model.frame.center.z]}
      rotation={[0, rotationY, 0]}
      {...handlers}
    >
      <boxGeometry args={[
        model.frame.width,
        model.frame.height,
        Math.max(model.frame.wallThickness * 0.7, 0.04)
      ]} />
      <meshBasicMaterial
        color={getArchitecturalEntityColor3D("#b8aa94", state)}
        transparent
        opacity={state === "idle" ? 0.001 : state === "hovered" ? 0.16 : 0.3}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Renders one triangulated exact Room contour as a neutral horizontal Floor. */
function ArchitecturalFloor3D({
  model,
  levelId,
  ...interaction
}: { readonly model: Floor3D; readonly levelId: string } & ArchitecturalInteractionContext3D) {
  const identity = useMemo<ArchitecturalEntityIdentity3D>(
    () => Object.freeze({ kind: "room", id: model.roomId, levelId }),
    [levelId, model.roomId]
  );
  const { state, handlers } = useArchitecturalEntityInteraction3D(identity, interaction);
  const geometry = useMemo(() => {
    const floorGeometry = new BufferGeometry();
    const positions = model.triangles.flatMap((triangle) =>
      triangle.flatMap((index) => {
        const point = model.contour[index]!;
        return [point.x, 0, point.z];
      })
    );
    floorGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    floorGeometry.computeVertexNormals();
    return floorGeometry;
  }, [model]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      name={`architectural-floor:${model.roomId}`}
      geometry={geometry}
      position={[0, model.y + 0.004, 0]}
      {...handlers}
    >
      <meshStandardMaterial
        color={getArchitecturalEntityColor3D("#b8aa94", state)}
        roughness={1}
        metalness={0}
        side={DoubleSide}
      />
    </mesh>
  );
}

/** Shared local interaction state passed only through the renderer scene graph. */
type ArchitecturalInteractionContext3D = Readonly<{
  selectedKey: string;
  pointerGestureRef: MutableRefObject<PointerGesture3D | undefined>;
  onHoverChange: (identity?: ArchitecturalEntityIdentity3D) => void;
  onSelectionChange: (identity?: ArchitecturalEntityIdentity3D) => void;
}>;

/** Owns transient hover locally so pointer movement does not rerender unrelated entities. */
function useArchitecturalEntityInteraction3D(
  identity: ArchitecturalEntityIdentity3D,
  interaction: ArchitecturalInteractionContext3D
) {
  const [hovered, setHovered] = useState(false);
  return {
    state: getArchitecturalEntityPresentationState3D(
      identity,
      interaction.selectedKey,
      hovered ? getArchitecturalEntityKey3D(identity) : ""
    ),
    handlers: createEntityPointerHandlers3D(identity, interaction, setHovered)
  } as const;
}

/** Creates consistent semantic pointer events for any architectural hit assembly. */
function createEntityPointerHandlers3D(
  identity: ArchitecturalEntityIdentity3D,
  interaction: ArchitecturalInteractionContext3D,
  setHovered: (hovered: boolean) => void
) {
  return {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHovered(true);
      interaction.onHoverChange(identity);
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHovered(false);
      interaction.onHoverChange(undefined);
    },
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      if (!interaction.pointerGestureRef.current?.dragged) {
        interaction.onSelectionChange(identity);
      }
    }
  };
}

/** Formats camera telemetry without coupling architectural state to Three objects. */
function formatCameraTelemetryNumber(value: number): string {
  return value.toFixed(6);
}

/** Physical ground reference derived from scene bounds with a safe empty fallback. */
type GroundReference3D = Readonly<{
  centerX: number;
  centerZ: number;
  y: number;
  size: number;
  divisions: number;
}>;

/** Derives a restrained ground plane that contains the current physical bounds. */
function createGroundReference(bounds?: SceneBounds3D): GroundReference3D {
  const span = bounds ? Math.max(bounds.size.x, bounds.size.z) : 5;
  const size = Math.max(10, Math.ceil(span * 1.5));
  return Object.freeze({
    centerX: bounds?.center.x ?? 0,
    centerZ: bounds?.center.z ?? 0,
    y: Math.min(0, bounds?.min.y ?? 0) - 0.01,
    size,
    divisions: Math.min(100, Math.max(10, Math.round(size)))
  });
}

/** Detects whether this browser can create a WebGL rendering context. */
function detectWebGLSupport(): boolean {
  if (typeof document === "undefined" || typeof navigator === "undefined") return false;
  if (navigator.userAgent.toLowerCase().includes("jsdom")) return false;

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return context !== null;
  } catch {
    return false;
  }
}

export default Project3DViewer;
