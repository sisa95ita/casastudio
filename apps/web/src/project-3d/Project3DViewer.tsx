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
import { Canvas, useThree } from "@react-three/fiber";
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode
} from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from "three";

import { useCasaTranslation } from "../i18n";
import {
  createArchitecturalCameraPose3D,
  createArchitecturalScreenParityLandmarks3D,
  projectScenePointToArchitecturalScreen3D,
  type ArchitecturalCameraPose3D
} from "./architectural-camera-3d";
import {
  collectVisibleSceneBounds3D,
  getLevelReferenceOrientation3D,
  getVisibleLevelReferences3D,
  type ArchitecturalScene3DModel,
  type Floor3D,
  type LevelReference3D,
  type LevelVisibility3D,
  type SceneBounds3D,
  type Wall3D
} from "./architectural-scene-3d-model";

/** Inputs for the read-only architectural 3D viewport. */
export type Project3DViewerProps = {
  readonly model: ArchitecturalScene3DModel;
  readonly activeLevelId?: string;
  readonly visibility: LevelVisibility3D;
  readonly onVisibilityChange: (visibility: LevelVisibility3D) => void;
};

/** Renderer telemetry exposed for deterministic browser-level viewport checks. */
type ArchitecturalCameraTelemetry3D = Readonly<{
  position: string;
  viewDirection: string;
  projectedLandmarks: string;
}>;

/** Empty camera telemetry used until the Canvas applies its first framing. */
const emptyArchitecturalCameraTelemetry3D: ArchitecturalCameraTelemetry3D =
  Object.freeze({ position: "", viewDirection: "", projectedLandmarks: "" });

/** Renders a resilient, read-only React Three Fiber architectural workspace. */
export function Project3DViewer({
  model,
  activeLevelId,
  visibility,
  onVisibilityChange
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
      data-visible-architectural-bounds={visibleBounds
        ? JSON.stringify({ min: visibleBounds.min, max: visibleBounds.max })
        : ""}
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

      <Box className="project-3d-viewer__canvas" data-testid="project-3d-canvas">
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
};

/** Renders restrained Project-derived references, lighting, and camera controls. */
function ArchitecturalFoundationScene({
  levels,
  bounds,
  fitRequest,
  resetRequest,
  onCameraChange
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
      projectedLandmarks: JSON.stringify(projectedLandmarks)
    });
  }, [bounds, camera, onCameraChange, size.height, size.width]);

  return (
    <>
      <color attach="background" args={["#f7f3ec"]} />
      <hemisphereLight args={["#fffdf8", "#b9b1a4", 1.45]} />
      <directionalLight position={[8, 12, 6]} intensity={1.15} color="#fff8ed" />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[ground.centerX, ground.y, ground.centerZ]}
      >
        <planeGeometry args={[ground.size, ground.size]} />
        <meshStandardMaterial color="#f2ede4" roughness={1} metalness={0} />
      </mesh>
      <gridHelper
        args={[ground.size, ground.divisions, "#c9c0b3", "#ded7cc"]}
        position={[ground.centerX, ground.y + 0.002, ground.centerZ]}
      />
      {levels.map((level) => (
        <ArchitecturalLevel3D key={level.id} model={level} />
      ))}
      <CameraAndOrbitController
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
function ArchitecturalLevel3D({ model }: { readonly model: LevelReference3D }) {
  return (
    <group name={`architectural-level:${model.id}`}>
      {model.floors.map((floor) => (
        <ArchitecturalFloor3D key={floor.id} model={floor} />
      ))}
      {model.walls.map((wall) => (
        <ArchitecturalWall3D key={wall.id} model={wall} />
      ))}
    </group>
  );
}

/** Extrudes the immutable rectangular sections belonging to one architectural Wall. */
function ArchitecturalWall3D({ model }: { readonly model: Wall3D }) {
  const rotationY = Math.atan2(-model.u.z, model.u.x);
  return (
    <group
      name={`architectural-wall:${model.id}`}
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
          >
            <boxGeometry args={[width, height, model.thickness]} />
            <meshStandardMaterial
              color="#d9c8b2"
              roughness={0.92}
              metalness={0}
              side={DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** Renders one triangulated exact Room contour as a neutral horizontal Floor. */
function ArchitecturalFloor3D({ model }: { readonly model: Floor3D }) {
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
    >
      <meshStandardMaterial
        color="#b8aa94"
        roughness={1}
        metalness={0}
        side={DoubleSide}
      />
    </mesh>
  );
}

/** Inputs for synchronizing physical framing with R3F camera objects. */
type CameraAndOrbitControllerProps = {
  readonly bounds?: SceneBounds3D;
  readonly controlsRef: React.RefObject<React.ElementRef<typeof OrbitControls> | null>;
  readonly fitRequest: number;
  readonly resetRequest: number;
  readonly onCameraChange: () => void;
};

/** Applies deterministic fit/reset requests without placing camera objects in app state. */
function CameraAndOrbitController({
  bounds,
  controlsRef,
  fitRequest,
  resetRequest,
  onCameraChange
}: CameraAndOrbitControllerProps) {
  const { camera, size, invalidate } = useThree();
  const framingStateRef = useRef({ fitRequest, resetRequest, hasFramed: false });

  useEffect(() => {
    const controls = controlsRef.current;
    const previous = framingStateRef.current;
    const fitChanged = fitRequest !== previous.fitRequest;
    const resetChanged = resetRequest !== previous.resetRequest;
    const preserveCurrentDirection = previous.hasFramed && fitChanged && !resetChanged;
    const dampingEnabled = controls?.enableDamping;
    if (controls) {
      controls.enableDamping = false;
      controls.update();
    }
    const viewingDirection = preserveCurrentDirection && controls
      ? {
          x: camera.position.x - controls.target.x,
          y: camera.position.y - controls.target.y,
          z: camera.position.z - controls.target.z
        }
      : undefined;
    const pose = createArchitecturalCameraPose3D(
      bounds,
      size.width / size.height,
      45,
      viewingDirection
    );
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.near = pose.near;
    camera.far = pose.far;
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    camera.updateProjectionMatrix();
    controls?.target.set(pose.target.x, pose.target.y, pose.target.z);
    controls?.update();
    if (controls && dampingEnabled !== undefined) {
      controls.enableDamping = dampingEnabled;
    }
    framingStateRef.current = { fitRequest, resetRequest, hasFramed: true };
    onCameraChange();
    invalidate();
  }, [
    bounds,
    camera,
    controlsRef,
    fitRequest,
    invalidate,
    onCameraChange,
    resetRequest,
    size.height,
    size.width
  ]);

  return null;
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
