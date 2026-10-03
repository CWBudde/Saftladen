# Game Layer Architecture

This folder contains all non-React game code for the Fruit Ninja clone.
React should only mount the canvas, render overlay UI, and forward user intents to the game API.

## Folder Roles

- `core/`: runtime loop primitives and stage integration (`requestAnimationFrame`, canvas mount lifecycle).
- `engine/`: deterministic simulation lifecycle and game state transitions.
- `systems/`: simulation systems that mutate state in place for hot-path performance (spawning, physics, slicing, scoring, particles).
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

## Input and Runtime Ownership

`core/gameCanvasController.ts` owns pointer listeners, cached canvas metrics,
the frame loop, and rendering. `GameCanvasLayer` only mounts and disposes it.
Fresh raw pointer segments queue before simulation and are consumed once on the
next fixed step. Each pointer-down allocates a new stroke ID; movement chunks
retain it across fixed steps, and release sends an end marker even if the last
movement was already consumed. The visual trail has its own 150ms fade and cannot cause cuts.
Pointer-up preserves pending movement; cancellation, phase changes, resize, and
backgrounding clear input. Sensitivity changes the movement threshold (120 world
units/second, converted through the viewport scale and divided by sensitivity).

`core/viewport.ts` defines an adaptive playfield with a 720-unit shorter edge and
one uniform transform for positions, radii, input and debug probes. The canvas
controller sends viewport bounds through `engine.setWorldBounds`; React never
mutates world geometry. Resize keeps entity radii fixed in world units, remaps
live and pending launches, preserves exterior margins, and adjusts velocity to
preserve normalized ballistic arcs. Flight time scales with the square root of
the world-height change; mode clocks and spawn deadlines remain unchanged.

## Events, Statistics and Determinism

The engine exposes `subscribeEvents` alongside UI snapshot subscriptions. It
publishes frozen, ordered event batches once per command/advance, preserving
slice, miss, bomb, power-up activation/expiry and run-end events across catch-up
steps. Audio and rewards consume these payloads; `App` does not read simulation
world fields. Run-end includes a unique run ID and copied authoritative counters.

`score.combo` remains the legacy field name for timed streak hits;
`score.strokeCombo` counts fruit in the latest moving gesture, and
`score.streakMultiplier` holds the capped fruit multiplier. Three fruit in one
stroke earn a bonus; additional fruit award incremental bonuses. `stroke-combo`
events drive audio and announcements. Stats distinguish moving gestures,
fruit-hitting gestures and peak stroke combos. Scoring configuration is supplied
through `createGameEngine({ scoring: ... })` and survives run/mode resets.

Physics captures sliceable centers before movement only when fresh input exists.
Collision checks the swept circle capsule between the old and new centers, so
a swipe through the last rendered fruit remains valid. This is conservative
within one simulation tick: input and simulation clocks are not synchronized to
infer exact simultaneous contact. No historical visual trail is reused. Contacts
resolve by input timestamp, stroke/pointer IDs, segment fraction and entity ID;
entity-map insertion order cannot reorder a bomb and fruit. Feedback begins at
the earliest blade surface contact.

The authored spawn director derives its rhythm from mode progress and wave count.
Hazard budgets include active and queued bombs, with conservative ballistic
envelopes separating hazard and fruit lanes. Debug rendering shows these boxes
and the upcoming pattern. See [systems rules](systems/README.md) for pressure and
power-up policies.

Spawn randomness and cosmetic randomness use separate seeded streams. Engines
allocate gameplay IDs locally; effects use a separate negative-ID sequence.
Disabling cosmetic effects cannot change the subsequent spawn schedule or score.
Slash direction drives fragment separation and juice spray, while local cut
angles preserve the original fruit pose for complementary clipped sprites.

The renderer scans entities once into reusable layer buffers, caches sprite
size factors, and uses scalar coordinates/opacity in the entity draw paths.

The asset manifest references the actual imported sprite/background/title URLs.
A shared loader owns decoded images, progress and retry state independently of
React mounts. The menu gates run starts until decoding succeeds or the player
explicitly chooses simple artwork after a failure. The renderer consumes this
same decoded cache rather than starting a second set of image requests.
