# Saftladen

A Fruit Ninja-style browser game built with React + TypeScript + Vite.
Current state: playable prototype with engine-driven canvas simulation and React UI overlays.

## Stack

- Bun (package manager and scripts)
- Vite
- React
- TypeScript
- ESLint

## Requirements

- Bun `>= 1.3.10` (CI version is pinned in `.bun-version`)
- Node.js `20.19+` or `22.12+` for Vite (Node 18 is unsupported)

## Quick Start

```bash
bun install --frozen-lockfile
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
- `bun run test` - run the deterministic input/gameplay and audio regressions

## Debug Mode Toggle

Use `VITE_DEBUG=1` during development to enable debug overlays and instrumentation as systems are added:

```bash
VITE_DEBUG=1 bun dev
```

The shared flag check lives in `src/game/debug.ts`.

## Dev Controls

- Drag on canvas: slice fruit (multi-touch supported on touch devices)
- `Space`: pause/resume run
- `D`: toggle debug overlay at runtime
- `Esc`: pause/resume run or close the current dialog
- Backgrounding the page pauses automatically; resume explicitly

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
      gameCanvasController.ts
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
      modeSystem.ts
    audio/
      audioService.ts
      tone.ts
    ui/
      viewModel.ts
      useGameUiState.ts
      rewards.ts
      GameDialog.tsx
      SettingsControls.tsx
    debug.ts
    index.ts
    types.ts
  App.tsx
  main.tsx
```

Architecture and React/game boundary notes are documented in `src/game/README.md`.

## Modes and Settings

Classic ends on a bomb or three missed fruit. Arcade lasts 60 seconds with
power-ups and bomb score penalties. Zen is a bomb-free 90-second session.
Profile and pause dialogs offer audio, sensitivity, and reduced-motion settings.
Cosmetics are currently unlock previews; equipping them remains on the roadmap.

## Release Checks

Pull requests run lint, regression tests, and a production build. Passing builds
on `main` deploy to GitHub Pages under `/Saftladen/`. Gameplay artwork is
precached for offline reload; music is cached after its first requested playback.
Run `bun run preview` to check the production build locally.

See `PLAN.md` for the remaining gameplay, presentation, progression, and QA work.
