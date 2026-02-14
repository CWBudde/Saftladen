# Saftladen

A Fruit Ninja-style browser game built with React + TypeScript + Vite.

## Stack

- Bun (package manager and scripts)
- Vite
- React
- TypeScript
- ESLint

## Requirements

- Bun `>= 1.0`

## Quick Start

```bash
bun install
bun dev
```

Open `http://localhost:5173`.

## Tooling Decision (Phase 0)

The project keeps Vite scripts in `package.json` (`"dev": "vite"` and friends) and runs them through Bun (`bun dev`, `bun run ...`).
We are not switching to `bunx --bun vite` right now because the direct script form is simpler and already works consistently.

## Scripts

- `bun dev` - start the Vite dev server
- `bun run dev:types` - run TypeScript project builds in watch mode
- `bun run build` - type-check and create a production build
- `bun run preview` - preview the production build locally
- `bun run lint` - run ESLint

## Debug Mode Toggle

Use `VITE_DEBUG=1` during development to enable debug overlays and instrumentation as systems are added:

```bash
VITE_DEBUG=1 bun dev
```

The shared flag check lives in `src/game/debug.ts`.

## Dev Controls

- Drag on canvas: draw pointer trails (multi-touch supported on touch devices)
- `Space`: pause/resume run
- `R`: reset run
- `D`: toggle debug overlay at runtime

## Input Notes

The canvas sets `touch-action: none` in `src/App.css` so pointer events are not interrupted by browser pan/zoom gestures while playing.
Trade-off: while interacting over the canvas area, page scrolling and zoom gestures are intentionally suppressed.

## Current Project Structure

```text
src/
  game/
    README.md
    assets/
      manifest.ts
      preload.ts
      index.ts
    core/
      gameLoop.ts
      GameCanvasLayer.tsx
      canvasStage.ts
    engine/
      gameEngine.ts
      phaseMachine.ts
      rng.ts
    input/
      coordinates.ts
      trailTracker.ts
    model/
      entityId.ts
      entities.ts
    render/
      renderer.ts
      placeholderRenderer.ts
      debugDraw.ts
    systems/
      applySystems.ts
      collision.ts
      constants.ts
      sliceDetectSystem.ts
      sliceResolveSystem.ts
      spawnSystem.ts
      physicsSystem.ts
      despawnSystem.ts
    ui/
    debug.ts
    index.ts
    types.ts
  App.tsx
  main.tsx
```

Architecture and React/game boundary notes are documented in `src/game/README.md`.

## Next Implementation Milestones

1. Build React HUD/menus around live engine state (Phase 8)
2. Add audio service + SFX/music controls (Phase 9)
3. Add tests for collision, scoring, and spawn constraints (Phase 12)
4. Add deployment/release wiring and feature flags (Phase 13)
