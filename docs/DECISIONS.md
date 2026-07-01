# Decisions

## One App

LiDAR Studio is one user-facing web app. Creative experiments should usually become render layers, modes, controls, or presets inside this app rather than separate sketches.

## Demo Mode Is Required

The app must remain usable without Record3D hardware. Demo mode is the default source and should continue to exercise the same render layers used by live LiDAR input.

## Record3D Frame Interpretation

Current live input interprets the incoming Record3D video frame as two horizontal halves:

- left half: HSV hue encodes depth
- right half: RGB camera image provides color

Do not replace this with binary data-channel parsing unless that is a deliberate implementation task.

## Configuration

Do not hardcode a local Record3D IP address in app defaults. Use direct user input or the `RECORD3D_PROXY_TARGET` development environment variable.

## Rendering Direction

Use Three.js render layers for the core visual system:

- point cloud
- agent trails
- mesh surfaces
- post-processing

Keep layers composable so presets can combine them over time.
