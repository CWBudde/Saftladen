# Engine Notes (Phase 1)

- Fixed step is `16.67ms` (`60Hz`) for deterministic simulation pacing.
- Per-frame delta is clamped to `100ms` before accumulation to avoid large catch-up spikes after tab/background delays.
- A step cap is applied per frame to avoid spiral-of-death behavior on very slow devices.
- Gameplay and cosmetic RNG streams are seeded independently (`createSeededRng`).
- Gameplay and effect IDs are engine-local, reset per run; cosmetic entity counts do not affect gameplay IDs.
  - Default behavior: `start()` reuses current seed for reproducible runs.
  - Pass `start({ seed })` or `reset({ seed })` to intentionally re-seed.

The engine is headless and can be advanced without canvas rendering via `advanceBy(...)` and `stepOnce(...)`.

`setWorldBounds({ x, y })` adapts the simulation to the viewport without starting
a new run. It remaps live/pending entities and score feedback, clears queued
swipes, and preserves clocks, score and RNG state. Bounds survive reset and mode
changes. Headless engines default to 1280×720; deterministic comparisons must
use the same bounds and resize sequence.

`createGameEngine({ scoring })` overrides validated scoring defaults: fruit base
points, stroke threshold/bonuses, streak window, interval, increment and cap.
Every newly held gesture has a stroke ID; headless trails without one are treated
as independent completed gestures. Supply `strokeId` across input chunks and
`ended: true` on release (an empty end marker is valid). Only moving gestures count
as attempts. Cancellation, pause, resize and time-scale changes clear open stroke
state. Run statistics retain attempts, successful fruit strokes and best stroke
combo independently of the timed streak.

`subscribeEvents` publishes ordered immutable batches of gameplay events after
commands and advances. Catch-up preserves each event; game-over emits a single
`run-end` carrying the run ID and statistics. Pausing/resuming retains the same
run ID, while starting a fresh run allocates a new identity. Stopping or resetting
an unfinished run does not emit a completed-run event.

`effectsEnabled: false` disables half/particle/decal creation for headless QA
without changing gameplay RNG or scoring. Run IDs are unique metadata and are
excluded from comparisons of deterministic gameplay outcomes.
