# PLAN (Condensed)

Focus: keep this file as a quick “what’s left” checklist.

Guiding principles:

- React = UI/overlay only; simulation+rendering = imperative RAF + fixed timestep.
- Canvas2D first; WebGL/Pixi only later.

---

## Status Summary

**Mostly done:** Phases 0–6, 8–10.

**Partially done:**

- Phase 7 (Rendering): all game entities use PNG sprites; blade trail, particles, decals still procedural. Code cleanup pending.

**Not started:** Phases 17–18.

**In progress:** Phases 11–12, 15–16, and 19. Phase 15 correctness fixes are
implemented; remaining acceptance work includes physical touch and run-reward QA.

**Partially done:** Phase 13 — GitHub Pages deployment, production base path,
PWA manifest, and service worker exist; release verification remains.

**Code health:** See **Phase 14 — Quality Remediation** below for review findings
(correctness bugs, React-boundary violations, hot-path perf, dead code, a11y, CI,
and repo hygiene), ordered by priority.

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

**Recommended order:** Phase 15 playability fixes → Phase 16 slice feel →
Phase 17 skill/mode depth → Phase 18 real progression. Start Phase 19 regression
coverage with Phase 15, and mobile/performance checks with Phase 16. Existing
Phase 14 remains the engineering backlog; references below avoid duplicating it.

**Improvement batch (2026-10-03):** three implementation subagents delivered
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

---

## What’s Missing (Next Work)

### Phase 7 — Rendering (assets)

**Done:**
- [x] Whole fruit sprites for all 6 types (apple, orange, melon, pineapple, banana, starfruit)
- [x] Directional cut-half sprites for orange (orange3/4) and pineapple (pineapple4/5)
- [x] Single cut sprites for apple, melon, banana (*3.png), rendered as complementary clipped halves
- [x] Directional starfruit halves (starfruit4/5)
- [x] Bomb sprite (bomb.png)
- [x] Freeze power-up glyph (freeze-glyph.png)
- [x] Background image (background.jpg; the PNG duplicate is not the runtime asset)
- [x] Title screen image (title.png)

**Remaining — asset loading gaps:**
- [x] Load starfruit directional halves (starfruit4.png / starfruit5.png)
- [ ] Decide on `*2.png` variants (apple2, banana2, melon2, orange2, pineapple2/3, starfruit2) — use as visual variety on spawn, or ignore

**Remaining — still fully procedural (decide per item: keep procedural or replace with sprite):**
- [x] Blade/swipe trail — tapered bright core, restrained halo, age fade and release fade
- [x] Particles (juice splatter) — fruit-colored droplets
- [x] Decals (slice splash marks) — colored procedural splats
- [ ] Score feedback — floating "+10" text + expanding yellow ring; likely fine as procedural (text rendering)
- [ ] Screen flash (bomb hit) — red overlay; keep procedural (just a fillRect)

**Remaining — code cleanup:**
- [x] Rename `placeholderRenderer.ts` → `renderer.ts` (it's no longer a placeholder)
- [ ] Extract duplicated draw-size logic in `drawFruitHalfLayer` (left/right/single share identical scaling code)

### Phase 11 — Performance & Polish

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
  - [x] Sensitivity setting controls the movement threshold independently of visual history
- [x] Reduced motion setting (saved preference; OS default on first launch)
  - [ ] Lower particle counts
  - [x] Disable screen flashes, impact rings, score drift and half pop effects

### Phase 12 — Testing / QA

- [x] Bun regression suite: 27 tests / 814 assertions covering fresh input,
      terminal steps, timed modes, contact geometry, cancellation/multitouch,
      opening waves, persistence, controller lifecycle, UI cadence and audio mix
- [ ] Unit tests (Vitest)
  - [ ] Segment-vs-circle intersection edge cases
  - [ ] Combo scoring tests
  - [ ] Spawn bounds tests
  - [ ] Time scaling tests (freeze)
- [ ] UI tests (React Testing Library)
  - [ ] Menu → start flow
  - [ ] Pause/resume flow
  - [ ] Settings persistence
- [ ] (Optional) E2E smoke (Playwright)
- [ ] Manual QA checklist
  - [ ] Mobile Safari: touch trails, no scroll conflicts
  - [ ] Multi-touch: two independent trails
  - [ ] Resume after tab switch / visibility changes

### Phase 13 — Deployment (and optional analytics)

- [ ] Confirm `vite build` output works via `vite preview`
- [x] Base path strategy if deploying under a sub-path (`/Saftladen/`)
- [ ] Build-time feature flags (`VITE_DEBUG`, `VITE_ANALYTICS`)
- [ ] (Optional) Analytics adapter + event schema

---

## Phase 14 — Quality Remediation (Code Health)

Findings from a full repo quality review (2026-08). Ordered by priority. Each
item is a concrete, actionable fix. Tackle Critical/High before adding new
features.

### 14.1 Correctness bugs

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

### 14.2 Architecture / React boundary (AGENTS.md contract)

- [x] **Move the sim loop out of React.** `GameCanvasLayer.tsx` drives
      `engine.advanceBy()` and `engine.setInputTrails()` every frame inside a
      `useEffect` — a direct violation of "React MUST NOT run simulation steps."
      Move loop ownership into a non-React controller; let the component only
      mount/unmount the canvas.
      Implemented in `gameCanvasController.ts`; the React component only mounts
      it and publishes preference changes.
- [ ] **Stop reading raw world state from `App.tsx`.** The audio/reward effects
      (`App.tsx:151-231`) reach into `state.world.misses`, `lastBombHitAtMs`,
      `modeState.arcade.powerUpTimers`, etc. Route everything through the
      `viewModel` snapshot (extend it with the event/transition signals audio
      needs) so `App` never couples to simulation shape.
- [x] **Reconcile the "pure systems" claim in game architecture documentation.** AGENTS.md calls `systems/*` "pure,"
      but every system mutates `state` in place (a deliberate perf choice).
      Update the docs to say "in-place mutation for hot-path perf."
- [x] **Move `localStorage` I/O out of the sim step.** `gameEngine.ts:225`
      (`saveBestScore`) runs inside `runSimulationStep` (up to 12×/frame). Flush
      once per `advanceBy` / on game-over instead.

### 14.3 Performance (hot path — 60fps target)

- [x] **Stop measuring the DOM every frame.** `GameCanvasLayer.tsx:111`
      (`getBoundingClientRect` via `syncCanvasMetrics`) and `coordinates.ts:5`
      (per `pointermove`) force synchronous layout. Cache metrics; recompute only
      on `resize` and `pointerdown`.
      Controller caches metrics; ResizeObserver/resize refresh size, pointerdown
      refreshes origin, pointermove/frame reads do not measure layout.
- [ ] **Collapse the 4 per-frame entity passes into 1.** `renderer.ts` calls
      `Object.values(state.world.entities)` four times per frame (decals, fruit,
      halves, particles), each allocating an array; `worldToCanvas` allocates a
      `{x,y}` per entity. Single bucketed pass + inlined/scratch math.
- [x] **Stop the whole `App` re-rendering ~60×/sec.** `elapsedMs` is in the UI
      snapshot and compared in `areGameUiSnapshotsEqual`, so `setSnapshot` fires
      every frame and re-runs all menu-derived work. Isolate the live HUD into a
      leaf component; memoize menu-only derived data (`rankInfo`, `dojos`,
      `blades`, `nextObjective`).
      Resolved by comparing displayed seconds in snapshot equality while retaining
      precise values; scores, combo, phase and power-ups still publish immediately.
- [ ] **Reduce per-step / per-entity allocations** in `physicsSystem.ts:14`,
      `despawnSystem.ts:26-29`, `sliceDetectSystem.ts:7-22`, and the
      `setInputTrails` deep-copy (`gameEngine.ts:233-242`). Reuse scratch arrays;
      rebuild the entity map only when a removal occurs. (Overlaps Phase 11
      pooling.)
- [ ] **Cache hot-path style strings.** `renderer.ts` builds
      `` `rgba(...,${a.toFixed(3)})` `` per particle/decal/feedback each frame.
      Quantize alpha / use `globalAlpha` with a fixed fillStyle.

### 14.4 Dead code / cleanup

- [ ] **Delete the dead asset-manifest scaffold.** `src/game/assets/manifest.ts`
      + `preload.ts` reference `/assets/images/*` paths that don't exist,
      `preloadImageAssets` is never called, and the barrel re-exports it as if it
      were live. Delete (real loading is `import.meta.glob` in `renderer.ts`) or
      rewrite to reference the real assets and actually use it.
- [ ] **De-duplicate the draw-size logic.** The ~15-line `imgAspect /
      baseSizeScale / nonSquareBonus / drawWidth / drawHeight` block is copied 6×
      in `renderer.ts` (3 in `drawFruitBombPowerLayer`, 3 in `drawFruitHalfLayer`).
      Extract `computeDrawSize(img, radius)`. (Supersedes the existing Phase 7
      cleanup item.)
- [ ] **Split `renderer.ts` (897 lines).** Extract `assetLoader.ts`,
      `woodTexture.ts` (the ~120-line procedural generator that only paints
      pre-decode), and `drawHelpers.ts`.
- [ ] **Decompose `App.tsx` (541 lines).** Extract `MenuScreen`, `Hud`,
      `PauseOverlay`, `GameOverOverlay`, `ProfilePanel`, and hooks
      `useAudioReactions`, `useRewardTracking`, `useGameKeyboard`.
- [ ] **Remove dead simulation state/constants:** `FruitEntity.sliced` (set,
      read, never becomes true), `BOMB_ARCADE_SCORE_PENALTY` (defined, never
      used — reconcile with the actual half-score penalty), the
      `reseedRun`-then-`resetRunState` double-write (`gameEngine.ts:272-274`).
- [x] **Wire up or delete the `reducedMotion` + `sliceSensitivity` settings** —
      loaded/saved but never consulted; also add a `prefers-reduced-motion` CSS
      block.

### 14.5 Gameplay logic gaps

- [x] **Power-ups only work in arcade** but spawn in classic/zen
      (`spawnSystem.ts:144` vs `modeSystem.ts:59`). Either gate spawning to
      arcade or make effects mode-agnostic.
- [ ] **Clarify the two "freeze" concepts** (global `TimeScalePreset.freeze` vs
      the arcade slow-mo power-up that only scales entity motion/aging, not
      timers/spawns). Rename and/or apply the scale consistently.

### 14.6 Accessibility

- [x] Remove `aria-live="polite"` from the running HUD (`App.tsx:316`) — it spams
      every score tick. The HUD is now a labelled group.
- [ ] Add dedicated live announcements for discrete gameplay events.
- [x] Make the profile panel `inert`/`aria-hidden` when closed (currently just
      slid off-screen but still exposed to assistive technology) and manage focus
      on open. Enable pointer events when open; it currently inherits
      `pointer-events: none` from the overlay root.
- [x] Give pause / game-over overlays native modal dialog semantics, focus
      move-in/restore, and Escape-to-close.
- [x] Preserve the existing implicit Music/SFX slider labels; add percentage
      `aria-valuetext` and visible keyboard focus on sliders.

### 14.7 Tooling / CI / Deploy

- [x] **Add a `pull_request` CI job** running `lint` + typecheck (+ tests once
      they exist); gate deploy on it. Today `deploy.yml` only builds+deploys on
      push to `main` — no lint, no tests, no PR checks.
- [x] **Pin the Bun version** in CI (`bun-version: latest` is non-reproducible)
      and add an `engines`/`.bun-version` pin.
- [x] **Trim the PWA precache (~8 MB).** Exclude `music.mp3` (runtime-cache on
      demand) and the oversized splash from `globPatterns`; the 3 MB
      `splash-screen.png` is an optional oversized manifest icon.
- [ ] Add `LICENSE`, `.editorconfig`, and a Prettier config (formatting is
      currently unenforced).

### 14.8 Repo / asset hygiene

- [ ] **`git rm --cached output/imagegen/freeze_glyph_gen.png`** (2.2 MB, already
      `.gitignore`d but committed before the rule).
- [ ] **Delete confirmed orphaned/duplicate binaries:** `src/assets/background.png`
      (3 MB, byte-identical to `public/splash-screen.png`) and `src/assets/icon-saft.png`
      (identical to `public/favicon.png`). Neither ships (build tree-shakes them) but
      they bloat git.
- [ ] **Resolve the disposition of the unused image variants** in one place so it
      stays consistent with Phase 7 (7.1 above): `starfruit4.png`/`starfruit5.png`
      are directional cut-half assets Phase 7 intends to **load** (line 38) — keep
      them, don't delete. The `*2.png` variants (`apple2`, `banana2`, …) are the
      still-undecided "spawn variety vs. ignore" call (line 39) — only remove the
      ones Phase 7 confirms it won't use. (These don't ship today either way.)
- [ ] **Optimize shipped assets** (evaluate WebP/AVIF with alpha for fruit PNGs;
      lazy-load/runtime-cache music, already encoded at 64 kbps). Measure quality
      and transfer savings before further audio compression. Build precache is
      currently 33 entries / 8174.48 KiB (2026-10 review).
- [ ] Move or remove `goal.md` (29 KB stale German draft with raw `citeturn…`
      artifacts).

### 14.9 Documentation

- [x] **Fix the stale README structure** (`README.md:63-117`): lists the removed
      `placeholderRenderer.ts`, omits the `audio/` folder + `modeSystem.ts` +
      `ui/rewards.ts`, and its "Next Milestone #1: add audio service" is already
      done. Sync to reality.
- [ ] Fix language inconsistency in public metadata (`index.html` OG description
      is German while the rest is English).

---

## Phase 15 — Restore Trust in the Blade (P0 / P1)

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
- [ ] **P1: Calibrate movement on physical mouse, stylus and touch devices.**
- [x] **P1: Anchor cuts to the fruit/contact point.** Detection uses the
      closest point on the slash; halves spawn at the fruit's actual center.
- [ ] Carry stroke direction into half separation and directional spray (Phase 16).
- [x] **P1: Resolve inert power-ups** using Phase 14.5; no mode should spawn a
      pickup whose advertised effect cannot activate.
- [x] **P1: Clear input on phase/visibility changes.** Auto-pause on background
      or lost focus; resume explicitly with no queued menu/pause gestures.
- [x] **P1: Age terminal visual effects in presentation time.** Bomb flash
      currently uses simulation time, which stops on Classic bomb death. Let
      transient flashes finish after game-over without continuing gameplay.
- [x] **P1: Repair profile interaction and initial mute** via Phases 14.6/14.1;
      show cosmetic names instead of only “Unlocked”/requirements.

**Acceptance:** regression probes pass for both timed modes, one terminal step,
stationary holds, down/move/up between frames, no-step frames, long slashes,
multitouch, and pause/reset. Score and rewards settle once; no ghost cuts or
stuck bomb flash. Verify input at 30/60/120Hz frame schedules.

## Phase 16 — Signature Slice Feel and Presentation (P1)

- [x] **Upgrade the existing blade.** Tapered bright core, age-based fade,
      restrained glow, speed response, and release fade; support independent
      multitouch trails. Keep the visible blade aligned with collision samples.
- [x] **Use fruit-specific juice.** Honor entity colors for droplets/splats,
      bounded droplet sizes and asymmetric splats. Procedural rendering is acceptable.
- [ ] Tie spray direction to stroke direction while keeping hazards readable.
- [ ] **Make cuts convincing.** Load existing starfruit directional halves;
      produce complementary halves for apple/melon/banana; preserve fruit pose
      and launch fragments along the slash normal with readable spin.
      Starfruit assets, complementary clipped apple/melon/banana halves and pose
      preservation are implemented; slash-normal separation remains.
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
      layering, ducking, event precision and voice limits remain.
- [ ] **Drive presentation from explicit events.** Emit slice, miss, bomb,
      combo, power-up, and run-end events rather than infer sounds from score
      differences. Preserve every catch-up event without duplicate playback.
- [ ] **Give the HUD a game hierarchy.** Dominant score, readable life icons,
      timer urgency, transient combo celebrations, and power-up icons with
      duration meters. Remove low-value dashboard pills from the play space.
- [ ] **Add concise onboarding.** Mode descriptions, a safe practice swipe,
      bomb/miss rules, and a short ready countdown; repeatable/skippable help.
      Menu mode descriptions and swipe/pause instructions are implemented;
      practice and countdown remain.
- [ ] **Unify presentation.** Consistent typography, button treatment, lighting,
      and fruit scale; choose an original Saftladen identity and retain readable
      contrast against the wood background.

**Acceptance:** each fruit gives distinct colored feedback and complementary
halves at its actual location. Blades fade after release; audio corresponds to
events and master zero remains silent. New players understand the swipe, hazard,
and mode goal. Reduced-motion play retains clear feedback without shake/flash.

## Phase 17 — Skill, Fairness, and Mode Depth (P1 / P2)

- [ ] **Separate same-stroke combos from timed streaks.** Introduce stroke IDs,
      configurable bonuses for cutting three-plus fruit in one gesture, and a
      separately capped streak multiplier. Current `10 × nextCombo` per fruit
      rewards a 320ms time chain with quadratic growth; label each mechanic
      clearly and make scoring independent of candidate enumeration order.
- [ ] **Guarantee a fair opening.** Start with fruit-only teaching waves;
      sampled seeds currently include bomb-only first waves. Add hazard budgets
      and trajectory clearance so intended fruit groups have a readable safe
      cut route; expose debug envelopes and test representative seeds.
      First three Classic waves are now fruit-only, verified over 100 seeds;
      broader hazard budgets and clearance remain.
- [ ] **Build a spawn director.** Author fans, ladders, alternating-side
      launches, grouped combo windows, and recovery beats. Give Classic a
      survival ramp, Arcade a timed crescendo, and Zen a relaxed rhythm.
- [ ] **Clarify power-up rules and stacking.** Explicit duration/refresh policy,
      start/expiry events, Freeze clock semantics, and queued/existing bomb
      behavior during Frenzy. Readable tints/audio must not mask hazards.
- [ ] **Balance with run statistics.** Record fruit sliced/missed, bomb hits,
      stroke accuracy, peak same-stroke combo, streak, and per-mode scores;
      use measured playtests to tune wave pressure, duration, and reward rates.
- [ ] **Decouple gameplay and cosmetic RNG before seeded challenges.** Slice
      particles/halves currently consume the spawning RNG. Separate streams and
      make entity IDs engine-local so quality tiers and concurrent replay/test
      engines cannot affect gameplay (builds on Phase 14.2).

**Acceptance:** same seed/mode gives the intended repeatable spawn schedule
independent of cosmetic random calls and FX quality. Separate swipes cannot
produce a same-stroke combo; scoring/stacking are deterministic. Seeded opening
tests show fruit before bombs, and every mode has documented pressure budgets.

## Phase 18 — Rewards That Change the Experience (P2)

- [ ] **Implement equippable blades and dojos.** Show names, previews,
      requirements, unlock celebrations, and equip actions; persist selection
      and apply it to actual trails/backgrounds. Unlocks remain cosmetic.
- [ ] **Define currency use.** Decide earned-threshold unlocks versus purchases;
      make costs, ownership, spending, and attainable progression consistent.
- [ ] **Extend goals beyond the three static objectives.** Add mode-specific
      achievements, a rotating small challenge set, and useful next-goal prompts
      without punishing missed days.
- [ ] **Correct reward eligibility.** “Flawless” currently means unchanged
      strikes, so Arcade bomb hits can still qualify. Base it on real run stats;
      prevent empty/instant-loss farming and keep settlement idempotent.
- [ ] **Improve results.** Show per-mode personal best, fruit/miss/bomb counts,
      best stroke combo, objective progress, and a clear replay/equip next action.
- [ ] **Optional: daily seeded challenges and local replays.** Depend on Phase
      17 RNG separation and timestamped inputs; start with local personal bests.
      Online leaderboards require a separate integrity/backend design.
- [ ] **Version profile/settings storage.** Validate finite/ranged values,
      migrate older profiles, and recover from malformed or blocked storage
      without losing valid earned progress.

**Acceptance:** earning/equipping a cosmetic visibly changes play and survives
reload. Bomb-hit runs cannot receive a flawless bonus; rewards are applied once.
Players still have attainable meaningful goals after the initial three finish.

## Phase 19 — Mobile, Performance, and Release Confidence (P1 / P2)

- [ ] **Share a consistent viewport transform.** Current positions scale X/Y
      independently while radii scale only with width. Choose an aspect-preserving
      playfield or an explicitly adaptive world; renderer, input, collision, and
      spawn bounds must agree across portrait/landscape and resize.
- [x] **Make overlays scrollable and bounded on phones.** Restrict `touch-action: none` to the
      play surface; allow profile/settings scrolling, constrain short-screen
      dialogs, preserve safe areas, and prevent pointer fall-through. Exercise
      390×844 and 844×390 viewports.
      Browser checks passed at 390×844 and 844×390.
- [ ] Verify 320px-wide layout and physical touch scrolling.
- [ ] **Complete accessible settings/flows** using Phase 14.6: dialog focus
      move/restore, inert closed panels, discrete live announcements, menu/pause
      settings, functioning sensitivity, OS reduced-motion defaults, and
      optional flash suppression. Verify keyboard access to every overlay.
- [ ] **Profile before renderer upgrades.** Establish production frame-time and
      input-latency budgets on agreed midrange mobile devices during Frenzy and
      multitouch; measure p95 frame time and long-session memory. Apply Phases
11/14.3 optimizations, bounded FX/DPR tiers, and pause idle/menu work.
- [ ] **Add regression coverage immediately.** Extend Phase 12 with the Phase
      15 input/lifecycle cases, contact geometry, scoring order/stacking, profile
      migration, exactly-once rewards, and presentation RNG independence.
      Implemented input/lifecycle/contact/persistence/audio/controller regressions
      with Bun's built-in runner; scoring/stacking, migrations, reward settlement
      and cosmetic RNG tests remain. Vitest/RTL are optional later tooling.
- [ ] **Add browser smoke coverage.** Menu → each mode → pause/resume → timed
      completion/results/replay; profile equip/scroll; fresh muted launch; short
      viewport controls. Keep physical iOS/Android multitouch QA in Phase 12.
- [ ] **Ship a real asset readiness flow.** Replace the dead manifest scaffold,
      decode required sprites before first run, expose loading/retry/fallbacks,
      lazy-load music, optimize images, and trim precache via Phases 14.4/14.7/14.8.
- [x] **Cache required gameplay art.** Add runtime `background.jpg` to the
      precache glob and verify offline reload of background and all sprites in Chrome.
- [ ] Verify interrupted first loads and safe service-worker updates.
- [x] **Make checks reproducible.** Pin Bun/runtime requirements, frozen-lockfile
      installs, and PR lint/build/tests; gate deployment on them (Phase 14.7).
      Document supported Node or force Bun runtime: local Node 18 cannot run
      this Vite dev server despite the README listing only Bun as prerequisite.
- [ ] **Reconcile documentation** via Phase 14.9, including actual mode status,
      keyboard shortcuts, audio, deployment, and mutable systems contracts.
      README/runtime architecture updated; public metadata language remains.

**Acceptance:** agreed phone/desktop flows work with no clipped controls or
geometry mismatch. Production performance is measured against stated budgets;
FX quality cannot change scoring/spawns. CI verifies regressions before deploy;
required assets work on offline reload without silently falling back.

---

## Optional Future — WebGL / Pixi Renderer Upgrade

- [ ] Introduce a renderer abstraction boundary (gameplay systems renderer-agnostic)
- [ ] Implement Pixi renderer (textures, batching, particles)
- [ ] Validate performance improvements on mobile
