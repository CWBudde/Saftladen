# AGENTS.md

This file provides guidance to AI Agents (Claude Code, Codex etc.) when working with code in this repository.

## Project Overview

A playable Fruit Ninja-style browser game built with React + TypeScript + Vite,
using Bun as the package manager. Classic, Arcade and Zen, onboarding, scoring,
audio, saved progression/equipment and deliberate offline updates are implemented.
Physical-device input, listening, performance and human balance QA remain pending.

**Key architectural principle:** React is for UI/overlay state only (menus, HUD, settings). Game simulation and rendering run imperatively via `requestAnimationFrame` with a fixed timestep loop.

## Development Commands

**Prerequisites:** Bun >= 1.3.10 (CI pins `.bun-version`) and Node.js 20.19+
or 22.12+ for Vite. Node 18 is unsupported.

```bash
# Install dependencies
bun install --frozen-lockfile

# Start development server (http://localhost:5173)
bun dev

# Run TypeScript type checking in watch mode
bun run dev:types

# Production build
bun run build

# Preview production build locally
bun run preview

# Lint with ESLint
bun run lint

# Bun unit tests
bun run test

# Production browser suite (build first; install Chromium once)
bunx playwright install chromium
bun run test:browser

# Separate native-RAF renderer benchmark
bun run profile:render

# Generate local WAVs/listening page
bun run audio:preview

# Enable debug mode (overlays, instrumentation)
VITE_DEBUG=1 bun dev
```

## Architecture

### Game Layer Structure (`src/game/`)

The game code is organized into clear, single-responsibility folders:

- **`core/`** - Runtime loop primitives (`requestAnimationFrame`, canvas lifecycle)
- **`engine/`** - Deterministic simulation lifecycle, game state transitions, fixed timestep logic
- **`systems/`** - Deterministic simulation systems that mutate engine-owned state in place (spawning, physics, slicing, scoring, particles)
- **`model/`** - Domain types and factories for entities/world state
- **`render/`** - Canvas renderer implementations and draw helpers
- **`input/`** - Pointer/touch trail capture, coordinate conversion
- **`ui/`** - React UI/snapshot adapters, saved rewards/settings/equipment and PWA updates
- **`assets/`** - Game asset manifests and loading metadata
- **`audio/`** - Layered sound generation, playback, voice limits and music mixing

See [`src/game/README.md`](src/game/README.md) for detailed architecture notes.

### React Boundary Rules

**React components CAN:**
- Mount/unmount the game canvas
- Display HUD/menu/settings state snapshots
- Dispatch high-level commands (`start`, `pause`, `resume`, `reset`)

**React components MUST NOT:**
- Run simulation steps
- Mutate world state directly
- Perform per-frame entity rendering logic

### Current Implementation Status

Use [`PLAN.md`](PLAN.md)'s execution queue and active unchecked items for the next
work. Phase numbers are reference IDs, not execution order; the completed history
is archived separately. Mark tasks done only after implementation and relevant
checks pass. Keep physical QA open until device/browser evidence is recorded.

### Game Loop Architecture

[`gameCanvasController.ts`](src/game/core/gameCanvasController.ts) owns the canvas,
input, RAF loop and rendering. `GameCanvasLayer` mounts/disposes that controller.
[`gameLoop.ts`](src/game/core/gameLoop.ts) caps frame delta at 100ms; the headless
[`gameEngine.ts`](src/game/engine/gameEngine.ts) owns the 60Hz fixed-step accumulator,
100ms advance clamp and 12-step cap. Backgrounding pauses the run until explicit
resume. Fresh input is consumed once; visual trails cannot slice.

Systems mutate nested state; `getState()`/state subscriptions are borrowed views,
not immutable snapshots. React copies UI values through the snapshot selector.
Gameplay event batches are copied/frozen and retain ordered catch-up events.
Gameplay and cosmetic RNG/IDs are independent. See the
[`systems` contract](src/game/systems/README.md#system-contracts) before changing order.

### Coordinate Systems

- Canvas uses `devicePixelRatio` for HiDPI backing dimensions.
- Pointer events map through cached canvas-local CSS coordinates into world units.
- The viewport's shorter edge is 720 world units; one uniform input/render scale
  preserves circular geometry in portrait and landscape.
- Resize uses `engine.setWorldBounds`, preserving live/pending launches and clocks
  while discarding stale input. Headless engines default to 1280×720.

## Development Workflow

### Debug Mode

`VITE_DEBUG=1` sets the initial debug overlay through `isGameDebugEnabled()` in
[`src/game/debug.ts`](src/game/debug.ts). `D` toggles it at runtime, including
production. The flag does not remove instrumentation from the bundle.
`VITE_ANALYTICS` has no implemented behavior; analytics remains optional backlog.

### TypeScript Configuration

Project uses TypeScript composite projects with project references:
- [`tsconfig.app.json`](tsconfig.app.json) - Main application code
- [`tsconfig.node.json`](tsconfig.node.json) - Vite config and Node.js tooling
- [`tsconfig.browser.json`](tsconfig.browser.json) - Playwright tests/configs

### Implementation Phases

When working on new features, consult [`PLAN.md`](PLAN.md) to:
1. Understand which phase the work belongs to
2. Check dependencies on previous phases
3. Follow the established acceptance criteria
4. Maintain consistency with the planned architecture

Treat the execution queue as authoritative. Shared acceptance work may span
phases; avoid duplicate implementations or reopening completed architecture.

## Testing Strategy

`bun run test` uses Bun's built-in runner for input/lifecycle, geometry, scoring,
pressure, events, rendering, audio, rewards and storage regressions. Vitest/RTL
are optional tooling, not current dependencies.

`bun run build` typechecks application/tooling and builds the actual deployment.
`bun run test:browser` typechecks browser tooling and runs production Chromium
flows through public UI/canvas APIs. Ordinary tests block service workers; five
offline/update cases use real workers and tooling-only failed-download fixtures.
Do not add game/React-state injection hooks to the deployed application.

CI runs frozen install, lint, unit tests, build and browser checks for main PRs
and pushes. Eligible non-PR builds deploy `dist` to GitHub Pages at `/Saftladen/`.
Generated listening/benchmark bundles, reports and browser artifacts stay ignored
and outside deployment. See [`docs/PWA.md`](docs/PWA.md) for cache/update behavior.

## Performance Considerations

- Target 60 FPS with 16.67ms fixed simulation steps; Canvas2D is the current renderer.
- Static boards are cached; particle/trail pooling and device quality tiers remain backlog.
- Measure before further optimization. [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md)
  records the host benchmark, repeat variance, DPR cache memory cost and physical QA protocol.
- Renderer timing does not establish physical touch latency, long-session memory
  or human difficulty. Preserve scoring/spawn determinism across cosmetic changes.
