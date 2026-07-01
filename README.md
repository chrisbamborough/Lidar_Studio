# LiDAR Studio

LiDAR Studio is a browser-based creative tool for turning Record3D iPhone/iPad LiDAR streams into real-time Three.js visuals.

The app opens in demo mode by default, so it is usable online without LiDAR hardware. When a Record3D device is available, enter the device URL or run the Vite proxy with `RECORD3D_PROXY_TARGET`.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`.

## Record3D

Direct connection:

```text
http://device-ip
```

Proxy connection:

```bash
RECORD3D_PROXY_TARGET=http://device-ip npm run dev
```

Then enable `Use /webrtc proxy` in the app.

## Current Visual Modes

- `Points`: live or synthetic point cloud.
- `Trails`: agent trails seeded from LiDAR/demo points.
- `Points + Trails`: hybrid view for performance tuning and visual composition.

## Direction

This is intended to become one stable online app with internal creative modes, not a collection of separate sketches. New experiments should usually land as source modules, render layers, controls, or presets inside this app.
