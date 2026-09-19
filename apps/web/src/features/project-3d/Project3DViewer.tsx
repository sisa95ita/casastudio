import { FurnitureAsset3D } from "./FurnitureAsset3D";
import type { FurnitureModel3D } from "./model/furniture-3d-model";
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
import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Component,
  createContext,
  memo,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import {
  ACESFilmicToneMapping,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  type DirectionalLight
} from "three";

import { createFloorSolid3D } from "./model/floor-solid-3d";
import type { ArchitecturalSolid3D } from "./model/architectural-solid-3d";
import type { Staircase3D } from "./model/staircase-3d-model";

import { useCasaTranslation } from "../../core/i18n";
import { isEditableShortcutTarget } from "../geometry-2d/viewport/geometry-viewer-shortcuts";
import {
  createArchitecturalCameraPose3D,
  createArchitecturalOrbitLimits3D,
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
  createEntityPointerHandlers3D,
  getArchitecturalEntityPresentationState3D,
  getProject3DShortcutAction,
  hasPointerGestureExceededSelectionThreshold3D
} from "./interaction/architectural-viewer-interaction-3d";
import {
  architecturalPresentationProfile3D,
  createArchitecturalKeyLight3D,
  type ArchitecturalMaterialRole3D
} from "./presentation/architectural-presentation-3d";

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
      data-furniture-count={visibleLevels.reduce((sum, level) => sum + level.furniture.length, 0)}
      data-furniture-poses={JSON.stringify(visibleLevels.flatMap((level) => level.furniture.map((item) => ({ id: item.id, baseY: item.position.y, yaw: item.yaw, width: item.width, depth: item.depth, height: item.height }))))}
      data-architectural-staircase-count={visibleLevels.reduce((sum, level) => sum + level.staircases.length, 0)}
      data-architectural-step-count={visibleLevels.reduce((sum, level) => sum + level.staircases.reduce((count, stair) => count + stair.flights.reduce((n, flight) => n + flight.stepCount, 0), 0), 0)}
      data-architectural-floor-volumes={JSON.stringify(visibleLevels.flatMap((level) => level.floors.map((floor) => ({ roomId: floor.roomId, top: floor.y, bottom: floor.bottomY }))))}
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
              shadows="soft"
              gl={{
                antialias: true,
                alpha: false,
                powerPreference: "high-performance",
                outputColorSpace: SRGBColorSpace,
                toneMapping: ACESFilmicToneMapping,
                toneMappingExposure: architecturalPresentationProfile3D.lighting.exposure
              }}
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
  const orbitLimits = useMemo(() => createArchitecturalOrbitLimits3D(bounds), [bounds]);
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
        return [getArchitecturalEntityKey3D(target.identity) + (target.part ? `:${target.part}` : ""), projected
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
    <ArchitecturalMaterialsProvider3D>
      <color attach="background" args={[architecturalPresentationProfile3D.world.background]} />
      <hemisphereLight args={[
        architecturalPresentationProfile3D.lighting.hemisphereSky,
        architecturalPresentationProfile3D.lighting.hemisphereGround,
        architecturalPresentationProfile3D.lighting.hemisphereIntensity
      ]} />
      <ArchitecturalKeyLight bounds={bounds} />
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
        receiveShadow
      >
        <planeGeometry args={[ground.size, ground.size]} />
        <meshStandardMaterial
          color={architecturalPresentationProfile3D.world.ground}
          roughness={1}
          metalness={0}
        />
      </mesh>
      <gridHelper
        args={[
          ground.size,
          ground.divisions,
          architecturalPresentationProfile3D.world.gridMajor,
          architecturalPresentationProfile3D.world.gridMinor
        ]}
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
        rotateSpeed={0.65}
        zoomSpeed={0.9}
        panSpeed={0.8}
        minDistance={orbitLimits.minDistance}
        maxDistance={orbitLimits.maxDistance}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2 - 0.035}
        screenSpacePanning={false}
        onChange={reportCameraChange}
      />
    </ArchitecturalMaterialsProvider3D>
  );
}

/** Positions the only shadow-casting light and its camera from physical bounds. */
function ArchitecturalKeyLight({ bounds }: { readonly bounds?: SceneBounds3D }) {
  const lightRef = useRef<DirectionalLight>(null);
  const { scene } = useThree();
  const light = useMemo(() => createArchitecturalKeyLight3D(bounds), [bounds]);
  useEffect(() => {
    const target = lightRef.current?.target;
    if (!target) return;
    target.position.set(light.target.x, light.target.y, light.target.z);
    scene.add(target);
    target.updateMatrixWorld();
    return () => {
      scene.remove(target);
    };
  }, [light.target.x, light.target.y, light.target.z, scene]);
  return <directionalLight
    ref={lightRef}
    position={[light.position.x, light.position.y, light.position.z]}
    intensity={architecturalPresentationProfile3D.lighting.keyIntensity}
    color={architecturalPresentationProfile3D.lighting.keyColor}
    castShadow
    shadow-mapSize-width={architecturalPresentationProfile3D.shadows.mapSize}
    shadow-mapSize-height={architecturalPresentationProfile3D.shadows.mapSize}
    shadow-camera-left={-light.shadowExtent}
    shadow-camera-right={light.shadowExtent}
    shadow-camera-top={light.shadowExtent}
    shadow-camera-bottom={-light.shadowExtent}
    shadow-camera-near={light.shadowNear}
    shadow-camera-far={light.shadowFar}
    shadow-bias={architecturalPresentationProfile3D.shadows.bias}
    shadow-normalBias={architecturalPresentationProfile3D.shadows.normalBias}
  />;
}

type CanvasArchitecturalMaterialRole3D = Exclude<
  ArchitecturalMaterialRole3D,
  "furnitureFallback" | "furnitureFallbackPlinth"
>;

const canvasArchitecturalMaterialRoles3D: readonly CanvasArchitecturalMaterialRole3D[] =
  ["wall", "floorTop", "floorEdge", "door", "openingFrame", "glazing", "stairWalking", "stairStructure"];

type ArchitecturalMaterialSet3D = Readonly<
  Record<CanvasArchitecturalMaterialRole3D, MeshStandardMaterial | MeshPhysicalMaterial>
  & { hitTarget: MeshBasicMaterial }
>;

const ArchitecturalMaterialsContext3D = createContext<ArchitecturalMaterialSet3D | null>(null);

/** Owns one immutable material instance per architectural role for this Canvas. */
function ArchitecturalMaterialsProvider3D({ children }: { readonly children: ReactNode }) {
  const materials = useMemo<ArchitecturalMaterialSet3D>(() => {
    const result = Object.fromEntries(
      canvasArchitecturalMaterialRoles3D.map((role) => {
        const value = architecturalPresentationProfile3D.materials[role];
        const surface = role === "glazing"
          ? new MeshPhysicalMaterial({
              ...value,
              transparent: true,
              depthWrite: false,
              side: DoubleSide,
              thickness: 0.012
            })
          : new MeshStandardMaterial(value);
        surface.name = `casa-architectural-${role}`;
        return [role, surface];
      })
    ) as Record<CanvasArchitecturalMaterialRole3D, MeshStandardMaterial | MeshPhysicalMaterial>;
    const hitTarget = new MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false
    });
    hitTarget.name = "casa-architectural-hit-target";
    return Object.freeze({ ...result, hitTarget });
  }, []);
  useEffect(() => () => {
    Object.values(materials).forEach((material) => material.dispose());
  }, [materials]);
  return <ArchitecturalMaterialsContext3D.Provider value={materials}>
    {children}
  </ArchitecturalMaterialsContext3D.Provider>;
}

/** Returns the Canvas-owned shared architectural material set. */
function useArchitecturalMaterials3D(): ArchitecturalMaterialSet3D {
  const materials = useContext(ArchitecturalMaterialsContext3D);
  if (!materials) throw new Error("Architectural materials require their scene provider.");
  return materials;
}

/** Draws a non-selectable, non-shadowing semantic hover or selection outline. */
function ArchitecturalInteractionEdges3D({
  state
}: { readonly state: "idle" | "hovered" | "selected" }) {
  if (state === "idle") return null;
  return <Edges
    threshold={20}
    color={state === "selected"
      ? architecturalPresentationProfile3D.interaction.selected
      : architecturalPresentationProfile3D.interaction.hover}
    raycast={() => undefined}
  />;
}

/** Renders the already-derived architectural entities for one Level. */
const ArchitecturalLevel3D = memo(function ArchitecturalLevel3D({
  model,
  ...interaction
}: { readonly model: LevelReference3D } & ArchitecturalInteractionContext3D) {
  return (
    <group name={`architectural-level:${model.id}`}>
      {model.furniture.map((item) => <ArchitecturalFurniture3D key={item.id} model={item} {...interaction} />)}
      {model.floors.map((floor) => (
        <ArchitecturalFloor3D
          key={floor.id}
          model={floor}
          levelId={model.id}
          {...interaction}
        />
      ))}
      {model.staircases.map((staircase) => (
        <ArchitecturalStaircase3D key={staircase.id} model={staircase} levelId={model.id} {...interaction} />
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

/** Bubbled child-mesh hits retain the owning Furniture identity and existing orbit-click rules. */
function ArchitecturalFurniture3D({ model, ...interaction }: { model: FurnitureModel3D } & ArchitecturalInteractionContext3D) {
  const identity = useMemo<ArchitecturalEntityIdentity3D>(() => ({ kind: "furniture", id: model.id, levelId: model.levelId }), [model.id, model.levelId]);
  const { state, handlers } = useArchitecturalEntityInteraction3D(identity, interaction);
  return <group name={`furniture:${model.id}`} userData={{ identity }} {...handlers}>
    <FurnitureAsset3D model={model} state={state} />
  </group>;
}

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
  const materials = useArchitecturalMaterials3D();
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
              material={materials.wall}
              {...handlers}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[width, height, model.thickness]} />
              <ArchitecturalInteractionEdges3D state={state} />
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
  const materials = useArchitecturalMaterials3D();
  return (
    <mesh
      name={`architectural-door:${model.id}`}
      position={[model.leaf.center.x, model.leaf.center.y, model.leaf.center.z]}
      rotation={[0, rotationY, 0]}
      material={materials.door}
      {...handlers}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[model.leaf.width, model.leaf.height, model.leaf.thickness]} />
      <ArchitecturalInteractionEdges3D state={state} />
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
  const materials = useArchitecturalMaterials3D();
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
          material={materials.openingFrame}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[bar.width, bar.height, bar.depth]} />
          <ArchitecturalInteractionEdges3D state={state} />
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
        material={materials.glazing}
      >
        <boxGeometry
          args={[model.glazing.width, model.glazing.height, model.glazing.thickness]}
        />
        <ArchitecturalInteractionEdges3D state={state} />
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
  const materials = useArchitecturalMaterials3D();
  return (
    <mesh
      name={`architectural-wall-opening:${model.id}`}
      position={[model.frame.center.x, model.frame.center.y, model.frame.center.z]}
      rotation={[0, rotationY, 0]}
      material={materials.hitTarget}
      {...handlers}
    >
      <boxGeometry args={[
        model.frame.width,
        model.frame.height,
        Math.max(model.frame.wallThickness * 0.7, 0.04)
      ]} />
      <ArchitecturalInteractionEdges3D state={state} />
    </mesh>
  );
}

/** Renders a closed Room volume; every face retains the same Room identity. */
function ArchitecturalFloor3D({
  model, levelId, ...interaction
}: { readonly model: Floor3D; readonly levelId: string } & ArchitecturalInteractionContext3D) {
  const identity = useMemo<ArchitecturalEntityIdentity3D>(
    () => Object.freeze({ kind: "room", id: model.roomId, levelId }), [levelId, model.roomId]
  );
  const { state, handlers } = useArchitecturalEntityInteraction3D(identity, interaction);
  const solids = useMemo(() => createFloorSolid3D(model), [model]);
  return <group name={`architectural-floor:${model.roomId}`} {...handlers}>
    <ArchitecturalVolumeMesh3D solid={solids.top} role="floorTop" state={state} />
    <ArchitecturalVolumeMesh3D solid={solids.edgesAndBottom} role="floorEdge" state={state} />
  </group>;
}

/** Batches all Flight steps, structural slabs, and Landings into three semantic meshes. */
function ArchitecturalStaircase3D({
  model, levelId, ...interaction
}: { readonly model: Staircase3D; readonly levelId: string } & ArchitecturalInteractionContext3D) {
  const identity = useMemo<ArchitecturalEntityIdentity3D>(
    () => Object.freeze({ kind: "staircase", id: model.id, levelId }), [levelId, model.id]
  );
  const { state, handlers } = useArchitecturalEntityInteraction3D(identity, interaction);
  return <group name={`architectural-staircase:${model.id}`} {...handlers}>
    <ArchitecturalVolumeMesh3D solid={model.stepsSolid} role="stairWalking" state={state} />
    <ArchitecturalVolumeMesh3D solid={model.slabSolid} role="stairStructure" state={state} />
    <ArchitecturalVolumeMesh3D solid={model.landingsSolid} role="stairWalking" state={state} />
  </group>;
}

/** Uploads static outward triangles once, retaining material identity under interaction tint. */
function ArchitecturalVolumeMesh3D({ solid, role, state }: {
  readonly solid: ArchitecturalSolid3D;
  readonly role: CanvasArchitecturalMaterialRole3D;
  readonly state: "idle" | "hovered" | "selected";
}) {
  const materials = useArchitecturalMaterials3D();
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(solid.positions, 3));
    result.computeVertexNormals();
    return result;
  }, [solid]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (solid.positions.length === 0) return null;
  return <mesh geometry={geometry} material={materials[role]} castShadow receiveShadow>
    <ArchitecturalInteractionEdges3D state={state} />
  </mesh>;
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
