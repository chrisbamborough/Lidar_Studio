# Next Steps

## Priority 1: Productize The App

- Keep the root app usable in demo mode.
- Add deployment notes for static hosting.
- Add a preset system for saving and sharing visual states.

## Priority 2: Modularize The Engine

- Move Record3D connection logic into `src/sources/record3d-source.js`.
- Move demo frame generation into `src/sources/demo-source.js`.
- Move point projection/coloring into `src/lidar/`.
- Move point-cloud and agent-trail rendering into `src/render/`.

## Priority 3: Agent Trails

- Tune default trail settings for live Record3D input.
- Add trail color strategies independent of the point-cloud color mode.
- Explore ribbon or shader trails after the line-segment version feels stable.

## Priority 4: Mesh Surfaces

- Add a mesh mode that builds a downsampled grid from the depth map.
- Skip triangles across large depth discontinuities.
- Add surface material modes: wire, translucent, depth gradient, camera texture.

## Priority 5: Online Project Hygiene

- Add `CONTRIBUTING.md`.
- Add issue templates for render layers, sources, and presets.
- Add a `LICENSE` before publishing publicly.
