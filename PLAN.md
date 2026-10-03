# PLAN

## Start here

**Next implementation:** separate same-stroke combos from timed streaks in
**Phase 17**. Viewport geometry, decoded artwork readiness and the existing-mode
browser baseline are implemented; build stroke IDs and deterministic scoring on
that foundation before adding combo presentation or expanded results.

Use this execution queue; phase numbers remain stable reference IDs and do not
represent the order of work:

| Order | Work | Dependency / completion check |
| --- | --- | --- |
| 1 | [Same-stroke scoring and fair spawn patterns](#phase-17--skill-fairness-and-mode-depth-p1--p2) | Deterministic scoring, stroke IDs, hazard clearance and power-up rules |
| 2 | [Onboarding and remaining slice/audio polish](#phase-16--signature-slice-feel-and-presentation-p1) | Decoded assets available; scoring rules from Phase 17 before combo feedback |
| 3 | [Equippable cosmetics and progression](#phase-18--rewards-that-change-the-experience-p2) | Define currency policy before equip/unlock flows; stroke stats before expanded results |
| 4 | [Measure and optimize performance](#phase-11--performance--polish) | Measure device frame times first; FX tiers must preserve gameplay RNG and scoring |
| 5 | [Extend browser and release coverage](#phase-19--mobile-performance-and-release-confidence-p1--p2) | Add new scoring/equip cases as implemented; offline/update and physical-device checks remain |
| 6 | [Finish cleanup, QA and release](#phase-14--quality-remediation-code-health) | Follow the remaining Phases 14, 7, 12 and 13 below; ship after release checks |

Physical input calibration in **Phase 15** and device QA in **Phase 12** can run
alongside implementation. Record device/browser evidence; pending device access
does not block unrelated code work. Add relevant regression coverage with each
change rather than waiting until the final QA pass.

**Working rules:** pick the first applicable unchecked task, follow its phase's
acceptance criteria, and mark it done only after its implementation and checks
pass. Cross-referenced tasks share one implementation. Optional work is listed
last. Completed tasks and the original review are archived below the backlog.

## Current baseline

- Playable Classic, Arcade and Zen with fixed-step simulation and fresh queued input.
- Directional cuts, fruit-colored juice, tapered trails, event-driven audio and a compact HUD.
- Run statistics, validated saved data and exactly-once settlement for recent run IDs.
- Adaptive playfield with a uniform input/render scale and safe live/pending resize.
- Decoded artwork loading, retry and explicit simple-artwork fallback before first run.
- 90 Bun tests / 2,446 assertions; lint, typecheck and production build passed in the latest batch.
- Eight permanent Playwright checks passed for existing modes, viewport contact,
  keyboard/settings flows, muted launch and artwork retry/fallback; CI now runs them.
- Chrome checks cover 320×568 and 390×844 portrait, 844×390 landscape, dialogs,
  rewards/replay and offline art. Physical touch, listening and device performance remain unverified.

**Architecture:** React owns UI/overlays; simulation/rendering run imperatively
through RAF and a fixed timestep. Keep Canvas2D; measure before considering WebGL.

## Phase 17 — Skill, Fairness, and Mode Depth (P1 / P2)

- [ ] **Separate same-stroke combos from timed streaks.** Introduce stroke IDs,
      configurable bonuses for cutting three-plus fruit in one gesture, and a
      separately capped streak multiplier. Current `10 × nextCombo` per fruit
      rewards a 320ms time chain with quadratic growth; label each mechanic
      clearly and make scoring independent of candidate enumeration order.
- [ ] **Clarify power-up rules and stacking.** Explicit duration/refresh policy,
      Freeze clock semantics, and queued/existing bomb behavior during Frenzy.
      Start/expiry events already exist; document and test refresh/stacking policy.
      Readable tints/audio must not mask hazards.
- [ ] **Build a spawn director.** Author fans, ladders, alternating-side
      launches, grouped combo windows, and recovery beats. Give Classic a
      survival ramp, Arcade a timed crescendo, and Zen a relaxed rhythm.
- [ ] **Guarantee a fair opening.** Start with fruit-only teaching waves;
      the original review found bomb-only first waves. Add hazard budgets
      and trajectory clearance so intended fruit groups have a readable safe
      cut route; expose debug envelopes and test representative seeds.
      First three Classic waves are now fruit-only, verified over 100 seeds;
      broader hazard budgets and clearance remain.
- [ ] **Evaluate moving-fruit contact between fixed steps.** Collision currently
      checks after physics against the fruit's updated circle. The browser probe
      observed an ascending fruit moving about 28 CSS pixels in 32ms with a
      roughly 14.5-pixel sprite radius; a horizontal swipe through its previous
      drawn center can miss. Add swept-motion regressions and evaluate continuous
      contact detection while preserving deterministic scoring and bomb order.
- [ ] **Balance with run statistics.** Record fruit sliced/missed, bomb hits,
      stroke accuracy, peak same-stroke combo, streak, and per-mode scores;
      use measured playtests to tune wave pressure, duration, and reward rates.
      Authoritative fruit/miss/bomb/peak-streak counters and results are implemented;
      stroke accuracy and measured balancing remain.

**Acceptance:** same seed/mode gives the intended repeatable spawn schedule
independent of cosmetic random calls and FX quality. Separate swipes cannot
produce a same-stroke combo; scoring/stacking are deterministic. Seeded opening
tests show fruit before bombs, and every mode has documented pressure budgets.

---

## Phase 16 — Signature Slice Feel and Presentation (P1)

- [ ] **Add concise onboarding.** Mode descriptions, a safe practice swipe,
      bomb/miss rules, and a short ready countdown; repeatable/skippable help.
      Menu mode descriptions and swipe/pause instructions are implemented;
      practice and countdown remain.
- [ ] **Celebrate meaningful hits.** Larger same-stroke combo labels, distinct
      critical/bonus feedback if introduced, tiny optional hit-stop or shake,
      and strong bomb punctuation. Effects must preserve mode timer rules and
      honor reduced-motion/flash preferences (Phases 11/14.4).
      Larger outlined score/combo feedback and motion/flash suppression are done;
      same-stroke scoring and optional extra punctuation remain.
- [ ] **Design action audio.** Layer swipe/cut/splatter sounds with a few
      variations; add combo escalation, bomb explosion, music ducking, and
      separate power-up activation/expiry cues. Cap simultaneous voices.
      Slice and bomb use richer swept/noise synthesis, with pitch variation;
      event precision, expiry cues, streak milestones, music ducking and eight-voice
      limits are implemented; richer layered samples/variations and listening QA remain.
- [ ] **Unify presentation.** Consistent typography, button treatment, lighting,
      and fruit scale; choose an original Saftladen identity and retain readable
      contrast against the wood background.

**Acceptance:** each fruit gives distinct colored feedback and complementary
halves at its actual location. Blades fade after release; audio corresponds to
events and master zero remains silent. New players understand the swipe, hazard,
and mode goal. Reduced-motion play retains clear feedback without shake/flash.

---

## Phase 18 — Rewards That Change the Experience (P2)

- [ ] **Define currency use.** Decide earned-threshold unlocks versus purchases;
      make costs, ownership, spending, and attainable progression consistent.
- [ ] **Implement equippable blades and dojos.** Show names, previews,
      requirements, unlock celebrations, and equip actions; persist selection
      and apply it to actual trails/backgrounds. Unlocks remain cosmetic.
- [ ] **Improve results.** Show per-mode personal best, fruit/miss/bomb counts,
      best stroke combo, objective progress, and a clear replay/equip next action.
      Fruit/miss/bomb counts, peak timed streak, per-mode best and reward status
      are implemented; same-stroke statistics and equip actions remain.
- [ ] **Extend goals beyond the three static objectives.** Add mode-specific
      achievements, a rotating small challenge set, and useful next-goal prompts
      without punishing missed days.

**Acceptance:** earning/equipping a cosmetic visibly changes play and survives
reload. Bomb-hit runs cannot receive a flawless bonus; rewards are applied once.
Players still have attainable meaningful goals after the initial three finish.

---

## Phase 11 — Performance & Polish

Use the Phase 19 device measurements to select optimizations. Keep effects
independent of gameplay RNG and validate scoring/spawns at every quality tier.

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
- [ ] Lower particle counts for reduced-motion play (setting and effect suppression already implemented)

---

## Phase 19 — Mobile, Performance, and Release Confidence (P1 / P2)

The first pass implements viewport geometry, asset readiness and a browser
baseline for existing modes. Extend scoring tests after Phase 17 and equip-flow
smoke after Phase 18. Device measurements and final release checks remain shared work;
completing the entire phase is not a prerequisite for starting Phase 17.

- [ ] **Extend browser smoke coverage as new features land.** The production
      suite covers menu → each mode → pause/resume → natural completion/results/
      replay, portrait/landscape fruit contact, profile focus/settings/scroll,
      fresh muted launch and artwork retry/fallback. Add same-stroke scoring
      after Phase 17 and profile equip after Phase 18. Physical iOS/Android
      multitouch QA remains in Phase 12; image optimization remains in Phase 14.8.
- [ ] **Add regression coverage immediately.** Extend Phase 12 with the Phase
      15 input/lifecycle cases, contact geometry, scoring order/stacking, profile
      migration, exactly-once rewards, and presentation RNG independence.
      Implemented input/lifecycle/contact/persistence/audio/controller regressions
      with Bun's built-in runner, including migrations, reward settlement,
      cosmetic RNG/ID independence, event delivery and renderer regressions.
      Same-stroke scoring/stacking tests remain. Vitest/RTL are optional later tooling.
- [ ] **Complete accessible settings/flows** using Phase 14.6: dialog focus
      move/restore, inert closed panels, discrete live announcements, menu/pause
      settings, functioning sensitivity, OS reduced-motion defaults, and
      optional flash suppression. Dialog focus, saved settings, reduced-motion
      defaults and discrete announcements are implemented; verify every keyboard
      flow and decide whether a separate flash-suppression control is needed.
- [ ] Verify interrupted first loads and safe service-worker updates.
- [ ] **Reconcile documentation** via Phase 14.9, including actual mode status,
      keyboard shortcuts, audio, deployment, and mutable systems contracts.
      README/runtime architecture updated; public metadata language remains.
- [ ] **Profile before renderer upgrades.** Establish production frame-time and
      input-latency budgets on agreed midrange mobile devices during Frenzy and
      multitouch; measure p95 frame time and long-session memory. Apply Phases
      11/14.3 optimizations, bounded FX/DPR tiers, and pause idle/menu work.
- [ ] Verify physical touch scrolling.

**Acceptance:** agreed phone/desktop flows work with no clipped controls or
geometry mismatch. Production performance is measured against stated budgets;
FX quality cannot change scoring/spawns. CI verifies regressions before deploy;
required assets work on offline reload without silently falling back.

---

## Phase 15 — Restore Trust in the Blade (P0 / P1)

The correctness fixes are implemented and regression-tested. The remaining
work is physical input calibration after the Phase 19 viewport fix.

- [ ] **P1: Calibrate movement on physical mouse, stylus and touch devices.**

**Acceptance:** regression probes pass for both timed modes, one terminal step,
stationary holds, down/move/up between frames, no-step frames, long slashes,
multitouch, and pause/reset. Score and rewards settle once; no ghost cuts or
stuck bomb flash. Verify input at 30/60/120Hz frame schedules.

---

## Phase 14 — Quality Remediation (Code Health)

Remaining engineering tasks from the 2026-08 review. Completed fixes are
in the completion record below. Coordinate overlapping work with Phases 11,
17 and 19 rather than implementing it twice.

### 14.3 Performance (hot path — 60fps target)

- [ ] **Reduce per-step / per-entity allocations** in `physicsSystem.ts:14`,
      `despawnSystem.ts:26-29`, `sliceDetectSystem.ts:7-22`, and the
      `setInputTrails` deep-copy (`gameEngine.ts:233-242`). Reuse scratch arrays;
      rebuild the entity map only when a removal occurs. (Overlaps Phase 11
      pooling.)

### 14.4 Dead code / cleanup

- [ ] **Continue splitting `renderer.ts`.** `renderHelpers.ts` is extracted;
      shared asset loading now lives in `assets/`; remaining candidates include
      `woodTexture.ts` (the ~120-line procedural generator that only paints
      pre-decode), and `drawHelpers.ts`.
- [ ] **Continue decomposing `App.tsx`.** `GameHud` is extracted; remaining
      candidates include `MenuScreen`,
      `PauseOverlay`, `GameOverOverlay`, `ProfilePanel`, and hooks
      `useAudioReactions`, `useRewardTracking`, `useGameKeyboard`.
- [ ] **Remove dead simulation state/constants:** `FruitEntity.sliced` (set,
      read, never becomes true), `BOMB_ARCADE_SCORE_PENALTY` (defined, never
      used — reconcile with the actual half-score penalty), the
      `reseedRun`-then-`resetRunState` double-write (`gameEngine.ts:272-274`).

### 14.5 Gameplay logic gaps

- [ ] **Clarify the two "freeze" concepts** with the Phase 17 power-up rules:
      global `TimeScalePreset.freeze` stops simulation, while the Arcade pickup
      slows entity motion/aging. Decide and document timer/spawn behavior there.

### 14.7 Tooling / CI / Deploy

- [ ] Add `LICENSE`, `.editorconfig`, and a Prettier config (formatting is
      currently unenforced).

### 14.8 Repo / asset hygiene

- [ ] **`git rm --cached output/imagegen/freeze_glyph_gen.png`** (2.2 MB, already
      `.gitignore`d but committed before the rule).
- [ ] **Delete confirmed orphaned/duplicate binaries:** `src/assets/background.png`
      (3 MB, byte-identical to `public/splash-screen.png`) and `src/assets/icon-saft.png`
      (identical to `public/favicon.png`). Neither ships (build tree-shakes them) but
      they bloat git.
- [ ] **Resolve unused image variants through the Phase 7 decision.** Keep
      `starfruit4.png`/`starfruit5.png`, which are now loaded directional halves.
      Only remove other variants after confirming they will not be used.
- [ ] **Optimize shipped assets** (evaluate WebP/AVIF with alpha for fruit PNGs;
      lazy-load/runtime-cache music, already encoded at 64 kbps). Measure quality
      and transfer savings before further audio compression. The original
      precache was 8174.48 KiB; the latest improvement build is about 4341 KiB.
- [ ] Move or remove `goal.md` (29 KB stale German draft with raw `citeturn…`
      artifacts).

### 14.9 Documentation

- [ ] Fix language inconsistency in public metadata (`index.html` OG description
      is German while the rest is English).

---

## Phase 7 — Rendering (assets)

Required sprites and directional halves are loaded. The remaining items are
asset/presentation decisions; implement their outcome with Phase 14 hygiene.

- [ ] Decide on `*2.png` variants (apple2, banana2, melon2, orange2, pineapple2/3, starfruit2) — use as visual variety on spawn, or ignore

- [ ] Score feedback — floating "+10" text + expanding yellow ring; likely fine as procedural (text rendering)
- [ ] Screen flash (bomb hit) — red overlay; keep procedural (just a fillRect)

---

## Phase 12 — Testing / QA

- [ ] Extend Bun unit coverage (Vitest is optional)
  - [ ] Segment-vs-circle intersection edge cases
  - [ ] Combo scoring tests
  - [ ] Spawn bounds tests
  - [ ] Time scaling tests (freeze)
- [ ] Extend the Phase 19 browser suite for new scoring/equip features;
      existing menu, pause/resume and settings flows are automated with Playwright.
- [ ] Manual QA checklist
  - [ ] Mobile Safari: touch trails, no scroll conflicts
  - [ ] Multi-touch: two independent trails
  - [ ] Resume after tab switch / visibility changes

---

## Phase 13 — Deployment (and optional analytics)

- [ ] Confirm `vite build` output works via `vite preview`
- [ ] Build-time feature flags (`VITE_DEBUG`, `VITE_ANALYTICS`)

---

## Optional future work

### Daily challenges and local replays (Phase 18)

- [ ] **Optional: daily seeded challenges and local replays.** Depend on Phase
      17 RNG separation and timestamped inputs; start with local personal bests.
      Online leaderboards require a separate integrity/backend design.

### Analytics (Phase 13)

- [ ] (Optional) Analytics adapter + event schema

### WebGL / Pixi Renderer Upgrade

- [ ] Introduce a renderer abstraction boundary (gameplay systems renderer-agnostic)
- [ ] Implement Pixi renderer (textures, batching, particles)
- [ ] Validate performance improvements on mobile

---

## Completed work — reference only

Phases 0–6 and 8–10 are mostly complete. Checked tasks, including later batches,
are kept here for traceability. Their
original defect descriptions are historical. Remaining acceptance work stays
in the active backlog.

<details>
<summary>Completed checklist by original phase</summary>

### Phase 19 — Viewport and browser foundation

- [x] **Share a consistent viewport transform.** Adaptive 720-unit shorter edge;
      renderer, pointer mapping, circular collisions/debug and spawn bounds
      agree. Resize preserves live/pending launches and clears old gestures.
- [x] **Ship a real asset readiness flow.** Actual imported sprites/background/
      title decode into a shared cache before play, with progress, timeout,
      failed-only retries and explicit fallback. Further image optimization is
      still open in Phase 14.8.
- [x] **Add browser smoke coverage for existing modes.** Production-build
      Playwright checks cover lifecycle/results/replay, portrait/resize contact,
      dialogs/settings, muted launch and artwork errors. CI gates deployment on
      these tests; new scoring/equip cases remain in the active Phase 19 backlog.

### Phase 14.4 — Asset scaffold cleanup

- [x] **Delete the dead asset-manifest scaffold.** Rewritten to reference real
      imported artwork and used by both menu readiness and renderer. Placeholder
      atlas/audio URLs and the separate renderer image loader are removed.

### Phase 12 — Browser UI automation

- [x] Automate UI flows with the Phase 19 Playwright suite
  - [x] Menu → start flow
  - [x] Pause/resume flow
  - [x] Settings persistence

### Phase 7 — Rendering (assets)

- [x] Whole fruit sprites for all 6 types (apple, orange, melon, pineapple, banana, starfruit)
- [x] Directional cut-half sprites for orange (orange3/4) and pineapple (pineapple4/5)
- [x] Single cut sprites for apple, melon, banana (*3.png), rendered as complementary clipped halves
- [x] Directional starfruit halves (starfruit4/5)
- [x] Bomb sprite (bomb.png)
- [x] Freeze power-up glyph (freeze-glyph.png)
- [x] Background image (background.jpg; the PNG duplicate is not the runtime asset)
- [x] Title screen image (title.png)

- [x] Load starfruit directional halves (starfruit4.png / starfruit5.png)
- [x] Blade/swipe trail — tapered bright core, restrained halo, age fade and release fade
- [x] Particles (juice splatter) — fruit-colored droplets
- [x] Decals (slice splash marks) — colored procedural splats
- [x] Rename `placeholderRenderer.ts` → `renderer.ts` (it's no longer a placeholder)
- [x] Extract duplicated draw-size logic in `drawFruitHalfLayer` (left/right/single share identical scaling code)

### Phase 11 — Performance & Polish

- [x] Sensitivity setting controls the movement threshold independently of visual history
- [x] Reduced motion setting (saved preference; OS default on first launch)
  - [x] Disable screen flashes, impact rings, score drift and half pop effects

### Phase 12 — Testing / QA

- [x] Bun regression suite: 76 tests covering fresh input, terminal/timed modes,
      collision, cancellation/multitouch, opening waves, controller lifecycle,
      event catch-up, audio mix/voice limits, renderer buckets, directional cuts,
      RNG/ID independence, profile migration and exactly-once reward settlement

### Phase 13 — Deployment (and optional analytics)

- [x] Base path strategy if deploying under a sub-path (`/Saftladen/`)

### Phase 14 — Quality Remediation (Code Health)

- [x] **Combo idle-reset is broken (clock mismatch).** Fixed: `lastSliceAtMs` is
      now stamped with sim time (`state.world.elapsedMs`) and both the
      within-window and idle-expiry checks compare in that one clock
      (`sliceResolveSystem.ts`).
- [x] **PWA manifest icons 404 in production.** Fixed: icon `src` values are now
      relative (`./pwa-192x192.png` etc.), so they resolve under the `/Saftladen/`
      base instead of the domain root (`public/manifest.webmanifest`).
- [x] **`theme_color: "transparent"` is invalid.** Fixed: set to `#3a2015` to
      match `background_color` and `index.html`.
- [x] **SFX zero is not a reliable initial mute, and volume changes destroy the mix.**
      `audioService.ts` adds positive offsets/floors for bomb, game-over, and UI
      click at lazy creation; `setSfxVolume` then flattens every Howl to the same
      value. Store per-effect multipliers and apply `gain * sfxVolume`; verify a
      fresh launch with saved zero volume silences every effect.
      Fixed with shared gain calculation and mute guard; regression tests cover
      every effect and preserved mix. First-click music toggle and lazy loading
      also repaired.

- [x] **Move the sim loop out of React.** `GameCanvasLayer.tsx` drives
      `engine.advanceBy()` and `engine.setInputTrails()` every frame inside a
      `useEffect` — a direct violation of "React MUST NOT run simulation steps."
      Move loop ownership into a non-React controller; let the component only
      mount/unmount the canvas.
      Implemented in `gameCanvasController.ts`; the React component only mounts
      it and publishes preference changes.
- [x] **Stop reading raw world state from `App.tsx`.** The audio/reward effects
      (`App.tsx:151-231`) reach into `state.world.misses`, `lastBombHitAtMs`,
      `modeState.arcade.powerUpTimers`, etc. Route everything through the
      `viewModel` snapshot (extend it with the event/transition signals audio
      needs) so `App` never couples to simulation shape.
      Done via snapshot statistics and `subscribeEvents` immutable payloads.
- [x] **Reconcile the "pure systems" claim in game architecture documentation.** AGENTS.md calls `systems/*` "pure,"
      but every system mutates `state` in place (a deliberate perf choice).
      Update the docs to say "in-place mutation for hot-path perf."
- [x] **Move `localStorage` I/O out of the sim step.** `gameEngine.ts:225`
      (`saveBestScore`) runs inside `runSimulationStep` (up to 12×/frame). Flush
      once per `advanceBy` / on game-over instead.

- [x] **Stop measuring the DOM every frame.** `GameCanvasLayer.tsx:111`
      (`getBoundingClientRect` via `syncCanvasMetrics`) and `coordinates.ts:5`
      (per `pointermove`) force synchronous layout. Cache metrics; recompute only
      on `resize` and `pointerdown`.
      Controller caches metrics; ResizeObserver/resize refresh size, pointerdown
      refreshes origin, pointermove/frame reads do not measure layout.
- [x] **Collapse the 4 per-frame entity passes into 1.** `renderer.ts` calls
      `Object.values(state.world.entities)` four times per frame (decals, fruit,
      halves, particles), each allocating an array; `worldToCanvas` allocates a
      `{x,y}` per entity. Single bucketed pass + inlined/scratch math.
      Done with reused layer buffers and scalar coordinates; device timing remains unmeasured.
- [x] **Stop the whole `App` re-rendering ~60×/sec.** `elapsedMs` is in the UI
      snapshot and compared in `areGameUiSnapshotsEqual`, so `setSnapshot` fires
      every frame and re-runs all menu-derived work. Isolate the live HUD into a
      leaf component; memoize menu-only derived data (`rankInfo`, `dojos`,
      `blades`, `nextObjective`).
      Resolved by comparing displayed seconds in snapshot equality while retaining
      precise values; scores, combo, phase and power-ups still publish immediately.
- [x] **Cache hot-path style strings.** `renderer.ts` builds
      `` `rgba(...,${a.toFixed(3)})` `` per particle/decal/feedback each frame.
      Quantize alpha / use `globalAlpha` with a fixed fillStyle.
      Done: scalar `globalAlpha` and cached/fixed colors in entity draw paths.

- [x] **De-duplicate the draw-size logic.** The ~15-line `imgAspect /
      baseSizeScale / nonSquareBonus / drawWidth / drawHeight` block is copied 6×
      in `renderer.ts` (3 in `drawFruitBombPowerLayer`, 3 in `drawFruitHalfLayer`).
      Extract `computeDrawSize(img, radius)`. (Supersedes the existing Phase 7
      cleanup item.) Cached sprite-size factors now serve every sprite draw.
- [x] **Wire up or delete the `reducedMotion` + `sliceSensitivity` settings** —
      loaded/saved but never consulted; also add a `prefers-reduced-motion` CSS
      block.

- [x] **Power-ups only work in arcade** but spawn in classic/zen
      (`spawnSystem.ts:144` vs `modeSystem.ts:59`). Either gate spawning to
      arcade or make effects mode-agnostic.
- [x] Remove `aria-live="polite"` from the running HUD (`App.tsx:316`) — it spams
      every score tick. The HUD is now a labelled group.
- [x] Add dedicated live announcements for discrete gameplay events.
- [x] Make the profile panel `inert`/`aria-hidden` when closed (currently just
      slid off-screen but still exposed to assistive technology) and manage focus
      on open. Enable pointer events when open; it currently inherits
      `pointer-events: none` from the overlay root.
- [x] Give pause / game-over overlays native modal dialog semantics, focus
      move-in/restore, and Escape-to-close.
- [x] Preserve the existing implicit Music/SFX slider labels; add percentage
      `aria-valuetext` and visible keyboard focus on sliders.

- [x] **Add a `pull_request` CI job** running `lint` + typecheck (+ tests once
      they exist); gate deploy on it. Today `deploy.yml` only builds+deploys on
      push to `main` — no lint, no tests, no PR checks.
- [x] **Pin the Bun version** in CI (`bun-version: latest` is non-reproducible)
      and add an `engines`/`.bun-version` pin.
- [x] **Trim the PWA precache (~8 MB).** Exclude `music.mp3` (runtime-cache on
      demand) and the oversized splash from `globPatterns`; the 3 MB
      `splash-screen.png` is an optional oversized manifest icon.
- [x] **Fix the stale README structure** (`README.md:63-117`): lists the removed
      `placeholderRenderer.ts`, omits the `audio/` folder + `modeSystem.ts` +
      `ui/rewards.ts`, and its "Next Milestone #1: add audio service" is already
      done. Sync to reality.

### Phase 15 — Restore Trust in the Blade (P0 / P1)

Review evidence: simulation probes reproduced Zen still running after 91.67s,
a stationary historical swipe scoring newly arriving fruit, pointer-up deleting
the only pending gesture, and a bomb-ending frame executing five simulation
ticks. These are correctness fixes; the later phases are product improvements.

- [x] **P0: Finish Zen at its 90s deadline.** `modeSystem.ts` returns
      `roundEnded`, but `gameEngine.ts` honors it only for Arcade. Settle both
      timed modes and award run rewards exactly once.
- [x] **P0: Stop fixed-step catch-up immediately at game-over.** Guard the
      `advanceBy` loop against terminal transitions; final score, elapsed time,
      misses, spawns, and event emission must stop on the ending step.
- [x] **P0: Consume fresh swipe segments once.** Separate a timestamped input
      queue from the visual trail. Trails currently expire only on pointer
      movement and are re-tested every step; holding still must never cut a
      later fruit or bomb. Retain unconsumed input when a frame has no sim step.
- [x] **P0: Preserve short gestures through pointer-up.** Queue release motion
      until consumed instead of deleting it before the next RAF. Handle
      cancellation/lost capture deliberately and keep simultaneous pointers
      independent.
- [x] **P1: Sample input before simulation.** Current canvas code advances
      first, then installs trails. Consume raw/coalesced samples before stepping;
      keep smoothing primarily visual so the blade follows the actual finger.
- [x] **P1: Wire slow-drag behavior and sensitivity.** Fresh raw movement uses
      a documented 120px/s threshold at reference width, divided by sensitivity
      and scaled to viewport width. Stationary segments never cut.
- [x] **P1: Anchor cuts to the fruit/contact point.** Detection uses the
      closest point on the slash; halves spawn at the fruit's actual center.
- [x] Carry stroke direction into half separation and directional spray (Phase 16).
- [x] **P1: Resolve inert power-ups** using Phase 14.5; no mode should spawn a
      pickup whose advertised effect cannot activate.
- [x] **P1: Clear input on phase/visibility changes.** Auto-pause on background
      or lost focus; resume explicitly with no queued menu/pause gestures.
- [x] **P1: Age terminal visual effects in presentation time.** Bomb flash
      currently uses simulation time, which stops on Classic bomb death. Let
      transient flashes finish after game-over without continuing gameplay.
- [x] **P1: Repair profile interaction and initial mute** via Phases 14.6/14.1;
      show cosmetic names instead of only “Unlocked”/requirements.

### Phase 16 — Signature Slice Feel and Presentation (P1)

- [x] **Upgrade the existing blade.** Tapered bright core, age-based fade,
      restrained glow, speed response, and release fade; support independent
      multitouch trails. Keep the visible blade aligned with collision samples.
- [x] **Use fruit-specific juice.** Honor entity colors for droplets/splats,
      bounded droplet sizes and asymmetric splats. Procedural rendering is acceptable.
- [x] Tie spray direction to stroke direction while keeping hazards readable.
- [x] **Make cuts convincing.** Load existing starfruit directional halves;
      produce complementary halves for apple/melon/banana; preserve fruit pose
      and launch fragments along the slash normal with readable spin.
      Starfruit assets, complementary clipped apple/melon/banana halves and pose
      preservation, local cut-plane clipping and slash-normal separation are implemented.
- [x] **Drive presentation from explicit events.** Ordered immutable slice, miss,
      bomb, power-up activation/expiry and run-start/end batches preserve every
      catch-up event. Slice payloads include the current streak for milestone cues;
      audio and rewards no longer infer events from score/world changes.
- [x] **Give the HUD a game hierarchy.** Dominant score, readable life icons,
      timer urgency, transient combo celebrations, and power-up icons with
      duration meters. Remove low-value dashboard pills from the play space.
      Done: compact score/lives/countdown HUD, timed streak label and duration meters.

### Phase 17 — Skill, Fairness, and Mode Depth (P1 / P2)

- [x] **Decouple gameplay and cosmetic RNG before seeded challenges.** Slice
      particles/halves currently consume the spawning RNG. Separate streams and
      make entity IDs engine-local so quality tiers and concurrent replay/test
      engines cannot affect gameplay (builds on Phase 14.2).
      Done: independent seeded streams and positive gameplay/negative effect IDs,
      tested with FX enabled/disabled, interleaved engines and same-seed restart.

### Phase 18 — Rewards That Change the Experience (P2)

- [x] **Correct reward eligibility.** “Flawless” currently means unchanged
      strikes, so Arcade bomb hits can still qualify. Base it on real run stats;
      prevent empty/instant-loss farming and keep settlement idempotent.
      Done with authoritative counters, >=5s/fruit/score eligibility and bounded
      persisted settlement IDs; Arcade bombs disqualify flawless bonuses.
- [x] **Version profile/settings storage.** Validate finite/ranged values,
      migrate older profiles, and recover from malformed or blocked storage
      without losing valid earned progress.
      Done: reward schema v2/settings v1 migrate flat legacy data and independently
      repair invalid fields; canonical objective metadata prevents inflated payouts.

### Phase 19 — Mobile, Performance, and Release Confidence (P1 / P2)

- [x] **Make overlays scrollable and bounded on phones.** Restrict `touch-action: none` to the
      play surface; allow profile/settings scrolling, constrain short-screen
      dialogs, preserve safe areas, and prevent pointer fall-through. Exercise
      390×844 and 844×390 viewports.
      Browser checks passed at 390×844 and 844×390.
- [x] Verify 320px-wide HUD/results layout in Chrome.
- [x] **Cache required gameplay art.** Add runtime `background.jpg` to the
      precache glob and verify offline reload of background and all sprites in Chrome.
- [x] **Make checks reproducible.** Pin Bun/runtime requirements, frozen-lockfile
      installs, and PR lint/build/tests; gate deployment on them (Phase 14.7).
      Document supported Node or force Bun runtime: local Node 18 cannot run
      this Vite dev server despite the README listing only Bun as prerequisite.

</details>

---

## Review and implementation history

Historical findings below describe the build reviewed at the time. They are not
a current defect list or a fresh rating; use the active backlog above for next work.

<details>
<summary>Original review and the three improvement batches (2026-10-03)</summary>

**Initial product review (2026-10-03, before the improvements below):**
**4.5/10 as a Fruit Ninja clone.** Recognizable
fruit art, fixed-step simulation, three mode menus, power-ups, and saved rewards
make a useful prototype. Input/lifecycle defects, basic slice feedback, and
cosmetics without equipment behavior keep it below a polished arcade experience.
The rating is a qualitative assessment, not a benchmark or an arithmetic average.

**Review coverage:** three specialist subagents reviewed gameplay/input,
presentation/audio/UX, and engineering/release; simulation probes and headless
Chrome checked the production build. `bun run build`, `bun run lint`, and
`git diff --check` passed after locked dependency installation. Browser checks
confirmed the profile drawer has `pointer-events: none` and the 844×390 pause
card ends at y=431, with its SFX control below the viewport. Physical touch,
subjective listening, and target-device performance still require playtesting.

| Aspect | Rating / 10 | Main gap |
| --- | ---: | --- |
| Fruit art and visual identity | 6 | Consistent art direction and complementary cut halves |
| Slicing and input trust | 2 | Stale segments cut; released swipes can disappear |
| Modes and power-ups | 4 | Zen never finishes; non-Arcade pickups lack effects |
| Spawn rhythm and challenge | 6 | Authored patterns, safe openings, hazard clearance |
| Scoring and skill expression | 4 | Same-stroke combos versus time-based streaks |
| Slice spectacle | 4 | Colored juice, tapered blades, directional cuts |
| Audio | 3 | Synthetic tone cues, mute/mix defects, event precision |
| Menus and HUD | 5 | Onboarding, drawer interaction, gameplay hierarchy |
| Mobile experience | 4 | Viewport mapping, touch QA, clipped landscape controls |
| Accessibility and settings | 3 | Focus flows, motion preferences, sensitivity wiring |
| Progression and replay value | 3 | Real equippable cosmetics and sustained objectives |
| Engineering foundation | 6 | Runtime controller, event boundary, hot-path work |
| Performance readiness | 5 | Hot-path allocations and target-device measurements |
| PWA and release readiness | 5 | Cache coverage, asset weight, reproducible tooling |
| Automated QA | 1 | No automated test suite or PR quality gate |

**Original recommendation (before implementation):** Phase 15 playability fixes → Phase 16 slice feel →
Phase 17 skill/mode depth → Phase 18 real progression. Start Phase 19 regression
coverage with Phase 15, and mobile/performance checks with Phase 16. Existing
Phase 14 remains the engineering backlog; references below avoid duplicating it.

**First improvement batch (2026-10-03):** three implementation subagents delivered
gameplay reliability, slicing/audio feedback, and mobile/accessibility changes.
The canvas controller now owns the runtime outside React and caches layout;
UI snapshots publish timer changes once per visible second. Regression tests
cover input at 30/60/120Hz, timed completion, terminal catch-up, contact position,
multitouch/cancellation, persistence, audio gain, and the controller pipeline.
CI now runs lint/tests/build for PRs with pinned Bun and frozen installs.
Required JPG art is precached; music loads and caches on demand. Precache fell
from 8174.48 KiB to approximately 4332 KiB, including new starfruit halves.
Headless Chrome verified 390×844 menus/profile and 844×390 pause scrolling,
focus cycling/restoration, settings persistence, Escape flows, first-click music,
and offline reload of background and all gameplay sprites. Physical touch tuning,
listening, device performance, and full reward settlement still need dedicated
playtests. The ratings above describe the original reviewed build.

**Second improvement batch (2026-10-03):** three implementation subagents
completed ordered presentation events/run statistics, cosmetic RNG and engine-local
ID separation, directional fragment/spray effects, renderer allocation reduction,
and versioned validated rewards/settings. Audio consumes every event, distinguishes
power-up activation/expiry, celebrates streak milestones, caps active SFX voices
at eight, and briefly ducks music for bombs/end cues. A compact HUD emphasizes
score, lives/time, streak and power-up meters; results show real run counters.
Flawless requires zero bombs/misses; empty, scoreless or <5-second runs pay nothing.
Settlement rejects duplicate IDs across reloads using a bounded 128-run history.
Headless Chrome verified 320×568 HUD/results, played-run payout once, replay,
instant-run rejection, Arcade countdown, and 844×390 HUD; 390×844 profile/dialog
focus/settings and 844×390 pause scrolling also passed without runtime exceptions.
These browser probes injected controlled engine state through the mounted React
hook to accelerate terminal/reward cases; they do not replace physical playtesting.
The suite now has 76 tests; lint/typecheck/production build pass. Device frame time,
physical swipe calibration, uniform viewport geometry, same-stroke scoring and
real equippable cosmetics remain priorities. No new numeric rating has been
assigned; the table above remains the original assessment.

**Third improvement batch (2026-10-03):** three implementation subagents
completed the Phase 19 foundation. The adaptive playfield keeps the shorter edge
at 720 world units, uses one uniform renderer/input transform, and preserves
live/pending launches on resize without replaying old gestures. A shared loader
decodes 19 required artwork images with progress, a 20-second timeout, retry of
failures only and explicit simple-artwork fallback; the renderer consumes the
same image cache. Production-build Playwright tests drive real UI/simulation
through browser clock controls and observe canvas/audio APIs without mutating
engine state or reading React internals. CI runs browser checks before deployment
and retains failure artifacts. Eight browser checks passed across the initial
suite and targeted reruns after test-clock fixes. The unit suite has 90 tests /
2,446 assertions;
same-stroke scoring is now next. Physical touch, listening, device frame times
and interrupted/offline service-worker updates remain open.

</details>
