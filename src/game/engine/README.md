# Engine Notes (Phase 1)

- Fixed step is `16.67ms` (`60Hz`) for deterministic simulation pacing.
- Per-frame delta is clamped to `100ms` before accumulation to avoid large catch-up spikes after tab/background delays.
- A step cap is applied per frame to avoid spiral-of-death behavior on very slow devices.
- RNG is seeded and deterministic (`createSeededRng`).
  - Default behavior: `start()` reuses current seed for reproducible runs.
  - Pass `start({ seed })` or `reset({ seed })` to intentionally re-seed.

The engine is headless and can be advanced without canvas rendering via `advanceBy(...)` and `stepOnce(...)`.
