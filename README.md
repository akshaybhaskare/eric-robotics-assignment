# ERIC Insight.IO Dashboard — starter implementation

Responsive React + TypeScript + Vite recreation based on the supplied reference screenshot.

## Run locally

Requirements: Node.js 20+ recommended.

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
npm run preview
```

## Assets

- Place the provided camera recording at `public/assets/videos/camera-demo.mp4`.
- The Camera View has a local-file picker for temporary preview.
- Switch to **Map View**, then use **Load PCD** to select a local `.pcd` point cloud.

Until a source PCD is loaded, Map View shows a clearly illustrative generated point cloud. The small map in Camera View is also a placeholder graphic and is not original facility data.

## Implemented in this starter

- Responsive dashboard shell, reference-inspired layout and dark navigation rail.
- Mission status / pause-resume UI state.
- Auto/manual mode selector.
- Quick Goal modal and simulated goal selection.
- Initiate and emergency stop demo states (no real robot connection).
- Interactive camera/map view switching.
- Video file selection.
- Three.js point-cloud viewer, OrbitControls, PCD file selection and resize handling.
- Map zoom slider, responsive layout rules, keyboard escape for modal.

## Not yet connected / required before final submission

- Official assignment video, map/PCD and brand assets.
- Exact map geometry, robot pose, telemetry source, mission API and ROS bridge (if needed).
- Validate all controls and visuals against the full reference GIF/demo.
- Browser/device test pass and final screenshots.

## Safety

All mission, drive and emergency-stop actions are **UI simulation only**. No robot is connected and no safety-rated stop or motion control is implemented. Never connect real hardware without approved command authorization, interlocks, watchdogs and safety review.
