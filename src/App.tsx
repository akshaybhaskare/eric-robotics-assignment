import { useEffect, useLayoutEffect, useRef, useState, useReducer } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  ArrowRight,
  BatteryFull,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Grid2X2,
  Map,
  MapPin,
  Pause,
  Play,
  Scan,
  Settings,
  ShieldCheck,
  Signal,
  UserRound,
  Video,
  ZoomIn,
  ZoomOut,
  Route,
  X,
} from "lucide-react";

import * as THREE from "three";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  missionReducer,
  initialMissionState,
} from "./features/mission/mission.reducer";

import { goalReducer, initialGoalState } from "./features/goals/goal.reducer";

import type { GoalDraft, NavigationGoal } from "./features/goals/goal.types";

type Mode = "AUTO" | "MANUAL";
type MainView = "camera" | "map";

type GroundPoint = { x: number; y: number };
type RobotPose = { x: number; y: number; heading: number };

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.8;
const DEFAULT_PCD = "/assets/maps/warehouse.pcd";
// Simulated robot pose in map coordinates (metres, heading in degrees CCW from +X).
const ROBOT_POSE: RobotPose = { x: -2, y: 4, heading: 80 };

type PointCloudCanvasProps = {
  fileUrl?: string;
  onGroundPick?: (point: GroundPoint) => void;
  selectedPoint?: GroundPoint | null;
  robot?: RobotPose;
  /** When false the canvas only displays (used while it is the small preview). */
  interactive?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
};

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    }
  });
}

function PointCloudCanvas({
  fileUrl,
  onGroundPick,
  selectedPoint,
  robot,
  interactive = true,
  zoom,
  onZoomChange,
}: PointCloudCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const pickCallbackRef = useRef(onGroundPick);
  const zoomChangeRef = useRef(onZoomChange);
  const zoomRef = useRef(zoom);
  const interactiveRef = useRef(interactive);
  const markerRef = useRef<THREE.Group | null>(null);
  const robotRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    pickCallbackRef.current = onGroundPick;
  }, [onGroundPick]);

  useEffect(() => {
    zoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    interactiveRef.current = interactive;
    if (controlsRef.current) controlsRef.current.enabled = interactive;
    const canvas = host.current?.querySelector("canvas");
    if (canvas) {
      canvas.style.cursor = !interactive
        ? "default"
        : onGroundPick
          ? "crosshair"
          : "grab";
    }
  }, [interactive, onGroundPick]);

  useEffect(() => {
    const node = host.current;
    if (!node) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#cfd0cd");

    // Top-down orthographic "map" camera. The scene is Y-up; PCD data is
    // Z-up, so loaded clouds are rotated into the XZ plane. Screen-up is
    // map +Y (scene -Z).
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 5000);
    camera.position.set(0, 200, 0.01);
    camera.zoom = zoomRef.current ?? 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(node.clientWidth, node.clientHeight, false);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.cursor = !interactiveRef.current
      ? "default"
      : pickCallbackRef.current
        ? "crosshair"
        : "grab";
    node.appendChild(renderer.domElement);

    // Left-drag pans (hand cursor, like the reference), right-drag rotates,
    // wheel / pinch zooms.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    controls.minZoom = MIN_ZOOM;
    controls.maxZoom = MAX_ZOOM;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.enabled = interactiveRef.current;
    controlsRef.current = controls;

    // Keep the zoom slider in sync with wheel / pinch zoom.
    controls.addEventListener("change", () => {
      const current = Number(camera.zoom.toFixed(2));
      if (Math.abs(current - (zoomRef.current ?? current)) > 0.005) {
        zoomRef.current = current;
        zoomChangeRef.current?.(current);
      }
    });

    // Fit the map into the view whatever the panel size is.
    let fit = { w: 20, h: 20 };
    const applyFrustum = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (!w || !h) return;
      const aspect = w / h;
      const viewH = Math.max(fit.h, fit.w / aspect);
      camera.left = (-viewH * aspect) / 2;
      camera.right = (viewH * aspect) / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
    };

    // Illustrative point cloud used until a PCD has loaded.
    const positions: number[] = [];
    for (let i = 0; i < 3200; i++) {
      const x = (Math.random() - 0.5) * 12;
      const z = (Math.random() - 0.5) * 12;
      const edge =
        Math.abs(x) > 4.6 ||
        Math.abs(z) > 4.6 ||
        (Math.abs(x) > 2 && Math.abs(z) < 0.3);

      if (edge || Math.random() > 0.91) {
        positions.push(x, Math.random() * 0.45, z);
      }
    }
    const demoGeometry = new THREE.BufferGeometry();
    demoGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    const demoMaterial = new THREE.PointsMaterial({
      color: "#26343a",
      size: 2,
      sizeAttenuation: false,
    });
    const demoCloud = new THREE.Points(demoGeometry, demoMaterial);
    scene.add(demoCloud);

    let activeMaterial: THREE.PointsMaterial = demoMaterial;
    let pointWorld = 0.05; // approx. point spacing in world units

    // Goal marker lives in the Three.js world so it stays registered with the
    // map while the user pans or zooms.
    const marker = new THREE.Group();
    marker.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshBasicMaterial({ color: "#ef4444" }),
      ),
    );
    const markerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.035, 8, 24),
      new THREE.MeshBasicMaterial({ color: "#ef4444" }),
    );
    markerRing.rotation.x = Math.PI / 2;
    marker.add(markerRing);
    marker.scale.setScalar(5);
    marker.visible = false;
    scene.add(marker);
    markerRef.current = marker;

    // Robot marker (simulated pose).
    const robotGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.5, 1.1),
      new THREE.MeshBasicMaterial({ color: "#111827" }),
    );
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 0.8, 3),
      new THREE.MeshBasicMaterial({ color: "#38bdf8" }),
    );
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 1.3;
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.08, 8, 40),
      new THREE.MeshBasicMaterial({ color: "#38bdf8" }),
    );
    halo.rotation.x = Math.PI / 2;
    robotGroup.add(body, nose, halo);
    robotGroup.scale.setScalar(1.4);
    robotGroup.visible = false;
    scene.add(robotGroup);
    robotRef.current = robotGroup;

    const placeRobot = (pose?: RobotPose) => {
      if (!pose) {
        robotGroup.visible = false;
        return;
      }
      // Map Y maps to scene -Z; heading is CCW from +X.
      robotGroup.position.set(pose.x, 0.5, -pose.y);
      robotGroup.rotation.y = THREE.MathUtils.degToRad(pose.heading);
      robotGroup.visible = true;
    };
    placeRobot(robot);

    const placeMarker = (point?: GroundPoint | null) => {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        marker.visible = false;
        return;
      }
      marker.position.set(point.x, 0.4, -point.y);
      marker.visible = true;
    };
    placeMarker(selectedPoint);

    let active = true;
    let animationId = 0;
    let loadedCloud: THREE.Points | null = null;

    if (fileUrl) {
      new PCDLoader().load(
        fileUrl,
        (pcd) => {
          if (!active) {
            pcd.geometry.dispose();
            const material = pcd.material;
            if (Array.isArray(material)) material.forEach((m) => m.dispose());
            else material.dispose();
            return;
          }

          scene.remove(demoCloud);
          pcd.rotation.x = -Math.PI / 2; // PCD is Z-up, scene is Y-up
          loadedCloud = pcd;
          scene.add(pcd);

          // PCDs that carry an rgb field keep their own colours.
          const hasColor = Boolean(pcd.geometry.getAttribute("color"));
          const oldMaterial = pcd.material;
          const material = new THREE.PointsMaterial({
            color: hasColor ? "#ffffff" : "#29383d",
            vertexColors: hasColor,
            size: 2,
            sizeAttenuation: false,
          });
          pcd.material = material;
          activeMaterial = material;
          if (Array.isArray(oldMaterial)) {
            oldMaterial.forEach((m) => m.dispose());
          } else {
            oldMaterial.dispose();
          }

          pcd.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(pcd);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const count = pcd.geometry.getAttribute("position").count;

          pointWorld = Math.min(
            0.3,
            Math.max(0.02, Math.sqrt(Math.max(size.x * size.z, 1e-6) / Math.max(count, 1))),
          );
          fit = { w: Math.max(size.x * 1.08, 1), h: Math.max(size.z * 1.08, 1) };
          controls.target.set(center.x, 0, center.z);
          camera.position.set(center.x, 200, center.z + 0.01);
          applyFrustum();
          controls.update();
          setErr("");
        },
        undefined,
        () => {
          if (active) setErr("PCD could not be loaded. Check the file path and format.");
        },
      );
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let downX = 0;
    let downY = 0;

    const handlePointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
      if (!pickCallbackRef.current && interactiveRef.current) {
        renderer.domElement.style.cursor = "grabbing";
      }
    };

    // A click (not a pan drag) on the ground selects a goal.
    const handlePointerUp = (event: PointerEvent) => {
      const callback = pickCallbackRef.current;
      if (!callback) {
        if (interactiveRef.current) renderer.domElement.style.cursor = "grab";
        return;
      }
      if (event.button !== 0 || !interactiveRef.current) return;
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 5) return;

      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;

      marker.position.set(hit.x, 0.4, hit.z);
      marker.visible = true;

      // Navigation Y is map +Y, i.e. scene -Z.
      callback({
        x: Number(hit.x.toFixed(2)),
        y: Number((-hit.z).toFixed(2)),
      });
    };
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    const resize = () => {
      if (!node.clientWidth || !node.clientHeight) return;
      renderer.setSize(node.clientWidth, node.clientHeight, false);
      applyFrustum();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();

    const render = () => {
      if (!active) return;

      // External zoom changes (slider / buttons).
      const wanted = zoomRef.current;
      if (wanted !== undefined && Math.abs(camera.zoom - wanted) > 0.001) {
        camera.zoom = THREE.MathUtils.clamp(wanted, MIN_ZOOM, MAX_ZOOM);
        camera.updateProjectionMatrix();
      }

      controls.update();

      // Orthographic points are sized in pixels: scale with the zoom.
      const pixelsPerUnit =
        (renderer.domElement.clientHeight / (camera.top - camera.bottom)) *
        camera.zoom;
      activeMaterial.size = Math.max(1.5, pointWorld * pixelsPerUnit);

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(render);
    };
    render();

    return () => {
      active = false;
      cancelAnimationFrame(animationId);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      controls.dispose();
      controlsRef.current = null;
      renderer.dispose();

      demoGeometry.dispose();
      demoMaterial.dispose();

      disposeObject(marker);
      disposeObject(robotGroup);
      scene.remove(marker, robotGroup);
      if (markerRef.current === marker) markerRef.current = null;
      if (robotRef.current === robotGroup) robotRef.current = null;

      if (loadedCloud) {
        scene.remove(loadedCloud);
        loadedCloud.geometry.dispose();
        const material = loadedCloud.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
      if (node.contains(renderer.domElement)) node.removeChild(renderer.domElement);
    };
  }, [fileUrl]);

  // Update the goal marker without recreating the renderer or camera.
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    if (
      !selectedPoint ||
      !Number.isFinite(selectedPoint.x) ||
      !Number.isFinite(selectedPoint.y)
    ) {
      marker.visible = false;
      return;
    }

    marker.position.set(selectedPoint.x, 0.4, -selectedPoint.y);
    marker.visible = true;
  }, [selectedPoint?.x, selectedPoint?.y]);

  // Update the robot pose.
  useEffect(() => {
    const group = robotRef.current;
    if (!group) return;
    if (!robot) {
      group.visible = false;
      return;
    }
    group.position.set(robot.x, 0.5, -robot.y);
    group.rotation.y = THREE.MathUtils.degToRad(robot.heading);
    group.visible = true;
  }, [robot?.x, robot?.y, robot?.heading]);

  return (
    <div className="pcd-host" ref={host}>
      {err && <div className="toast">{err}</div>}
    </div>
  );
}

type PipRect = { x: number; y: number; w: number; h: number } | null;

// Full-screen when active, otherwise sized/placed over the preview slot.
function layerStyle(isFull: boolean, pip: PipRect): CSSProperties {
  if (isFull || !pip) {
    return { left: 0, top: 0, width: "100%", height: "100%" };
  }
  return { left: pip.x, top: pip.y, width: pip.w, height: pip.h };
}

export default function App() {
  const [mode, setMode] = useState<Mode>("AUTO");
  // Like the reference, the dashboard opens on the map with the camera as
  // the small preview; clicking the preview swaps the two.
  const [view, setView] = useState<MainView>("map");

  // Mission reducer integration
  const [missionState, dispatch] = useReducer(
    missionReducer,
    initialMissionState,
  );

  const [goalMode, setGoalMode] = useState(false);
  const [notice, setNotice] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pcdUrl, setPcdUrl] = useState("");

  const [goalState, goalDispatch] = useReducer(goalReducer, initialGoalState);

  const [goalDraft, setGoalDraft] = useState<GoalDraft>({
    name: "Goal 1",
    x: 0,
    y: 0,
    heading: 0,
  });

  const [goalPositionSelected, setGoalPositionSelected] = useState(false);
  const [goalMapPoint, setGoalMapPoint] = useState<GroundPoint | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pcdRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const slotRef = useRef<HTMLButtonElement>(null);

  const [videoReady, setVideoReady] = useState(false);
  const [pip, setPip] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const paused = missionState.status === "PAUSED";
  const running = missionState.status === "RUNNING";

  const say = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const toggleView = () => {
    setView((v) => (v === "camera" ? "map" : "camera"));
  };

  // Mission controls
 
const initiateMission = () => {
  // 1. Resolve the currently selected goal
  const selectedGoal = goalState.goals.find(
    (goal) => goal.id === goalState.selectedGoalId
  );

  // 2. No valid selection: open QUICK GOAL
  if (!selectedGoal) {
    setGoalMode(true);
    say("Please select or create a goal first.");
    return;
  }

  // 3. Validate the selected goal coordinates
  if (
    !Number.isFinite(selectedGoal.x) ||
    !Number.isFinite(selectedGoal.y) ||
    !Number.isFinite(selectedGoal.heading)
  ) {
    say("Selected goal has invalid coordinates.");
    return;
  }

  // 4. Initiate mission with both IDs
  dispatch({
    type: "MISSION_INITIATE",
    missionId: "1234",
    targetGoalId: selectedGoal.id,
  });

  say(
    `SIMULATION: Mission initiated for ${selectedGoal.name}.`
  );
};


  const pauseMission = () => {
    dispatch({ type: "MISSION_PAUSE" });
    say("SIMULATION: Mission paused.");
  };

  const resumeMission = () => {
    dispatch({ type: "MISSION_RESUME" });
    say("SIMULATION: Mission resumed.");
  };

  const stopMission = () => {
    dispatch({ type: "MISSION_STOP" });
    say("SIMULATION: Mission stopped.");
  };

  const resetMission = () => {
    dispatch({ type: "MISSION_RESET" });
    say("Mission reset");
  };

  const emergency = () => {
    if (missionState.status === "RUNNING") {
      dispatch({ type: "MISSION_PAUSE" });
    }

    say("SIMULATION: Emergency stop requested. No robot is connected.");
  };

  const missionLabel = (() => {
    switch (missionState.status) {
      case "READY":
        return "Ready";
      case "RUNNING":
        return `On Mission ${missionState.missionId}`;
      case "PAUSED":
        return "Paused";
      case "STOPPED":
        return "Stopped";
      case "COMPLETED":
        return "Completed";
      case "ERROR":
        return "Mission Error";
      default:
        return "Ready";
    }
  })();

  const clearGoals = () => {
    goalDispatch({ type: "GOAL_CLEAR" });
    setGoalPositionSelected(false);
    setGoalMapPoint(null);
    setGoalDraft({
      name: "Goal 1",
      x: 0,
      y: 0,
      heading: 0,
    });
    say("Goals cleared.");
  };

  const saveGoal = () => {
    const name = goalDraft.name.trim();

    if (!name) {
      say("Please enter a goal name.");
      return;
    }

    if (!goalPositionSelected) {
      say("Please select a position on the map.");
      return;
    }

    if (
      !Number.isFinite(goalDraft.x) ||
      !Number.isFinite(goalDraft.y) ||
      !Number.isFinite(goalDraft.heading)
    ) {
      say("Enter valid numeric coordinates and heading.");
      return;
    }

    const goal: NavigationGoal = {
      id: crypto.randomUUID(),
      name,
      x: goalDraft.x,
      y: goalDraft.y,
      heading: goalDraft.heading,
      status: "PENDING",
      createdAt: Date.now(),
    };

    goalDispatch({
      type: "GOAL_ADD",
      goal,
    });

    setGoalMode(false);
    say(`Goal saved: ${goal.name}`);
  };

  const selectSavedGoal = (goal: NavigationGoal) => {
    goalDispatch({
      type: "GOAL_SELECT",
      goalId: goal.id,
    });

    setGoalDraft({
      name: goal.name,
      x: goal.x,
      y: goal.y,
      heading: goal.heading,
    });

    setGoalPositionSelected(true);
    setGoalMapPoint({ x: goal.x, y: goal.y });
    setGoalMode(true);
  };

  const deleteGoal = (goalId: string) => {
    goalDispatch({
      type: "GOAL_REMOVE",
      goalId,
    });

    say("Goal deleted.");
  };

  // The small preview is a normal element (so the existing responsive CSS
  // sizes it). Both views stay mounted and are moved between "full" and that
  // slot, which keeps the video playing and animates the swap.
  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    const slot = slotRef.current;
    if (!workspace || !slot) return;

    const measure = () => {
      const a = workspace.getBoundingClientRect();
      const b = slot.getBoundingClientRect();
      setPip({ x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(workspace);
    observer.observe(slot);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Stop the webcam when leaving the page.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const playLocalVideo = (file: File) => {
    const video = videoRef.current;
    if (!video) return;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    video.srcObject = null;
    video.src = URL.createObjectURL(file);
    video.play().catch(() => {});
  };

  const useWebcam = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      video.removeAttribute("src");
      video.srcObject = stream;
      await video.play();
      say("Live camera connected");
    } catch {
      say("Webcam unavailable or permission denied");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGoalMode(false);
        setNotice("");
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          ERIC<span>ROBOTICS</span>
        </div>

        <nav aria-label="Primary navigation">
          <button
            className="nav-btn active"
            title="Dashboard"
            onClick={() => say("Dashboard")}
          >
            <Grid2X2 />
          </button>

          <button className="nav-btn" title="Map" onClick={toggleView}>
            <Map />
          </button>

          <button
            className="nav-btn"
            title="Goals"
            onClick={() => setGoalMode(true)}
          >
            <MapPin />
          </button>

          <button
            className="nav-btn"
            title="Zones"
            onClick={() => say("Zones view is not connected yet")}
          >
            <Scan />
          </button>

          <button
            className="nav-btn"
            title="Robot"
            onClick={() => say("Robot telemetry is simulated")}
          >
            <Crosshair />
          </button>

          <button
            className="nav-btn"
            title="Analytics"
            onClick={() => say("Analytics view is not connected yet")}
          >
            <Activity />
          </button>
        </nav>

        <button
          className="nav-btn profile"
          title="Profile"
          onClick={() => say("Profile")}
        >
          <UserRound />
        </button>
      </aside>

      <section className="workspace" ref={workspaceRef}>
        {/* Camera layer: full screen when active, otherwise the preview */}
        <div
          className={`layer ${view === "camera" ? "full" : "pip"}`}
          style={layerStyle(view === "camera", pip)}
        >
          <video
            ref={videoRef}
            className="camera-feed"
            src="/assets/videos/camera-demo.mp4"
            autoPlay
            muted
            playsInline
            loop
            onLoadedData={() => setVideoReady(true)}
            onError={() => setVideoReady(false)}
          />

          {!videoReady && (
            <div className="camera-placeholder">
              <Video size={34} />
              <b>CAMERA FEED</b>
              <span>Add your assignment video to</span>
              <code>public/assets/videos/camera-demo.mp4</code>
              <span>or use the source buttons (top right).</span>
            </div>
          )}

          <div className="camera-shade" />
        </div>

        {/* Map layer: full screen when active, otherwise the preview */}
        <div
          className={`layer ${view === "map" ? "full" : "pip"}`}
          style={layerStyle(view === "map", pip)}
        >
          <PointCloudCanvas
            fileUrl={pcdUrl || DEFAULT_PCD}
            robot={ROBOT_POSE}
            interactive={view === "map"}
            zoom={zoom}
            onZoomChange={setZoom}
            selectedPoint={(() => {
              // During a mission, display its target. Otherwise preview the
              // currently selected saved goal on the dashboard map.
              const targetId =
                missionState.targetGoalId ?? goalState.selectedGoalId;
              const goal = goalState.goals.find((item) => item.id === targetId);
              return goal ? { x: goal.x, y: goal.y } : null;
            })()}
          />
        </div>

        {/* Mission status */}
        <div className="mission-pill glass">
          <span className="muted">Status</span>

          <b>{missionLabel}</b>

          {running && (
            <>
              <button
                className="pause-btn"
                title="Pause mission"
                onClick={pauseMission}
              >
                <Pause size={13} fill="currentColor" />
              </button>

              <button
                className="pause-btn"
                title="Stop mission"
                onClick={stopMission}
              >
                STOP
              </button>
            </>
          )}

          {paused && (
            <>
              <button
                className="pause-btn"
                title="Resume mission"
                onClick={resumeMission}
              >
                <Play size={13} fill="currentColor" />
              </button>

              <button
                className="pause-btn"
                title="Stop mission"
                onClick={stopMission}
              >
                STOP
              </button>
            </>
          )}

          {(missionState.status === "STOPPED" ||
            missionState.status === "COMPLETED" ||
            missionState.status === "ERROR") && (
            <button className="pause-btn" onClick={resetMission}>
              RESET
            </button>
          )}
        </div>

        <button className="quick-goal glass" onClick={() => setGoalMode(true)}>
          QUICK GOAL
          <span>
            <ArrowRight size={16} />
          </span>
        </button>

        {/* Telemetry */}
        <div className="telemetry glass">
          <span>
            <b>100%</b>
            <BatteryFull className="green" size={14} />
          </span>

          <i />

          <span>
            <Signal size={13} />
            <b>Strong</b>
          </span>

          <i />

          <span className="telemetry-label">
            Failsafe <b>Okay</b>
            <span className="dot green-dot" />
          </span>

          <i />

          <span className="telemetry-label">
            System <b>Okay</b>
            <span className="dot green-dot" />
          </span>
        </div>

        <div className="view-label" aria-live="polite">
          {view === "camera" ? "Camera View" : "Map View"}
        </div>

        {/* Toolbar */}
        <div className="toolbar-right">
          <div className="mode-switch glass">
            <span>MODE</span>

            {(["AUTO", "MANUAL"] as Mode[]).map((m) => (
              <button
                key={m}
                className={mode === m ? "selected" : ""}
                onClick={() => {
                  setMode(m);
                  say(`${m} mode selected (simulation)`);
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            className="initiate glass"
            disabled={running || paused}
            onClick={initiateMission}
          >
            INITIATE
            <span>
              <ArrowRight size={16} />
            </span>
          </button>
        </div>

        {/* Zoom rail + preview slot (always visible, as in the reference) */}
        <div className="map-overlay">
          <div className="zoom-rail">
            <button
              onClick={() => setZoom((z) => Math.min(2.8, Number((z + 0.2).toFixed(2))))}
              aria-label="Zoom in"
            >
              <ZoomIn size={13} />
            </button>

            <input
              aria-label="Map zoom"
              type="range"
              min=".6"
              max="2.8"
              step=".1"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />

            <button
              onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.2).toFixed(2))))}
              aria-label="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
          </div>

          <button
            ref={slotRef}
            className="pip-slot"
            onClick={toggleView}
            aria-label={
              view === "map" ? "Enter camera view" : "Enter map view"
            }
          >
            <span className="pip-tip">
              {view === "map"
                ? "Click to enter camera view"
                : "Click to enter map view"}
            </span>
          </button>
        </div>

        {/* Source tools: PCD for the map, video / webcam for the camera */}
        <div className="map-file-tools">
          {view === "map" ? (
            <div style={{marginTop: '10px'}}>
              <button onClick={() => pcdRef.current?.click()}>Load PCD</button>
              <span>Drag to pan · scroll to zoom · right-drag to rotate</span>
            </div>
          ) : (
            <div style={{marginTop: '25px', gap:'5px', display:'flex'}}>
              <button onClick={() => fileRef.current?.click()}>
                Choose video
              </button>
              <button onClick={useWebcam}>Use webcam</button>
            </div>
          )}

          <input
            ref={pcdRef}
            type="file"
            accept=".pcd"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setPcdUrl(URL.createObjectURL(f));
                say("PCD selected");
              }
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) playLocalVideo(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Robot controls */}
        <div className="right-controls">
          <button
            className="emergency"
            onClick={emergency}
            aria-label="Emergency stop"
          >
            <span className="emergency-word">EMERGENCY</span>

            <span className="emergency-core">
              <Route size={36} strokeWidth={3} />
            </span>

            <span className="stop-word">STOP</span>
          </button>

          <div
            className={`joystick ${mode === "AUTO" ? "auto-dim" : ""}`}
            aria-label="Robot directional controls"
          >
            <button
              className="joy north"
              disabled={mode !== "MANUAL"}
              onClick={() => say("Forward command simulated")}
              aria-label="Forward"
            >
              <ChevronUp />
            </button>

            <button
              className="joy south"
              disabled={mode !== "MANUAL"}
              onClick={() => say("Backward command simulated")}
              aria-label="Backward"
            >
              <ChevronDown />
            </button>

            <button
              className="joy west"
              disabled={mode !== "MANUAL"}
              onClick={() => say("Turn left command simulated")}
              aria-label="Left"
            >
              <ChevronLeft />
            </button>

            <button
              className="joy east"
              disabled={mode !== "MANUAL"}
              onClick={() => say("Turn right command simulated")}
              aria-label="Right"
            >
              <ChevronRight />
            </button>

            <div className="joy-center">
              W
              <br />
              <small>
                A&nbsp;&nbsp;●&nbsp;&nbsp;D
                <br />S
              </small>
            </div>
          </div>
        </div>

        {/* Bottom status */}
        <div className="bottom-status">
          <span className="live-dot" />
          <span>SIMULATION MODE</span>
          <span className="status-sep">|</span>
          <ShieldCheck size={12} />
          <span>No robot connected</span>
        </div>

        <button
          className="settings-btn"
          title="Settings"
          onClick={() => say("Settings")}
        >
          <Settings size={17} />
        </button>

        {/* Goal modal */}
        {goalMode && (
          <div className="modal-backdrop" onClick={() => setGoalMode(false)}>
            <section
              className="goal-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setGoalMode(false)}
                aria-label="Close goal modal"
              >
                <X size={18} />
              </button>

              <h2>Mission Goals</h2>

              <p>Select a demo position and save your navigation goal.</p>

              {/* Goal name */}
              <label>
                Goal name
                <input
                  type="text"
                  value={goalDraft.name}
                  onChange={(e) =>
                    setGoalDraft((previous) => ({
                      ...previous,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Enter goal name"
                />
              </label>

              {/* Interactive Three.js goal map */}
              <div
                className="goal-map goal-map-3d"
                aria-label="Interactive Three.js map. Click the ground to select a navigation goal."
              >
                <PointCloudCanvas
                  fileUrl={pcdUrl || DEFAULT_PCD}
                  robot={ROBOT_POSE}
                  selectedPoint={goalMapPoint}
                  onGroundPick={(point) => {
                    setGoalMapPoint(point);
                    setGoalDraft((previous) => ({
                      ...previous,
                      x: point.x,
                      y: point.y,
                    }));
                    setGoalPositionSelected(true);
                  }}
                />
                <div className="goal-map-hint">
                  <Crosshair size={14} />
                  Click map ground to set goal
                </div>
              </div>

              {/* Coordinates */}
              <div className="goal-coordinates">
                <label>
                  X
                  <input
                    type="number"
                    step="0.1"
                    value={goalDraft.x}
                    onChange={(e) => {
                      const value = e.target.valueAsNumber;
                      if (!Number.isFinite(value)) return;

                      setGoalDraft((previous) => ({
                        ...previous,
                        x: value,
                      }));

                      setGoalPositionSelected(true);
                    }}
                  />
                </label>

                <label>
                  Y
                  <input
                    type="number"
                    step="0.1"
                    value={goalDraft.y}
                    onChange={(e) => {
                      const value = e.target.valueAsNumber;
                      if (!Number.isFinite(value)) return;

                      setGoalDraft((previous) => ({
                        ...previous,
                        y: value,
                      }));

                      setGoalPositionSelected(true);
                    }}
                  />
                </label>

                <label>
                  Heading (°)
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="5"
                    value={goalDraft.heading}
                    onChange={(e) => {
                      const value = e.target.valueAsNumber;
                      if (!Number.isFinite(value)) return;
                      setGoalDraft((previous) => ({
                        ...previous,
                        heading: value,
                      }));
                    }}
                  />
                </label>
              </div>

              {/* Save */}
              <button className="primary-btn" onClick={saveGoal}>
                Save Goal <ArrowRight size={16} />
              </button>

              {/* Saved goals */}
              <div className="saved-goals">
                <div className="saved-goals-header">
                  <h3>Saved Goals ({goalState.goals.length})</h3>

                  {goalState.goals.length > 0 && (
                    <button onClick={clearGoals}>Clear all</button>
                  )}
                </div>

                {goalState.goals.length === 0 ? (
                  <p>No saved goals yet.</p>
                ) : (
                  goalState.goals.map((goal) => (
                    <div className="saved-goal-item" key={goal.id}>
                      <button
                        className="saved-goal-select"
                        onClick={() => selectSavedGoal(goal)}
                      >
                        <b>{goal.name}</b>

                        <span>
                          X: {goal.x} | Y: {goal.y}
                        </span>

                        <small>
                          Heading: {goal.heading}° · {goal.status}
                        </small>

                        {goalState.selectedGoalId === goal.id && (
                          <small>Selected</small>
                        )}
                      </button>

                      <button
                        onClick={() => deleteGoal(goal.id)}
                        aria-label={`Delete ${goal.name}`}
                        title="Delete goal"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {notice && (
          <div role="status" className="toast">
            {notice}
          </div>
        )}
      </section>
    </main>
  );
}
