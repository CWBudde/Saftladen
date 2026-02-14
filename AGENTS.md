# AGENTS.md

This file provides guidance to AI Agents (Claude Code, Codex etc.) when working with code in this repository.

## Project Overview

A Fruit Ninja-style browser game built with React + TypeScript + Vite, using Bun as the package manager. This is currently a scaffold in early development (Phase 0 complete, implementing Phase 1+).

**Key architectural principle:** React is for UI/overlay state only (menus, HUD, settings). Game simulation and rendering run imperatively via `requestAnimationFrame` with a fixed timestep loop.

## Development Commands

**Prerequisites:** Bun >= 1.0

```bash
# Install dependencies
bun install

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

# Enable debug mode (overlays, instrumentation)
VITE_DEBUG=1 bun dev
```

## Architecture

### Game Layer Structure (`src/game/`)

The game code is organized into clear, single-responsibility folders:

- **`core/`** - Runtime loop primitives (`requestAnimationFrame`, canvas lifecycle)
- **`engine/`** - Deterministic simulation lifecycle, game state transitions, fixed timestep logic
- **`systems/`** - Pure simulation systems (spawning, physics, slicing, scoring, particles)
- **`model/`** - Domain types and factories for entities/world state
- **`render/`** - Canvas renderer implementations and draw helpers
- **`input/`** - Pointer/touch trail capture, coordinate conversion
- **`ui/`** - React-facing adapter helpers for HUD/menu state
- **`assets/`** - Game asset manifests and loading metadata

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

- **Phase 0 (Complete):** Project scaffold, folder structure, debug flag convention
- **Phase 1 (In Progress):** Fixed timestep engine, game state management, deterministic simulation

Refer to [`PLAN.md`](PLAN.md) for the complete 13-phase implementation roadmap. When working on a task from this plan, mark it as done when complete.

### Game Loop Architecture

The game uses a `requestAnimationFrame`-based loop ([`src/game/core/gameLoop.ts`](src/game/core/gameLoop.ts)) that:
- Caps delta time at 100ms to prevent spiral of death on tab switches
- Tracks frame count, timestamps, and elapsed time
- Will be extended with a fixed-timestep accumulator in Phase 1

### Coordinate Systems

- Canvas uses `devicePixelRatio` for HiDPI displays
- Pointer events must be converted to canvas-local CSS coordinates
- World-space mapping may be introduced for virtual resolution (Phase 2)

## Development Workflow

### Debug Mode

Use `VITE_DEBUG=1` during development to enable debug features. The shared check is `isGameDebugEnabled()` in [`src/game/debug.ts`](src/game/debug.ts).

### TypeScript Configuration

Project uses TypeScript composite projects with project references:
- [`tsconfig.app.json`](tsconfig.app.json) - Main application code
- [`tsconfig.node.json`](tsconfig.node.json) - Vite config and Node.js tooling

### Implementation Phases

When working on new features, consult [`PLAN.md`](PLAN.md) to:
1. Understand which phase the work belongs to
2. Check dependencies on previous phases
3. Follow the established acceptance criteria
4. Maintain consistency with the planned architecture

Key upcoming milestones:
- Phase 1: Engine core with fixed timestep
- Phase 2: Canvas stage and coordinate mapping
- Phase 3: Input system with multi-touch trails
- Phase 4: Entity spawning (fruits, bombs, powerups)
- Phase 5: Collision detection and slicing

## Testing Strategy

(To be implemented in Phase 12)

Planned test coverage:
- Unit tests with Vitest for core game logic (collision, scoring, spawning)
- React Testing Library for UI flows
- Optional E2E smoke tests with Playwright

## Performance Considerations

- Target 60 FPS with fixed timestep simulation (16.67ms or 8.33ms steps)
- Canvas2D initially, with optional WebGL/Pixi upgrade path later
- Object pooling for particles and trail points to reduce GC pressure
- HiDPI scaling handled in canvas layer
