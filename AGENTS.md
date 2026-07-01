# LiDAR Studio

## Agent Startup

Read these files before making project changes:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/NEXT_STEPS.md`
3. `docs/DECISIONS.md`
4. `docs/ROADMAP.md`

## Project Overview

This is a standalone Vite app for browser-based, real-time LiDAR visuals using Record3D video/depth data and Three.js. The app must remain usable online without hardware through demo mode.

## Key Commands

- `npm run dev` - start the local app
- `npm run build` - build production assets
- `npm run preview` - preview production build
- `RECORD3D_PROXY_TARGET=http://device-ip npm run dev` - enable the `/webrtc` development proxy

## Conventions

- Keep one primary app at the project root.
- Add creative functionality as internal modes, render layers, utilities, or presets.
- Preserve demo mode whenever adding live LiDAR features.
- Avoid hardcoded Record3D IP addresses.
- Prefer Three.js for point clouds, trails, mesh surfaces, and post-processing.
- Keep controls practical and performance-aware.
