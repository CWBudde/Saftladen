# Simulation systems and gameplay rules

## System contracts

Systems mutate the engine-owned `GameState` in place. They are deterministic for
the same state, step duration, bounds, fresh input, seeded random sources and ID allocator state;
they are not pure functions. Pure collision/geometry helpers remain separate.
The engine alone advances ticks/time and invokes `applyCoreSystems`; React never
steps systems or edits the world.

Each step runs this order:

1. `stepModeSystem`: advance round/pickup clocks, expire effects and derive modifiers.
2. `stepSpawnSystem`: admit deterministic groups and pending launches within budgets.
3. `stepPhysicsSystem`: move entities, retaining pre-motion sliceable centers when fresh segments exist.
4. `detectSliceEvents`: collect swept contacts from this step's input.
5. `resolveSliceEvents`: resolve canonical contact order, score hits and apply pickups.
6. `stepDespawnSystem`: retire out-of-bounds entities and count misses.

The outcome reports fruit/misses/bombs/round completion to the engine, which
updates Classic strikes, transitions to game-over and publishes events. The
engine consumes queued input once, even when one advance catches up several
steps. Resolver order and current pickup state determine subsequent contacts in
the same step; it does not reuse the initial modifier snapshot for scoring.

`SystemContext` supplies separate cosmetic RNG, gameplay/effect ID allocators,
the event sink and the effects switch. Normal runtime calls always supply it.
Low-level headless calls that omit the context use the shared random fallback;
use `createGameEngine({ effectsEnabled: false })` for comparisons that require
cosmetic independence. Audio/rendering consume events and state outside this
pipeline and never call gameplay RNG.

## Spawn director

The spawn director is deterministic from mode, simulation elapsed time and
`wavesSpawned`. Gameplay RNG varies fruit identity, radius, rotation, wave apex,
hazard/pickup presence and interval jitter (±4%); cosmetic RNG cannot change it.
Bounds and explicit resize commands are part of a reproducible run's inputs.

Every mode starts with three fruit-only solo waves. The next six beats repeat:
fan, staggered ladder, alternating-side launches, simultaneous
group, simultaneous group, and a fruit-only solo recovery. Fans/groups are
aligned near their apex for a horizontal combo opportunity. Ladders launch 110ms
apart and alternating throws 160ms apart. Hazards and pickups supplement fruit
groups instead of replacing promised combo slots.

| Mode    | Group pressure                                    | Normal interval before mode modifiers | Live + queued fruit budget | Live + queued bomb budget |
| ------- | ------------------------------------------------- | ------------------------------------- | -------------------------- | ------------------------- |
| Classic | 3 → 5 fruit over 90s; alternating 2 → 4           | 1400 → 900ms; recovery 1850ms         | 12                         | 2                         |
| Arcade  | 3 → 6 fruit over the 60s round; alternating 2 → 4 | 1050 → 610ms; recovery 1450ms         | 18; 30 during Frenzy       | 1; 0 during Frenzy        |
| Zen     | 3 fruit; alternating 2                            | 1450ms; recovery 2200ms               | 9                          | 0                         |

Fruit budgets govern admission of new groups. An entire group is deferred when
it exceeds the fruit budget, or an existing
hazard intersects any slot's conservative future envelope. Deferred groups do
not create a backlog. Existing Frenzy fruit may exceed the normal 18-fruit
budget after expiry; they finish naturally while new groups wait for capacity.
There are at most two live/queued pickups. Classic survival ramps and Arcade's
crescendo increase authored size/cadence; Zen's rhythm stays fixed.

Fruit centers travel inside the middle corridor (27–73% width). Bombs launch
vertically in alternating side lanes (9% / 91%). Before inserting a bomb,
the director checks its whole-flight horizontal envelope against every active
and queued fruit/pickup, including entity radii and a 20-unit gap at the normal
720-unit shorter edge. This keeps a horizontal cut through the intended fruit
group clear of bombs. Clearance checks also apply to new fruit against existing
bombs after resizing. `getTrajectoryEnvelope` exports the boxes used by debug
drawing, and `getSpawnWavePlan` exposes the authored pressure settings.

Initial seeded pressure measurements, without slicing or activating pickups:
30 seeds × three layouts (1280×720, 720×1558, 1558×720) × 60 seconds, using 50ms
physics steps. Classic completion was deliberately bypassed to measure sustained
pressure. All 270 mode/layout/seed runs respected corridor and spawn budgets.
Totals across 90 runs per mode:

| Mode    | Fruit launched | Bombs launched | Scheduled beats | Mean fruit / 60s |
| ------- | -------------: | -------------: | --------------: | ---------------: |
| Classic |         10,620 |            987 |           4,050 |            118.0 |
| Arcade  |         23,356 |          1,039 |           7,163 |            259.5 |
| Zen     |          6,660 |              0 |           2,790 |             74.0 |

These establish repeatable pressure baselines, not difficulty ratings. Human
playtests still need to tune pressure and rewards using misses, stroke accuracy,
peak same-stroke combos and per-mode scores. Dedicated simultaneous
Freeze/Frenzy coverage verifies the 30-fruit ceiling in portrait.

Power-ups activate only in Arcade. Same-type pickups refresh to their base
duration without adding time or increasing strength: Freeze 4500ms, Frenzy
5200ms, Double Points 6500ms. Different types have independent timers and coexist.
Every pickup emits an activation event (including refresh); each active timer
emits one expiry event when it reaches zero. No effect extends the round timer.

Freeze scales entity physics and effect aging to 45%. World elapsed time, the
round timer and pickup timers continue in fixed-step simulation time. Spawning
uses that same clock, with a reduced scheduling rate of 0.72; motion slows while
the round countdown continues. Frenzy uses scheduling rate 1.85 and overrides
Freeze's scheduling rate when both are active; physics still runs at 45%.
Normal Arcade scheduling rate is 1.25 and Zen is 0.8.

Frenzy immediately retires every existing and queued bomb and suppresses new
bombs until expiry. Retirement adds no hit, penalty, score or audio event. A bomb
resolved before the pickup still counts; a later event referring to a retired
bomb is skipped. Double Points doubles points while its timer is active; the
resolver reads current modifiers after pickups so later contacts in the same
step observe activation.

The engine's global `TimeScalePreset.freeze` is separate from the pickup: normal
`advanceBy` calls stop simulation and all clocks. Pause also stops simulation.
`stepOnce(dt)` deliberately advances an explicit manual/headless step while
running even under the global freeze preset; it never steps a paused run.
