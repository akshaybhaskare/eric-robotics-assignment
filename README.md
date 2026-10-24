
# ERIC Insight.IO Dashboard — starter implementation

Candidate Details
**Full Name:** Akshay Vijay Bhaskare  
**Contact Number:** 9172684018  
**Email ID:** akshaybhaskare1996@gmail.com

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

## How the dashboard behaves (matches the reference GIF)

- Opens on **Map View**; the **Camera View** is the small preview at bottom-left.
- **Click the preview** to swap the two views (animated). The top label switches between *Map View* and *Camera View*, and hovering the preview shows *Click to enter ... view*.
- The vertical **zoom rail** next to the preview controls the map zoom in both states.
- Map: top-down 3D point cloud. **Drag to pan** (hand cursor), **scroll / pinch to zoom**, **right-drag to rotate/tilt**. A simulated robot marker is drawn on the map.
- Camera: plays a local video file, or a live webcam feed (*Choose video* / *Use webcam*, top right, while in Camera View).
- **Quick Goal** opens the goal modal with the same map; click the ground to place a goal, then **Initiate** starts a (simulated) mission.

## Assets (all local, no internet needed after `npm install`)

| File | Purpose |
|------|---------|
| `public/assets/maps/warehouse.pcd` | Sample map (binary PCD with `rgb`). Loaded by default. |
| `public/assets/videos/camera-demo.mp4` | **Add your assignment video here.** Until then the camera panel shows instructions and the webcam / file options still work. |

- Use **Load PCD** (Map View) to open any `.pcd`. Z-up clouds (KITTI, PCL, etc.) are rotated to a top-down view automatically; clouds without colour are drawn dark, clouds with an `rgb` field keep their colours.
- Regenerate the sample map with `python3 scripts/generate_sample_map.py` (needs numpy).

## Architecture notes

- Both views stay mounted and are moved between *full* and *preview* with CSS, so the video keeps playing and the WebGL context is not recreated on swap.
- `PointCloudCanvas` uses an orthographic top-down camera with `OrbitControls` configured for map-style pan; zoom state is shared with the slider.
- Navigation goals use map coordinates (X right, Y up, metres), the same frame as the PCD.
- Mission and goal state live in reducers under `src/features/`.

## Not yet connected

- ROS integration (the bonus): replace the static PCD with a `sensor_msgs/PointCloud2` subscription via `roslibjs` / rosbridge and feed it into `PointCloudCanvas`.
- Real telemetry, mission API and robot pose (the pose in `ROBOT_POSE` is simulated).

## Safety

All mission, drive and emergency-stop actions are **UI simulation only**. No robot is connected and no safety-rated stop or motion control is implemented. Never connect real hardware without approved command authorization, interlocks, watchdogs and safety review.
