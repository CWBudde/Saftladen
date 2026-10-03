# Saftladen

A Fruit Ninja-style browser game built with React + TypeScript + Vite.
Current state: playable prototype with engine-driven canvas simulation and React UI overlays.

**[Play online](https://cwbudde.github.io/Saftladen/)**

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
- `bun run test` - run input/gameplay, event, rendering, reward/storage, and audio regressions
- `bun run test:browser` - run the browser smoke suite against a production build

For browser checks, install Chromium once with `bunx playwright install chromium`,
then run `bun run build` and `bun run test:browser`. The suite covers loading,
game modes, pause/resume, results/replay and compact-screen dialogs. CI runs
these checks before deployment.

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

The playfield adapts to portrait and landscape with a uniform scale: its shorter
edge is 720 world units. Rendering, pointer mapping and circular hit areas share
that scale. Resizing preserves live and queued launches, clears pending swipes,
and keeps the current run and timer.

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
      viewport.ts
    engine/
      gameEngine.ts
      phaseMachine.ts
      rng.ts
      resizeWorld.ts
    input/
      coordinates.ts
      trailTracker.ts
    model/
      entityId.ts
      entities.ts
    render/
      renderer.ts
      debugDraw.ts
      renderHelpers.ts
    systems/
      applySystems.ts
      systemContext.ts
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
      sfxMix.ts
      voicePool.ts
    ui/
      viewModel.ts
      useGameUiState.ts
      rewards.ts
      GameDialog.tsx
      SettingsControls.tsx
      GameHud.tsx
      eventFeedback.ts
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
The HUD displays score, lives or time, the current timed streak, and power-up
remaining durations. Results include fruit sliced, misses, bomb hits, and peak
streak. A streak is a chain of cuts within 320ms; same-gesture combos remain on
the roadmap.

Rewards require a completed run lasting at least five seconds, at least one
fruit sliced, and a positive score. Flawless bonuses require zero misses and zero
bomb hits in every mode. Recent run IDs prevent duplicate payouts; versioned
storage migrates existing profiles/preferences and validates fields independently.
Cosmetics are currently unlock previews; equipping them remains on the roadmap.

Before the first run, the menu loads and decodes the required gameplay and title
artwork. Failed or timed-out images keep play disabled until you retry or choose
**Play with simple artwork**. Successful images are retained during retries;
music continues to load on demand.

## Release Checks

Pull requests run lint, unit and browser regression tests, and a production build. Passing builds
on `main` deploy to GitHub Pages under `/Saftladen/`. Gameplay artwork is
precached for offline reload; music is cached after its first requested playback.
Run `bun run preview` to check the production build locally.

See `PLAN.md` for the remaining gameplay, presentation, progression, and QA work.
