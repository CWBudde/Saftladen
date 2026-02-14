# Implementation Plan (Fruit Ninja–Style Game)

This plan turns the requirements and recommendations from `goal.md` into an executable, phase-based TODO roadmap for the current React + TypeScript + Vite (Bun) scaffold.

Guiding principles (from `goal.md`):
- React is used for UI/overlay state only (menus/HUD/settings).
- The game simulation + rendering run imperatively (requestAnimationFrame + fixed timestep).
- Start with Canvas2D; treat WebGL/Pixi as an optional later upgrade.
- Use original assets/branding (do not copy Fruit Ninja assets or UI).

Conventions used in this plan:
- Each phase has a clear deliverable and acceptance checks.
- Tasks are bite-sized and written as checkboxes.
- Items marked **(Optional)** are explicitly out of MVP scope.

---

## Phase 0 — Baseline & Project Hygiene

**Goal:** Make the scaffold predictable to work in and easy to iterate on.

**Deliverable:** Clean local dev workflow, consistent conventions, and a clear folder strategy.

### TODO
- [x] Confirm runtime/tooling expectations
  - [x] Verify `bun install`, `bun dev`, `bun run build`, `bun run lint` work locally
  - [x] Decide whether to keep scripts as-is or switch to the `bunx --bun vite` approach mentioned in `goal.md`
  - [x] Document the chosen approach in README
- [x] Establish code organization rules for the game layer
  - [x] Decide on final high-level folders under `src/game/` (e.g. `core/`, `engine/`, `systems/`, `render/`, `model/`, `assets/`)
  - [x] Define the “React boundary”: what can/can’t live inside React components
  - [x] Add a short `src/game/README.md` explaining architecture (one screen of text)
- [x] Add developer ergonomics
  - [x] Add a `dev:types` script if you want `tsc -b --watch` while working (optional)
  - [x] Add a minimal “debug mode” toggle (`VITE_DEBUG=1`) plan for later phases

### Acceptance
- Build, lint, preview all run without manual steps.
- Team members can understand where new game code should go.

---

## Phase 1 — Engine Core (Game State + Fixed Timestep)

**Goal:** Turn the existing RAF loop into a game-ready loop with deterministic simulation timing and explicit game state.

**Deliverable:** A headless engine update pipeline that can run without rendering.

### TODO
- [x] Define core engine types
  - [x] Expand `src/game/types.ts` beyond `GamePhase` to include core state types (world, settings, score)
  - [x] Define entity IDs and a consistent coordinate space (world vs screen)
  - [x] Define “time scaling” support (normal vs freeze/slow motion)
- [x] Implement fixed-timestep stepping
  - [x] Keep `createGameLoop` but add an engine stepper with accumulator (`fixedDtMs`, `accumulatorMs`)
  - [x] Clamp extreme deltas (already clamped to 100ms) and document why
  - [x] Decide on a fixed step (e.g. 8.33ms = 120Hz or 16.67ms = 60Hz)
- [x] Add engine lifecycle controls
  - [x] Implement `start`, `pause`, `resume`, `stop`, `reset`
  - [x] Ensure `pause` stops simulation updates but still allows rendering/UI if desired
  - [x] Add a single source of truth for `GamePhase` transitions
- [x] Add deterministic randomness (recommended)
  - [x] Add a seeded RNG utility for spawn patterns (so tuning is reproducible)
  - [x] Decide how/when to re-seed (new run vs mode switch)

### Acceptance
- Simulation runs at a consistent rate on fast/slow devices.
- Engine can be stepped without Canvas drawing (for future tests).

---

## Phase 2 — Canvas Stage, Coordinate Mapping, and Debug Draw

**Goal:** Make rendering reliable across resolutions and inputs.

**Deliverable:** A stable Canvas “stage” with correct HiDPI scaling and coordinate mapping from pointer events.

### TODO
- [x] Harden canvas sizing and scaling
  - [x] Keep the current devicePixelRatio approach in `GameCanvasLayer`
  - [x] Ensure `ctx.setTransform(...)` usage yields correct CSS pixel coordinates
  - [x] Add a central helper to compute `{ widthCssPx, heightCssPx, dpr }`
- [x] Add coordinate conversion helpers
  - [x] Add a function to convert `PointerEvent` → canvas-local CSS coordinates
  - [x] Add optional world-space mapping if you introduce a virtual resolution
- [x] Implement debug overlay hooks (no gameplay yet)
  - [x] Add `debugDraw` helpers (FPS counter, bounding circles, trail lines)
  - [x] Make debug rendering toggleable (env var or a key)
- [x] Replace placeholder render with a renderer interface
  - [x] Create a `Renderer` interface: `render(ctx, state, frameInfo)`
  - [x] Keep the placeholder scene as the initial implementation but move it behind the renderer

### Acceptance
- Canvas looks crisp on HiDPI displays.
- Pointer coordinate mapping matches what you see on screen.

---

## Phase 3 — Input System (Pointer Events + Multi-Touch Trails)

**Goal:** Build the core “slice trail” input that works on mouse + touch + multi-touch.

**Deliverable:** Multiple simultaneous trails drawn on canvas, with reliable capture and time-windowed points.

### TODO
- [x] Add Pointer Events wiring to the canvas
  - [x] `pointerdown` starts a trail per `pointerId`
  - [x] `pointermove` appends points (ring buffer)
  - [x] `pointerup`/`pointercancel` ends the trail
  - [x] Use `setPointerCapture(pointerId)` on down
- [ ] Add CSS to prevent browser gesture interference
  - [x] Apply `touch-action: none;` to the canvas region (and document the trade-offs)
  - [ ] Validate scroll/zoom behavior on mobile and decide whether a settings toggle is needed
- [x] Define a trail model
  - [x] Store points as `{x, y, tMs}`
  - [x] Use a ring buffer size target (e.g. 16 points) and a time window (e.g. last 150ms)
  - [x] Add velocity estimation and a “slice active” threshold
- [x] Add trail rendering (temporary)
  - [x] Draw polyline per active pointer
  - [x] Optional smoothing (simple EMA) if the raw line looks jagged

### Acceptance
- Two-finger swipes create two independent trails.
- Trails do not break if the pointer briefly leaves the canvas.

---

## Phase 4 — Entity Model + Spawning (Fruits, Bombs, Powerups)

**Goal:** Create the world model and spawn logic so there’s something to slice.

**Deliverable:** Fruits spawn in waves, fly in arcs, and despawn cleanly.

### TODO
- [x] Define entity types and components
  - [x] `Fruit` entity: position, velocity, rotation, radius (hit shape), type/color
  - [x] `Bomb` entity: position, velocity, rotation, radius
  - [x] `PowerUp` entity (Arcade mode): freeze/frenzy/double points
  - [x] `Particle` entity: position, velocity, lifetime, color
- [x] Implement spawn system
  - [x] Spawn waves (1–6 items) with adjustable intervals
  - [x] Randomize start positions and initial velocities within safe bounds
  - [x] Add a difficulty ramp (spawn frequency and wave size over time)
  - [x] Add safeguards against impossible spawns (e.g. too low apex)
- [x] Implement basic “ballistic” physics system
  - [x] Gravity on `vy`
  - [x] Integrate position and rotation by fixed `dt`
  - [x] Define screen bounds for “missed” detection

### Acceptance
- Fruits reliably arc upward and fall.
- Missed fruits can be detected (even if you don’t apply lives yet).

---

## Phase 5 — Slicing / Collision Detection (Trail Segments vs Fruit)

**Goal:** Detect slices with a cheap, robust collision check and trigger the “slice event.”

**Deliverable:** Swiping across a fruit registers a hit exactly once per swipe.

### TODO
- [x] Implement segment-vs-circle intersection
  - [x] For each trail, iterate consecutive segments
  - [x] For each fruit, test intersection against its hit circle
  - [x] Add fast rejection (AABB or bounding checks) if needed
- [x] Add hit debouncing rules
  - [x] Prevent multi-count hits for a fruit within the same trail
  - [x] Decide whether a fruit can be hit by two pointers simultaneously
- [x] Emit slice events into the engine
  - [x] Create an event queue (e.g. `SliceEvent { entityId, pointerId, at }`)
  - [x] Handle events in a slice system to keep responsibilities clear
- [x] Add “fruit split” representation
  - [x] When sliced, replace one fruit with two “halves” entities (or two sprites with impulses)
  - [x] Add a short lifetime or despawn rule for halves
- [x] Add juice particles (MVP)
  - [x] Spawn a burst of particles on slice
  - [x] Keep particle count configurable for performance

### Acceptance
- Slicing feels consistent: a clean swipe through a fruit always counts.
- A fruit does not score multiple times from a single swipe.

---

## Phase 6 — Rules: Score, Combos, Lives, Game Over

**Goal:** Turn slicing into a complete game loop (start → play → game over).

**Deliverable:** A playable **Classic-like** mode (bombs, lives/strikes, scoring, combos).

### TODO
- [x] Implement scoring
  - [x] Base points per fruit
  - [x] Combo scoring for multiple fruits in one swipe or within a short window
  - [x] Add floating score feedback events (for later HUD display)
- [x] Implement lives/strikes (Classic-like)
  - [x] Define a strike counter (e.g. 3)
  - [x] Missed fruit → strike
  - [x] Strike reaches zero → game over
- [x] Implement bombs (Classic-like)
  - [x] Bomb hit → immediate game over (or define a strict rule and stick to it)
  - [x] Bomb feedback (screen flash event + SFX later)
- [x] Implement run state transitions
  - [x] `idle` → `running` on start
  - [x] `running` → `paused` on pause
  - [x] `running` → `game-over` on bomb hit or strikes depleted
  - [x] `game-over` → `idle` on reset
- [x] Persist “best score” locally
  - [x] Store best score per mode in `localStorage`

### Acceptance
- You can play a full round: start, slice, miss, lose, restart.
- Game rules are consistent and predictable.

---

## Phase 7 — Rendering: Sprites, Layers, and Visual Style (Canvas2D)

**Goal:** Replace placeholder visuals with actual in-game rendering primitives.

**Deliverable:** Fruits/bombs/particles/trails render with a consistent style (even if it’s placeholder art).

### TODO
- [x] Define a render pipeline (layered)
  - [x] Background
  - [x] Fruits/bombs
  - [x] Fruit halves
  - [x] Particles
  - [x] Trails (or trails above everything depending on style)
  - [x] Debug overlay (if enabled)
- [ ] Start with “procedural” placeholder art, then migrate to assets
  - [x] Procedural: circles/gradients for fruits (fast iteration)
  - [ ] Then: sprite draw using atlas frames
- [x] Add an asset loading plan
  - [x] Create an asset manifest (images + sounds)
  - [x] Preload images and confirm decode completion before starting gameplay
  - [x] (Recommended) Use `createImageBitmap` for decoded images on supporting browsers
- [x] Add visual feedback polish (still MVP-safe)
  - [x] Hit flash or subtle scale pop on slice
  - [x] Simple “juice splat” decals with fade-out

### Acceptance
- Rendering is stable (no flicker) and clearly communicates hits/misses.
- The game remains performant with moderate particle counts.

---

## Phase 8 — React UI Overlay (HUD, Menus, Pause, Settings)

**Goal:** Build the full UX around the engine while keeping React out of per-frame rendering.

**Deliverable:** A functional UI layer: Main menu, HUD, pause menu, game over screen, settings.

### TODO
- [x] Define UI state model
  - [x] Current view: menu / playing / paused / game over
  - [x] Selected mode: classic (and arcade later)
  - [x] Settings: sound volumes, sensitivity, reduced motion
- [x] Implement minimal screens (DOM overlay)
  - [x] Main menu: Start button + mode select
  - [x] HUD: score, strikes/lives (and timer later)
  - [x] Pause menu: resume + restart
  - [x] Game over: final score + best score + restart
- [x] Wire UI actions to engine API
  - [x] Start, pause/resume, restart, set mode
  - [x] Read-only engine stats surfaced to React (score, lives, phase)
- [x] Accessibility & input
  - [x] Keyboard navigation for menus
  - [x] Visible focus states
  - [x] Ensure canvas has an aria-label (already present) and UI controls are semantic

### Acceptance
- Menus are operable without touching the canvas.
- Pausing freezes simulation deterministically.

---

## Phase 9 — Audio (SFX, Music, Mix)

**Goal:** Add satisfying sound without violating autoplay rules.

**Deliverable:** Slice/miss/bomb sounds + optional background music, with volume controls.

### TODO
- [ ] Choose an audio approach
  - [ ] Option A: lightweight manual Web Audio wrapper
  - [ ] Option B: integrate `howler.js` for reliability (recommended by `goal.md`)
- [ ] Implement `AudioService`
  - [ ] `init()` / `resume()` on first user gesture
  - [ ] `playSfx(name, { volume, rate })`
  - [ ] `setMusicVolume`, `setSfxVolume`, `mute` toggles
- [ ] Wire sound triggers
  - [ ] Slice → SFX + slight random pitch variation
  - [ ] Miss → SFX
  - [ ] Bomb → SFX
  - [ ] Game over → stinger
- [ ] Persist settings
  - [ ] Store volumes/mute in `localStorage`

### Acceptance
- Audio starts only after the first user interaction.
- Volume settings are remembered between sessions.

---

## Phase 10 — Arcade Mode + Power-Ups (Optional, After Classic MVP)

**Goal:** Add an Arcade-like second mode with timer and power-ups.

**Deliverable:** A timed 60-second mode with freeze/frenzy/double-points.

### TODO
- [ ] Implement arcade timer
  - [ ] 60-second countdown
  - [ ] End-of-round on timer expiry
- [ ] Implement power-ups (bananas)
  - [ ] Freeze: slow motion / time scaling for a few seconds
  - [ ] Frenzy: high spawn rate, ideally no bombs during effect
  - [ ] Double points: score multiplier for a few seconds
- [ ] Balance and UI
  - [ ] HUD shows timer and active power-up state
  - [ ] Adjust spawn patterns for arcade feel

### Acceptance
- Arcade mode feels meaningfully different from Classic.
- Power-ups have clear feedback and deterministic durations.

---

## Phase 11 — Performance & Polish

**Goal:** Make it feel “snappy” on mobile and stable under load.

**Deliverable:** Reduced GC spikes, consistent FPS, good input latency.

### TODO
- [ ] Reduce allocations (pooling)
  - [ ] Particle pooling
  - [ ] Reuse trail point buffers (or store in typed arrays)
  - [ ] Avoid per-frame temporary object churn in hot paths
- [ ] Render optimizations
  - [ ] Background cached to an offscreen canvas (if useful)
  - [ ] Minimize state changes (lineWidth, strokeStyle, globalAlpha)
  - [ ] Limit particle counts dynamically on low-end devices
- [ ] Input feel tuning
  - [ ] Slice velocity threshold calibration
  - [ ] Combo window calibration
  - [ ] Sensitivity setting that adjusts trail smoothing / sampling
- [ ] “Reduced motion” setting
  - [ ] Lower particle counts
  - [ ] Disable screen flash/shake if implemented

### Acceptance
- No noticeable stutter during heavy slicing.
- Works well on at least one mid-range Android device and iOS Safari.

---

## Phase 12 — Testing, QA, and Release Readiness

**Goal:** Protect core gameplay rules and prevent regressions.

**Deliverable:** A small but meaningful test suite + repeatable manual test checklist.

### TODO
- [ ] Unit tests (Vitest)
  - [ ] Segment-vs-circle intersection tests (edge cases)
  - [ ] Combo detection and scoring tests
  - [ ] Spawn bounds tests (no impossible spawns)
  - [ ] Time scaling tests (freeze effect)
- [ ] UI tests (React Testing Library)
  - [ ] Menu → start flow
  - [ ] Pause/resume flow
  - [ ] Settings persistence
- [ ] E2E smoke (Playwright) (Optional)
  - [ ] App loads, canvas exists, start button works
- [ ] Manual QA checklist
  - [ ] Mobile safari: touch trails, no scroll conflicts
  - [ ] Multi-touch: two independent trails
  - [ ] Resume after tab switch / visibility changes

### Acceptance
- Core math/rules are covered by unit tests.
- A “smoke test” catches broken startup flows.

---

## Phase 13 — Deployment & (Optional) Analytics

**Goal:** Ship as a static web app with optional event tracking.

**Deliverable:** A production build deployed to static hosting, with optional privacy-friendly metrics.

### TODO
- [ ] Deployment readiness
  - [ ] Confirm `vite build` output works via `vite preview`
  - [ ] Add a `PUBLIC_URL`/base-path plan if deploying under a sub-path
- [ ] Add build-time configuration
  - [ ] Use `VITE_` env vars for feature flags (`VITE_DEBUG`, `VITE_ANALYTICS`)
- [ ] (Optional) Analytics adapter
  - [ ] Define a small event schema (`game_start`, `slice`, `combo`, `game_over`, `mode_select`)
  - [ ] Implement an adapter with a no-op default (so analytics can be disabled)

### Acceptance
- Deployed build runs identically to local preview.
- Analytics (if enabled) is gated by a feature flag.

---

## Optional Future Phase — WebGL / Pixi Renderer Upgrade

**Goal:** Increase particle/FX headroom and support more polished visuals.

**Deliverable:** A renderer swap that keeps gameplay identical.

### TODO
- [ ] Introduce a renderer abstraction boundary
  - [ ] Ensure gameplay systems are renderer-agnostic
- [ ] Implement Pixi-based rendering
  - [ ] Texture loading and sprite batching
  - [ ] ParticleContainer-based effects
  - [ ] Optional `@pixi/react` integration for React-friendly mounting
- [ ] Validate performance improvements on mobile

### Acceptance
- Same rules + feel as Canvas2D, with better performance headroom.
