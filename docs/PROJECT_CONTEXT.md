# Project Context

## Purpose

LiDAR Studio is a single browser app for creative LiDAR visualization. It uses Record3D WebRTC video streams, demo-generated depth/color frames, and Three.js render layers to create real-time visuals that can run online.

The project is intentionally app-first: experiments should become modes, presets, or reusable render layers inside the same user-facing application.

## Current Implementation

The app is a Vite project with one root `index.html` and a main source entry at `src/main.js`.

Runtime dependencies:

- `three` for WebGL rendering, point clouds, orbit controls, and agent trail lines.
- Browser WebRTC APIs for Record3D streaming.
- Browser Canvas APIs for sampling incoming video frames.

## Record3D Data Flow

The app connects to Record3D Wi-Fi streaming with:

- `GET /metadata`
- `GET /getOffer`
- `POST /answer`

The browser creates an `RTCPeerConnection`, accepts the Record3D offer, creates an answer, posts the SDP answer back to the device, and receives a video stream.

Current frame interpretation:

- left half: depth encoded as HSV hue
- right half: RGB camera color

Depth is approximated as:

```js
z = hue * depthRange;
```

The app also has a synthetic demo source that generates animated depth/color points without requiring Record3D hardware.

## Render Layers

### Point Cloud

The point cloud layer projects depth pixels into 3D positions and writes per-point colors from camera, depth, height, rainbow, or mono modes.

### Agent Trails

The agent trail layer seeds lightweight agents from the current point cloud. Agents inherit point color, move through a procedural flow field, and write fading line segments into a ring buffer. This makes the scene feel temporal without storing full point-cloud frames.

## Current Rough Edges

- Source, projection, point rendering, and trails currently live in `src/main.js`; these should be split into modules as the app grows.
- Agent trails are line-segment based. Future versions may use custom shaders or tube/ribbon geometry for richer trails.
- Record3D support still uses HSV video-frame decoding, not binary depth/data-channel parsing.
- There is no preset system yet.
