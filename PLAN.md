# PLAN

## Start here

**Next:** Phase 1 physical release acceptance. Input, performance, listening and
human balance need recorded device/browser evidence; automated checks do not
complete those tasks. Phases 1–3 can run independently. Use the measurements to
choose Phase 4 optimizations; owner license selection in Phase 5 is independent.
Phase 6 is optional.

| Phase                                                      | Work                                                       | Prerequisite / evidence                             |
| ---------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| [1](#phase-1--physical-release-acceptance)                 | Physical input, mobile/PWA QA and performance measurements | Agreed phones/desktops and device/browser results   |
| [2](#phase-2--listening-qa)                                | Headphone/phone audio acceptance                           | Generated audition page and real runs               |
| [3](#phase-3--human-balance-tuning)                        | Mode pressure and reward balance                           | Mouse/touch playtests and run statistics            |
| [4](#phase-4--measured-performance-and-input-improvements) | Allocation, rendering and input tuning                     | Phase 1/3 findings; preserve deterministic gameplay |
| [5](#phase-5--repository-and-release-decisions)            | License and feature flags                                  | Owner chooses license terms                         |
| [6](#phase-6--optional-future-work)                        | Challenges/replays, analytics, renderer upgrade            | Separate design; measured need for renderer changes |

**Working rules:** pick the first applicable unchecked task, follow its acceptance
criteria, and mark it done only after implementation and relevant checks pass.
Subsections divide independent work; cross-referenced tasks share one
implementation. Pending device access does not block unrelated work. Add
regression coverage alongside changes. Phase numbers now follow execution order.

**Architecture:** React owns UI/overlays; simulation/rendering run imperatively
through RAF and a fixed timestep. Keep Canvas2D; measure before considering WebGL.

## Phase 1 — Physical release acceptance

### 1.1 Input calibration

Correctness fixes and the uniform viewport transform are implemented and
regression-tested; the remaining work is physical input calibration.

- [ ] **P1: Calibrate movement on physical mouse, stylus and touch devices.**

**Input acceptance:** regression probes pass for both timed modes, one terminal step,
stationary holds, down/move/up between frames, no-step frames, long slashes,
multitouch, and pause/reset. Score and rewards settle once; no ghost cuts or
stuck bomb flash. Verify input at 30/60/120Hz frame schedules.

### 1.2 Manual mobile and accessibility QA

- [ ] Manual QA checklist
  - [ ] Mobile Safari: touch trails, no scroll conflicts
  - [ ] Multi-touch: two independent trails
  - [ ] Resume after tab switch / visibility changes
- [ ] Verify physical touch scrolling.

Also record device/screen-reader listening and installed iOS/Android PWA behavior,
including offline installation/cache eviction and deliberate updates. Automated
dialog/settings and real-worker checks are complete; physical evidence remains
required before claiming these flows are validated.

### 1.3 Production performance measurements

- [ ] **Profile before renderer upgrades.** Establish production frame-time and
      input-latency budgets on agreed midrange mobile devices during Frenzy and
      multitouch; measure p95 frame time and long-session memory. Apply Phase
      4 optimizations, bounded FX/DPR tiers, and pause idle/menu work.
  - [ ] Validate physical midrange devices, actual Frenzy/touch latency,
        ten-minute memory behavior and foreground menu/pause work; use those
        findings to choose additional pooling, FX/DPR tiers or idle scheduling.

The host benchmark and static-board cache are complete. See
[performance evidence and the ten-minute device protocol](docs/PERFORMANCE.md)
for before/cache results, repeat variance and backing-store memory costs.
Provisional budgets are 8ms renderer / 20ms RAF / 50ms input; there is no timing
CI gate. Host measurements do not establish phone latency or stable mobile FPS.

**Release acceptance:** agreed phone/desktop flows work with no clipped controls or
geometry mismatch. Production performance is measured against stated budgets;
FX quality cannot change scoring/spawns. CI verifies regressions before deploy;
required assets work on offline reload without silently falling back.

## Phase 2 — Listening QA

- [ ] **Complete listening QA.** Generate `bun run audio:preview`, then listen
      on headphones and physical phone speakers. Check cut/juice separation,
      repetition fatigue, combo escalation, bomb clarity, activation/expiry
      distinction and rapid-group comfort with music. Confirm ducking restores
      the current volume and master zero remains silent during a real run.
      Record devices and findings before claiming audio quality is validated.

Further lossy music compression depends on this listening evidence. The current
music is approximately 182 kbps and loads/caches on demand; see
[asset measurements](docs/ASSET_COMPRESSION.md).

**Acceptance:** each fruit gives distinct colored feedback and complementary
halves at its actual location. Blades fade after release; audio corresponds to
events and master zero remains silent. New players understand the swipe, hazard,
and mode goal. Reduced-motion play retains clear feedback without shake/flash.

## Phase 3 — Human balance tuning

- [ ] **Tune from measured human playtests.** Record per-mode scores, accuracy,
      survival and reward rates on mouse/touch devices, then adjust director
      pressure, duration and rewards. Seeded pressure checks establish repeatable
      automated baselines; they do not establish human difficulty or reward balance.

Results already record moving stroke attempts, fruit-hitting strokes, accuracy,
peak stroke combo, fruit/miss/bomb counts, peak timed streak and per-mode best.
Use these to assess attainable cosmetic milestones and objective payouts.

**Acceptance:** same seed/mode gives the intended repeatable spawn schedule
independent of cosmetic random calls and FX quality. Separate swipes cannot
produce a same-stroke combo; scoring/stacking are deterministic. Seeded opening
tests show fruit before bombs, and every mode has documented pressure budgets.

## Phase 4 — Measured performance and input improvements

Use the Phase 1 device measurements to select optimizations. Keep effects
independent of gameplay RNG and validate scoring/spawns at every quality tier.

### 4.1 Simulation allocation cleanup (60fps target)

- [ ] **Reduce per-step / per-entity allocations** in `physicsSystem.ts:14`,
      `despawnSystem.ts:26-29`, `sliceDetectSystem.ts:7-22`, and the
      `setInputTrails` deep-copy (`gameEngine.ts:233-242`). Reuse scratch arrays;
      rebuild the entity map only when a removal occurs. (Overlaps Phase 4.2
      pooling.)

### 4.2 Pooling and rendering

- [ ] Reduce allocations (pooling)
  - [ ] Particle pooling
  - [ ] Reuse trail point buffers (or store in typed arrays)
  - [ ] Avoid per-frame temporary object churn in hot paths
- [ ] Render optimizations
  - [ ] Minimize state changes (lineWidth, strokeStyle, globalAlpha)
  - [ ] Limit particle counts dynamically on low-end devices

Background caching is complete: one renderer-owned surface includes the selected
dojo and HUD shade, invalidated by geometry, DPR, dojo or decoded assets, with a
direct-drawing fallback. See [performance measurements](docs/PERFORMANCE.md).

### 4.3 Input feel and reduced motion

- [ ] Input feel tuning
  - [ ] Slice velocity threshold calibration
  - [ ] Combo window calibration
- [ ] Lower particle counts for reduced-motion play (setting and effect suppression already implemented)

Share physical calibration with Phase 1.1 and measured combo/reward tuning with
Phase 3; avoid duplicate implementations.

## Phase 5 — Repository and release decisions

### 5.1 License

- [ ] **Add `LICENSE` after the owner chooses its terms.** License selection is
      independent of formatting; do not infer a license for code or bundled art.

### 5.2 Build-time flags

- [ ] Build-time feature flags (`VITE_DEBUG`, `VITE_ANALYTICS`). The implemented
      debug flag controls initial overlay visibility; `D` also works in production.
      Documentation now states this behavior. Analytics remains optional/unimplemented.

## Phase 6 — Optional future work

### 6.1 Daily challenges and local replays

- [ ] **Optional: daily seeded challenges and local replays.** Depend on gameplay/cosmetic
      RNG separation and timestamped inputs; start with local personal bests.
      Online leaderboards require a separate integrity/backend design.

### 6.2 Analytics

- [ ] (Optional) Analytics adapter + event schema

### 6.3 WebGL / Pixi renderer upgrade

- [ ] Introduce a renderer abstraction boundary (gameplay systems renderer-agnostic)
- [ ] Implement Pixi renderer (textures, batching, particles)
- [ ] Validate performance improvements on mobile

Spawn-time visual variety remains deferred until explicitly designed; cosmetic
selection must preserve gameplay RNG. Vitest/RTL remain optional tooling rather
than release prerequisites.

## Completed baseline — reference only

Earlier implementation batches (2026-10-03–04) are condensed here. Detailed change
history remains in Git; current architecture and measurements live in the linked
guides. Completed work is not part of the active execution queue.

- **Runtime/input:** imperative controller, 60Hz fixed step, fresh queued gestures,
  independent gameplay/cosmetic RNG and IDs, uniform 720-unit shorter-edge viewport
  and safe resize. [Architecture](src/game/README.md).
- **Modes/skill:** Classic/Arcade/Zen completion, same-stroke bonuses, capped
  streaks, six-beat director, safe openings/hazard budgets, swept fruit contact
  and documented power-up stacking. [System contracts](src/game/systems/README.md).
- **Presentation/audio:** citrus identity, directional halves/colored juice,
  tapered blades, bounded combo/bomb bursts and readable reduced-motion text;
  layered WAV variants, eight-voice cap, mute/ducking, safe practice/help and
  foreground-only ready countdown. [Player guide](README.md).
- **Compact dialogs:** shared dark palette and soft shadows; results show score,
  six stats, earnings and replay without long goal lists. Profile tabs separate
  Overview, Goals, single-preview Equipment and Settings; heading/navigation stay
  visible while content scrolls. One next-goal card lives on the menu. Browser
  coverage checks portrait/landscape fit, keyboard navigation and saved equipment.
- **Progression/equipment:** validated saves, exactly-once settlement, lifetime
  earned unlocks, three blades/three dojos with persisted live selections,
  compact unlock notices, six achievements and three rotating challenges without expiry.
- **Performance:** static dojo/HUD cache; production native-RAF benchmark covers
  three dojos, DPR 1/3, empty/effects stress, 60 warm-up + 120 samples, CPU/RAF p95
  and missed frames, with unchanged game state. [Measurements](docs/PERFORMANCE.md).
- **PWA/assets:** decoded loading/retry/explicit fallback, all 18 images offline,
  deliberate updates, failed-install/update recovery and active-tab preservation.
  Seventeen lossless WebPs save 28.5% sprite payload / 18.9% precache
  (compression pass: 29 entries / 3313.82 KiB); exact source RGBA,
  browser opaque rounding ≤1/255.
  [PWA](docs/PWA.md), [compression](docs/ASSET_COMPRESSION.md),
  [asset policy](src/game/assets/README.md).
- **Code/tooling:** focused renderer/UI modules, keyboard hook, dead-state cleanup,
  unified RNG reset, 6.65 MiB tracked-tree hygiene, shared editor settings,
  pinned Prettier/CI formatting and current English metadata/contributor guides.
- **Automated acceptance:** latest implementation batch passed 188 Bun tests /
  3,756 assertions, 28 production Playwright checks (five real-worker cases),
  formatting, lint, typecheck and build. Coverage includes modes/replay,
  contact/rotation, practice/countdown, effects/audio, all equipment pairs,
  goals/persistence, keyboard/focus/settings and artwork recovery. Physical QA is open.

### Numbering migration

| Previous reference                                           | Current location         |
| ------------------------------------------------------------ | ------------------------ |
| Phases 12, 15, 19 manual input/accessibility/PWA acceptance  | 1.1–1.2                  |
| Phase 19 device profiling                                    | 1.3                      |
| Phase 16 listening                                           | 2                        |
| Phase 17 human balance; Phase 18 attainability               | 3                        |
| Phases 11 and 14.3 performance/input tuning                  | 4                        |
| Phases 14.7 license and 13 feature flags                     | 5                        |
| Phases 18/13 optional challenges/analytics; renderer upgrade | 6                        |
| Other checked tasks from original Phases 0–19                | Completed baseline above |

### Historical review

The initial 2026-10-03 build was rated **4.5/10 as a Fruit Ninja clone** before
these improvements. Specialist reviews covered gameplay/input, presentation/audio
and engineering/release; the main gaps were input trust, slice feedback,
equippable progression and automated QA. That qualitative assessment is historical,
not a current rating. Physical input, listening, performance and human balance
still require the evidence listed in the active phases.
