# Game Layer Architecture

This folder contains all non-React game code for the Fruit Ninja clone.
React should only mount the canvas, render overlay UI, and forward user intents to the game API.

## Folder Roles

- `core/`: runtime loop primitives and stage integration (`requestAnimationFrame`, canvas mount lifecycle).
- `engine/`: deterministic simulation lifecycle and game state transitions.
- `systems/`: pure simulation systems (spawning, physics, slicing, scoring, particles).
- `model/`: shared domain types and factories for entities/world state.
- `render/`: canvas renderer implementations and draw helpers.
- `input/`: pointer/touch trail capture and coordinate conversion.
- `ui/`: React-facing adapter helpers for HUD/menu state.
- `assets/`: game asset manifests and loading metadata.

## React Boundary

React components can:
- mount/unmount the game canvas
- display HUD/menu/settings state snapshots
- dispatch high-level commands (`start`, `pause`, `resume`, `reset`)

React components must not:
- run simulation steps
- mutate world state directly
- perform per-frame entity rendering logic

## Debug Flag Convention

Use `VITE_DEBUG=1` to enable debug-only overlays/instrumentation in later phases.
Phase 0 exposes `isGameDebugEnabled()` in `src/game/debug.ts` as the shared check.
