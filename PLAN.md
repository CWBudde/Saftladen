# PLAN

## Start here

**Next implementation:** continue renderer decomposition in **Phase 14.4**.
Automated keyboard/settings acceptance in Phase 19 / 14.6 is complete. Continue
independent code cleanup while physical input, performance, listening and human
balance checks remain open; device measurements still precede further optimization.
Release documentation and English public metadata are reconciled; current
regression/equipment and production-preview checks are complete.
Offline installation/update coverage is now automated;
updates wait for a deliberate menu/results action and preserve active tabs.
The first performance pass adds a reproducible production renderer benchmark
and caches complete static dojo boards. Physical-device latency, actual Frenzy
multitouch and long-session memory remain pending before pooling/quality tiers.
Phase 18 now adds six permanent mode achievements, a completion-driven rotating
challenge set and actionable next-goal prompts. Saved progress has no expiry.
Equippable blades/dojos now have visual previews, saved selections and live
trail/background treatments. Results celebrate new unlocks with direct equip,
all objective progress, per-mode best and an equipment shortcut.
Currency policy is implemented: lifetime earned milestones, automatic unlocks
and no spending, with shared thresholds and visible remaining progress.
Phase 16 visual identity, layered action audio and variations are implemented.
Subjective listening QA remains pending, with a generated audition page available.
Hit feedback includes contact-centered combo/bomb bursts and readable bomb
penalties with reduced-motion support.
Onboarding includes safe practice, repeatable/skippable help
and a foreground-only ready countdown. Phase 17 implements gesture combos, capped timed streaks,
authored spawn patterns, hazard clearance, power-up policies and swept contact.
Human playtests are still needed to tune pressure and rewards from run statistics.

Use this execution queue; phase numbers remain stable reference IDs and do not
represent the order of work:

| Order | Work | Dependency / completion check |
| --- | --- | --- |
| 1 | [Finish physical release acceptance](#phase-19--mobile-performance-and-release-confidence-p1--p2) | Automated regression, equipment, keyboard/settings, offline/update and documentation checks complete; record device evidence for remaining checks |
| 2 | [Validate device performance and select further optimizations](#phase-11--performance--polish) | Host renderer baseline/cache done; measure physical latency/memory before pooling or quality tiers |
| 3 | [Playtest mode balance](#phase-17--skill-fairness-and-mode-depth-p1--p2) | Use recorded accuracy/combos/streaks to tune pressure and reward rates |
| 4 | [Finish cleanup, QA and release](#phase-14--quality-remediation-code-health) | Follow the remaining Phases 14, 7, 12 and 13 below; ship after release checks |

Physical input calibration in **Phase 15**, listening QA in **Phase 16** and
device QA in **Phase 12** can run alongside implementation. Record device/browser evidence; pending device access
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
- Gesture combos, capped timed streaks, authored spawn rhythms and safe hazard lanes.
- Swept moving-fruit contact, independent pickup clocks and explicit Frenzy bomb retirement.
- Optional first-run practice, repeatable help and a three-second ready countdown that suspends on backgrounding.
- Bounded combo/bomb impact bursts and bomb labels that expire on presentation time,
  including after game-over; reduced motion retains readable static text.
- Layered cut/juice and explosion variations, capped combo pitch escalation,
  distinct activation/expiry chords, with a local listening page generator.
- Citrus fruit-stall wordmark, shared typography/palette and controls, opaque readable
  panels, shaded HUD backdrop and consistent aspect-preserving sprite scale.
- Shared cosmetic milestones with automatic unlocks, lifetime earned totals,
  remaining progress and objective payouts; existing saved unlocks retained.
- Three equippable blades/dojos with shared preview/live art, independent validated
  selections, reload persistence and once-per-settlement unlock celebrations.
- Results show per-mode best, all objective progress, direct reward equip and
  an equipment shortcut alongside replay.
- Six permanent mode achievements and three rotating challenges with no expiry,
  bounded saved state, once-per-goal payouts and useful next-mode launch actions.
- Complete static dojo/background/HUD-shade cache with geometry, DPR, equip and asset invalidation;
  reproducible native-RAF production renderer benchmark at DPR 1/3 with an effects stress load.
- Deliberate menu/results PWA updates, no automatic reload of active/paused tabs,
  reconnect recovery after interrupted first installs and retained caches after failed updates.
- Current player/contributor guides describe actual modes, shortcuts, audio, local
  saves, deployment and mutable system/state contracts. English HTML/Open Graph/
  install descriptions match; share URLs use the production base and install
  colors match the current ink palette.
- Keyboard flows cover both Tab directions and modal background inertness for
  help, ready, profile, pause and results. Focus returns to the opener/selected
  mode/Pause after transitions. Held Space/Escape cannot dismiss a newly opened
  pause dialog; modifiers/repeats do not trigger game shortcuts. Equipment live
  announcements sit inside active dialogs. Saved audio, sensitivity and motion
  settings work across profile/pause/reload and actual practice swipes; one
  combined motion/flash control preserves readable feedback.
- 186 Bun tests / 3,703 assertions; lint, typecheck and production build passed in the latest batch.
- Twenty-eight permanent Playwright checks cover existing modes, horizontal viewport contact,
  held-gesture combos/results, keyboard/settings, muted launch, artwork retry/fallback,
  practice isolation, remembered/skipped help, foreground-only countdowns,
  combo bursts, real layered WAV decoding/headroom and bomb impact expiry
  with reduced motion enabled/disabled. Presentation checks cover shared fonts,
  guide text contrast, 44px controls and portrait/landscape menu bounds. Reward
  checks cover milestone boundaries, reload persistence and unchanged earned totals.
  Equipment checks cover locked/stale selections, keyboard actions, actual canvas
  pixels/trail colors, new-unlock results/equip/replay and portrait/landscape bounds.
  Progression checks cover retained saved progress, real challenge completion,
  set rotation, reload and keyboard next-mode actions from profile/results.
  Five real-worker checks cover all 18 images on offline reload, failed initial
  installation/reconnect, interrupted updates retaining the old cache, cross-tab
  acceptance without run interruption, and delayed acceptance from natural results.
- Chrome checks cover 320×568 and 390×844 portrait, 844×390 landscape, dialogs,
  rewards/replay and offline art. Physical touch, listening and device performance remain unverified.

**Architecture:** React owns UI/overlays; simulation/rendering run imperatively
through RAF and a fixed timestep. Keep Canvas2D; measure before considering WebGL.

## Phase 17 — Skill, Fairness, and Mode Depth (P1 / P2)

- [x] **Separate same-stroke combos from timed streaks.** Pointer-down IDs survive
      input chunks and close on release/cancellation. Three fruit earn 15 bonus
      points, then 5 per additional fruit; separate gestures cannot share bonuses.
      The 320ms timed streak raises the multiplier by 0.25 every five hits after
      the first, capped at ×2. Engine options configure validated defaults; HUD,
      results, feedback and audio distinguish the mechanics. Contact ordering is
      independent of entity-map and input-array enumeration.
- [x] **Clarify power-up rules and stacking.** Independent fixed-duration refresh;
      Freeze slows physics/FX aging while round, spawn and pickup clocks continue.
      Frenzy retires existing/queued bombs and suppresses future hazards. Double
      Points applies immediately to subsequent ordered hits and stroke bonuses.
      Policies and exact budgets are documented in `src/game/systems/README.md`.
- [x] **Build a spawn director.** Fans, ladders, alternating launches, grouped
      combo windows and recovery beats follow a deterministic six-beat rhythm.
      Classic ramps survival pressure, Arcade builds a timed crescendo, and Zen
      uses a relaxed cadence; active/pending entity budgets bound pressure.
- [x] **Guarantee a fair opening.** Every mode starts with three fruit-only solo
      waves. Active/queued bomb budgets and conservative trajectory envelopes
      protect a safe fruit corridor. Debug shows envelopes and the next pattern;
      representative seed and portrait/landscape tests cover openings and clearance.
- [x] **Evaluate moving-fruit contact between fixed steps.** Fresh blade segments
      now hit the swept circle capsule from the pre-physics to post-physics pose.
      This conservatively accepts contact anywhere within one fixed tick, without
      reusing old visual trails. Geometry, stale/stationary input, contact ownership
      and Classic bomb ordering have regressions; browser contact uses a horizontal
      swipe through the previous rendered center before and after rotation.
- [x] **Record authoritative balancing statistics.** Results now include moving
      stroke attempts, fruit-hitting strokes, accuracy and peak stroke combo;
      fruit/miss/bomb counters, peak timed streak and per-mode best remain.
- [ ] **Tune from measured human playtests.** Record per-mode scores, accuracy,
      survival and reward rates on mouse/touch devices, then adjust director
      pressure, duration and rewards. Seeded pressure checks establish repeatable
      automated baselines; they do not establish human difficulty or reward balance.

**Acceptance:** same seed/mode gives the intended repeatable spawn schedule
independent of cosmetic random calls and FX quality. Separate swipes cannot
produce a same-stroke combo; scoring/stacking are deterministic. Seeded opening
tests show fruit before bombs, and every mode has documented pressure budgets.

---

## Phase 16 — Signature Slice Feel and Presentation (P1)

- [x] **Add concise onboarding.** Mode descriptions, a safe practice swipe,
      bomb/miss rules, and a short ready countdown; repeatable/skippable help.
      First-run help can be skipped and reopened from the menu. A separate static
      practice canvas shares swipe detection and saved sensitivity without starting
      a run or changing statistics, best scores, objectives or rewards. Every
      launch/replay has a three-second countdown with Start now/cancel; blur/hidden
      pages suspend it until explicit continuation. The round timer starts afterward.
      Keyboard focus, reduced motion and scrollable portrait/landscape help are checked.
- [x] **Celebrate meaningful hits.** Larger same-stroke combo labels, distinct
      critical/bonus feedback if introduced, tiny optional hit-stop or shake,
      and strong bomb punctuation. Effects must preserve mode timer rules and
      honor reduced-motion/flash preferences (Phases 11/14.4).
      Larger outlined score/combo feedback and motion/flash suppression are done;
      stroke-bonus labels and event-driven combo cues are now implemented;
      contact-centered double rings/rays now punctuate growing combos and bomb
      hits. Bomb labels show the actual penalty, including zero-score hits.
      At most 12 impacts are retained; growing combos coalesce by stroke ID.
      RAF-time expiry works after game-over/pause; replay/menu clear effects.
      Rotation preserves normalized impact positions, and reduced motion keeps
      static text while suppressing rings/flash. Local bursts supply the extra
      punctuation without moving hit geometry or stopping simulation clocks.
- [x] **Design action audio.** Layer swipe/cut/splatter sounds with a few
      variations; add combo escalation, bomb explosion, music ducking, and
      separate power-up activation/expiry cues. Cap simultaneous voices.
      Three blade/cut/juice variants and two explosion transient/body/tail variants
      are baked into mono WAVs on unlock. Growing stroke combos raise a layered
      chord by up to four semitones; timed streaks retain ordinary cut cues.
      Rising activation and falling expiry chords remain separate. Layers share
      one voice per cue, eight voices total including queued decode. Sample peaks
      retain 12% headroom; master mute, music ducking and disposal are preserved.
      Asset-local noise and round-robin variation never consume gameplay RNG.
      Automated signal/browser checks pass; subjective listening remains below.
- [x] **Unify presentation.** Consistent typography, button treatment, lighting,
      and fruit scale; choose an original Saftladen identity and retain readable
      contrast against the wood background.
      A semantic Saftladen wordmark and inline sliced-citrus emblem replace the
      title bitmap. Cream/citrus/coral/leaf tokens, one UI/canvas font stack,
      consistent raised controls and mode fruit cards form the fruit-stall identity.
      Opaque panels and a board-header shade preserve wood-background readability.
      Whole fruit/fragments/practice share the same aspect-preserving maximum
      diameter; the old extra boost for non-square sprites is removed.
      Browser checks verify 4.5:1 guide text contrast, font inheritance, 44px menu
      targets and 320/390px portrait plus 844px landscape bounds. The required
      image manifest now has 18 entries; precache is about 4075 KiB.
- [ ] **Complete listening QA.** Generate `bun run audio:preview`, then listen
      on headphones and physical phone speakers. Check cut/juice separation,
      repetition fatigue, combo escalation, bomb clarity, activation/expiry
      distinction and rapid-group comfort with music. Confirm ducking restores
      the current volume and master zero remains silent during a real run.
      Record devices and findings before claiming audio quality is validated.

**Acceptance:** each fruit gives distinct colored feedback and complementary
halves at its actual location. Blades fade after release; audio corresponds to
events and master zero remains silent. New players understand the swipe, hazard,
and mode goal. Reduced-motion play retains clear feedback without shake/flash.

---

## Phase 18 — Rewards That Change the Experience (P2)

- [x] **Define currency use.** Decide earned-threshold unlocks versus purchases;
      make costs, ownership, spending, and attainable progression consistent.
      Starfruit is lifetime earned progress, never a purchase price or debit.
      Blades unlock automatically at 0/40/110 Starfruit; dojos at Levels 1/3/5
      (0/560/1120 XP). Shared catalog IDs/requirements derive permanent ownership
      from saved totals; existing saves need no ownership migration. Profile shows
      remaining progress, unlock requirements and one-time objective payouts.
      The expanded-goal 210-point/20-fruit/peak-streak-three/one-miss baseline
      reaches Comet at 2/7/5 runs and Dragon Fang at 17/24/20 in Classic/Arcade/Zen,
      without initial streak/score objective bonuses. Human reward-rate and
      attainability tuning remains in Phase 17.
- [x] **Implement equippable blades and dojos.** Show names, previews,
      requirements, unlock celebrations, and equip actions; persist selection
      and apply it to actual trails/backgrounds. Unlocks remain cosmetic.
      Shared canvas art supplies three blade palettes and static wood/wave,
      sunset harbor and moonlit temple dojos without new raster assets. A separate
      version-1 save validates each slot against earned totals, preserving earned
      reward counters and repairing locked/stale IDs independently. Results celebrate
      newly crossed thresholds with direct equip; selections survive reload and
      leave input, spawning, scoring and reduced-motion behavior intact.
- [x] **Improve results.** Show per-mode personal best, fruit/miss/bomb counts,
      best stroke combo, objective progress, and a clear replay/equip next action.
      Fruit/miss/bomb counts, peak timed streak, per-mode best and reward status
      and best stroke/accuracy are implemented. Results now label the mode's best,
      show all objective progress, offer direct equip for new unlocks and a
      Choose equipment shortcut alongside replay. Browser checks cover a real
      earned unlock, equip, replay and no repeated celebration/extra reward.
- [x] **Extend goals beyond the three static objectives.** Add mode-specific
      achievements, a rotating small challenge set, and useful next-goal prompts
      without punishing missed days.
      Six permanent achievements cover Classic safe cuts/survival, Arcade
      score/stroke combos and Zen harvest/accuracy. Three slots (one per mode)
      rotate through harvest, two-run practice and stroke-combo sets only when
      all finish. No deadlines, daily streaks or escalating targets; progress
      persists through time away. Reward schema v3 preserves legacy totals,
      paid starter objectives and recent settlement IDs while independently
      validating new progress/payout metadata. Eligible settlement pays each
      achievement once and each challenge once per set; the closing run cannot
      credit the next set. Profile/results suggest and launch a pending goal's
      mode through the normal countdown. Tests cover thresholds, accuracy sample
      size/ratio, safe cuts, mode isolation, repeated rotations, duplicate and
      ineligible runs, reload, malformed saves and real browser completion.

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
  - [x] Background cached to an offscreen canvas (if useful). One renderer-owned
        surface includes the selected dojo and HUD shade, invalidated on CSS/
        backing dimensions, DPR, dojo or decoded background changes. Direct fallback
        remains usable. Native-RAF production measurements show variable DPR 3
        timing across repeats; see `docs/PERFORMANCE.md` for exact results, the
        removed static drawing work and extra backing-store memory tradeoff.
  - [ ] Minimize state changes (lineWidth, strokeStyle, globalAlpha)
  - [ ] Limit particle counts dynamically on low-end devices
- [ ] Input feel tuning
  - [ ] Slice velocity threshold calibration
  - [ ] Combo window calibration
- [ ] Lower particle counts for reduced-motion play (setting and effect suppression already implemented)

---

## Phase 19 — Mobile, Performance, and Release Confidence (P1 / P2)

The first pass implements viewport geometry, asset readiness and a browser
baseline for existing modes. Phase 17 adds scoring/contact smoke; Phase 18 adds
equipment and progression flows. Device measurements and final release checks remain shared work;
completing the entire phase is not a prerequisite for starting Phase 17.

- [x] **Extend browser smoke coverage for the shipped features.** The production
      suite covers menu → each mode → pause/resume → natural completion/results/
      replay, portrait/landscape fruit contact, profile focus/settings/scroll,
      fresh muted launch, artwork retry/fallback, held-gesture combos, stroke
      results, horizontal moving-fruit contact, isolated practice, remembered/repeat
      help and countdown cancellation/background suspension. Combo bursts and
      bomb impact/expiry are checked with reduced motion enabled/disabled.
      Real WebAudio decoding verifies layered cut/combo playback and sample headroom.
      Equipment smoke now covers every blade/dojo pair, real trail/background
      drawing, locked/stale IDs, keyboard equip, reload, real unlock results and
      replay, with narrow portrait/landscape controls. Progression smoke covers
      a real completed challenge, board rotation, saved progress without expiry,
      reload and keyboard next-goal launches from profile/results. Physical iOS/Android
      multitouch QA remains in Phase 12; image optimization remains in Phase 14.8.
      Add future feature cases alongside their implementation.
- [x] **Add regression coverage immediately.** Extend Phase 12 with the Phase
      15 input/lifecycle cases, contact geometry, scoring order/stacking, profile
      migration, exactly-once rewards, and presentation RNG independence.
      Implemented input/lifecycle/contact/persistence/audio/controller regressions
      with Bun's built-in runner, including migrations, reward settlement,
      cosmetic RNG/ID independence, event delivery and renderer regressions.
      Same-stroke scoring, canonical contact ordering and stacking/pressure tests
      are now implemented. Vitest/RTL are optional later tooling.
- [x] **Complete accessible settings/flows** using Phase 14.6: dialog focus
      move/restore, inert closed panels, discrete live announcements, menu/pause
      settings, functioning sensitivity, OS reduced-motion defaults, and
      optional flash suppression. Production checks verify both Tab directions,
      background inertness and keyboard transitions for all five dialog types,
      selected-mode/opener/Pause focus restoration, held Space/Escape handoff,
      modifiers, native controls and runtime debug behavior. OS defaults and
      explicit saved overrides survive reload; all sliders work by keyboard,
      and saved sensitivity changes actual slow practice swipes. Equipment
      announcements now live inside profile/results dialogs; ordinary cuts and
      timer batches produce no live announcement. Keep the single labelled
      motion/flash control: it suppresses flashes, rings/bursts and particles
      while retaining text, with an accessible description. Device/screen-reader
      listening and physical touch QA remain manual checks.
- [x] **Verify interrupted first loads and safe service-worker updates.** Five
      production Chromium checks enable real workers, confirm failed precache
      fetches, recover first installs and verify all 18 images decode offline.
      Failed updates keep the old cache usable. Open tabs apply waiting updates
      through menu/results acceptance; countdowns/runs/pauses remain intact,
      including after another tab updates. Saved rewards/equipment survive
      acceptance. Inlining Workbox makes handler registration synchronous;
      activation failures offer retry. `docs/PWA.md` records the policy, test
      method and transition limitation for already-open older auto-update clients.
      Installed iOS/Android behavior remains physical-device QA.
- [x] **Reconcile documentation** via Phase 14.9, including actual mode status,
      keyboard shortcuts, audio, deployment, and mutable systems contracts.
      README, contributor/engine/system/asset guides now match the implemented
      runtime and Bun/Playwright tooling. Borrowed state views, fixed-step/system
      ordering, public keyboard behavior and pending physical QA are explicit.
      HTML/Open Graph/install descriptions share English copy; canonical/share
      URLs target `/Saftladen/`, install language is English and theme colors
      match the current palette. Production metadata and 28 local documentation
      links verified; the current production browser suite has 28 checks.
- [ ] **Profile before renderer upgrades.** Establish production frame-time and
      input-latency budgets on agreed midrange mobile devices during Frenzy and
      multitouch; measure p95 frame time and long-session memory. Apply Phases
      11/14.3 optimizations, bounded FX/DPR tiers, and pause idle/menu work.
      - [x] Add a reproducible production renderer benchmark and record a host
            baseline before optimization. Separate minified fixture tests three
            dojos, DPR 1/3, empty and stationary Frenzy-sized effects/two trails;
            60 warm-up + 120 native RAF samples per case. Reports retain CPU p95,
            RAF p95 and missed-frame percentages; full state remains unchanged.
            `docs/PERFORMANCE.md` records before/cache results and provisional
            8ms renderer / 20ms RAF / 50ms input budgets. No timing CI gate.
      - [ ] Validate physical midrange devices, actual Frenzy/touch latency,
            ten-minute memory behavior and foreground menu/pause work; use those
            findings to choose additional pooling, FX/DPR tiers or idle scheduling.
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

- [x] **Clarify the two "freeze" concepts** with the Phase 17 power-up rules:
      global `TimeScalePreset.freeze` stops simulation, while the Arcade pickup
      slows entity motion/aging while round/spawn/pickup clocks continue.
      Documented and tested with refresh/stacking rules in the systems README.

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
      precache was 8174.48 KiB; the latest improvement build is about 4085 KiB.
- [ ] Move or remove `goal.md` (29 KB stale German draft with raw `citeturn…`
      artifacts).

### 14.9 Documentation

- [x] Fix language inconsistency in public metadata. HTML description, Open Graph
      and install manifest now share English copy; HTML/manifest language is `en`.
      Canonical/share URLs are absolute and deployment-scoped; the existing
      512px icon supplies the share image. Install/browser colors match the ink palette.

---

## Phase 7 — Rendering (assets)

Required sprites and directional halves are loaded. The remaining items are
asset/presentation decisions; implement their outcome with Phase 14 hygiene.

- [ ] Decide on `*2.png` variants (apple2, banana2, melon2, orange2, pineapple2/3, starfruit2) — use as visual variety on spawn, or ignore

- [x] Score feedback — outlined floating score/stroke labels and procedural
      expanding rings; additional contact-centered combo bursts completed in Phase 16.
- [x] Screen flash (bomb hit) — bounded procedural red overlay driven by bomb
      events and presentation time; reduced motion suppresses it (Phase 16).

---

## Phase 12 — Testing / QA

- [x] Extend Bun unit coverage (Vitest is optional)
  - [x] Segment-vs-circle/capsule intersection edge cases
  - [x] Stroke combo and capped timed-streak scoring tests
  - [x] Spawn bounds, hazard clearance and pressure-budget tests
  - [x] Time scaling tests (global freeze and pickup clock/stacking rules)
- [x] Extend the Phase 19 browser suite for equip features. Every blade/dojo pair,
      locked/stale IDs, keyboard equip, real canvas visuals, saved selections,
      actual earned unlock/results/equip/replay and narrow layouts are automated.
- [ ] Manual QA checklist
  - [ ] Mobile Safari: touch trails, no scroll conflicts
  - [ ] Multi-touch: two independent trails
  - [ ] Resume after tab switch / visibility changes

---

## Phase 13 — Deployment (and optional analytics)

- [x] Confirm production build output works via `vite preview`. Twenty-eight
      Chromium checks run against `dist` under `/Saftladen/`; five real-worker
      checks use the production-serving fault fixture. CI runs both before deploy.
- [ ] Build-time feature flags (`VITE_DEBUG`, `VITE_ANALYTICS`). The implemented
      debug flag controls initial overlay visibility; `D` also works in production.
      Documentation now states this behavior. Analytics remains optional/unimplemented.

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

**Ninth improvement batch (2026-10-03):** completed Phase 18 currency policy.
Blades and dojos share stable catalog IDs and earned thresholds. Starfruit remains
a lifetime total; automatic ownership derives from that total or XP without
spending or a new save schema. Existing profiles retain their earned unlocks.
The profile now explains the policy and shows exact requirements, remaining
XP/Starfruit and objective payouts. Cosmetic equip/preview/visual application is
the next implementation item.

Validation: 158 Bun tests / 3,430 assertions, seventeen production browser checks,
lint, application/browser/tooling typechecking and build. Regressions cover exact
unlock boundaries, cumulative ownership, legacy save round-trips, no deductions,
duplicate settlements and a repeatable imperfect-run progression route in all
modes. Browser checks exercise the public saved-profile boundary, reload through
locked/unlocked milestones, unchanged totals and landscape settings access.
Human progression tuning, listening, physical input, performance and offline/update
QA remain pending.

**Tenth improvement batch (2026-10-03):** completed Phase 18 equippable cosmetics
and the remaining results actions. Shared canvas drawing supplies all previews
and actual blade/background appearances. Stable IDs and an independent validated
selection save preserve earned reward profiles; locked/stale selections repair
per slot and blocked storage retains a playable session. Settlements celebrate
newly crossed milestones once with direct equip buttons. Results also name the
mode's best, show all objective progress and offer an equipment-panel shortcut.

Validation: 167 Bun tests / 3,447 assertions; nineteen production browser cases
passed across the full-suite run and targeted rerun after fixing narrow card
overflow (18 passed initially; all four layout/equipment cases then passed).
Lint, application/browser/tooling typechecking and build passed. Browser checks verify
all equipment pairs via actual background pixels and live trail colors, equal
opening-hit scores, no spending, keyboard selection/focus, reload persistence,
320px card bounds and short landscape controls. A real played Zen run crosses
milestones, equips from results and replays without another unlock celebration.
Screenshot review corrected narrow preview overflow; generated browser/audio
artifacts are excluded from lint scanning as well as Git. Extend progression
goals next; human/device/listening/performance and offline/update QA remain open.

**Eleventh improvement batch (2026-10-03):** completed extended Phase 18 goals.
Six mode achievements and three rotating challenge slots provide goals after the
starter objectives finish. Rotation follows completion, never the calendar;
partial progress and paid slots survive time away. The board cycles through
harvest, eligible-run practice and gesture combos with bounded targets/state.
Achievement and challenge bonuses share eligible, exactly-once settlement;
new boards receive no credit from the closing run. Version-3 rewards preserve
legacy currency/unlocks, objective completion and recent run IDs, while validating
new metadata against canonical templates. Profile/results show descriptions,
progress, payouts, completion announcements and next-goal mode launch buttons.

Validation: 183 Bun tests / 3,681 assertions; all twenty production browser cases
passed in one full-suite run. Lint, application/browser/tooling typechecking and
production build passed. New regression checks cover every achievement's mode
and payout, sample-size/accuracy thresholds, bomb-safe fruit, repeated rotations
and wraparound, duplicate/ineligible runs, malformed fields, v2 migration and
reload. The new browser check retains old saved progress, completes a challenge
by slicing actual fruit, celebrates/rotates once and launches suggested modes
from profile/results by keyboard. Portrait/landscape screenshots were inspected.
New goal bonuses accelerate the arithmetic unlock baseline; human reward balance
still needs playtesting. Performance measurement is next; physical devices,
listening, balance and offline/update QA remain open.

**Twelfth improvement batch (2026-10-03):** implemented the first measured
performance optimization in Phases 11/19. A separate production renderer fixture
uses native RAF, decoded assets, all three dojos, DPR 1/3 and a stationary effects
load with two trails. Named JSON reports and generated fixture bundles stay
ignored and outside deployment. Complete static backgrounds/scenery/HUD shading
now share one renderer-owned surface, refreshed on geometry, DPR, dojo or asset
changes, with a direct-drawing fallback. At DPR 3 under the fixed effects load,
Great Wave/Sunset Harbor missed-frame percentages fell from 37.5%/27.5% to
0.8%/1.7% in the initial before/cache run; Storm Temple improved but still missed
frames. A repeat cached run measured 31.7%/23.3%/5.0% missed frames for Great
Wave/Sunset Harbor/Storm Temple, so this does not establish stable FPS gains.
`docs/PERFORMANCE.md` records both runs, limits, provisional budgets and the
cache's memory tradeoff. No pooling or quality tiers were inferred from short
host measurements.

Validation: 185 Bun tests / 3,701 assertions; all twenty production browser
cases passed in one full run. Lint, application/browser/tooling typechecking
and production build passed. Cache tests cover invalidation, in-place surface
reuse and unavailable contexts; profiling asserts unchanged complete game state.
Existing browser checks confirm live cosmetic pixels, equip/replay, viewport
contact, art retry/fallback and all progression flows. Physical phone latency,
actual Frenzy multitouch, long-session memory and idle scheduling measurements
remain open. Offline/update coverage is the next independent implementation.

**Thirteenth improvement batch (2026-10-03):** completed Phase 19 interrupted
installation and safe update coverage. Native registration exposes a deliberate
menu/results action, retries detached first-install registrations on reconnect,
and keeps other active/paused tabs on their current run after worker activation.
New launches are blocked during accepted activation, which has a retryable error
state. Workbox is inlined so its message handler registers synchronously; no
automatic reload script is injected. Existing older clients keep their previous
update behavior until they load this version, as documented in `docs/PWA.md`.

Five Chromium cases use real workers against the production build, with a local
fixture controlling failed downloads and an HTML precache revision. Failure
checks confirm actual failed worker fetches before recovery. They verify all 18
gameplay images decode on offline reload, initial installation retry/reconnect,
failed updates retaining the old cache, cross-tab acceptance preserving a run,
and a waiting update accepted only after a complete Zen run. Rewards/equipment
survive acceptance. Ordinary smoke checks still block workers for isolation.

Validation: 185 Bun tests / 3,701 assertions; all twenty-five production browser
cases passed in one full run. Failed-update recovery also passed ten consecutive
targeted runs after the runtime/startup changes. Lint, application/browser/tooling
typechecking and production build passed. Test controls are tooling only and are
not bundled into the deployed game. Release documentation/public metadata is the
next implementation; physical device, listening, balance and performance QA
remain open.

**Fourteenth improvement batch (2026-10-03):** completed release documentation
and public metadata reconciliation in Phases 19/14.9. README now separates mode
rules, equipment, feedback, goals and release behavior, with precise keyboard
actions, browser-local save limits and the production preview URL. Contributor
guidance describes the playable runtime and current toolchain instead of a
Phase 1 scaffold/planned Vitest suite. Engine/system guides document borrowed
mutable state, accumulator bounds, execution order and separate RNG/ID contexts;
the asset guide records the 18-image manifest without a removed title bitmap.
HTML/Open Graph/install descriptions share English copy, canonical/share URLs
target the actual deployment, the existing icon provides a valid share image,
and browser/install colors match the ink palette. No new raster assets are needed.

Validation: 185 Bun tests / 3,701 assertions; all twenty-five production Chromium
checks passed in one full run. Lint, application/browser/tooling typechecking and
production build passed. A production-output inspection verified matching
descriptions/language/colors, base-scoped manifest/icons, canonical/share paths
and all install assets; 28 local documentation file/heading links resolve.
The build precaches 30 entries / 4084.54 KiB. Existing regression/equipment and
preview checklist items are reconciled against that evidence. Keyboard/settings
acceptance is next; physical input/device performance, listening and human
balance QA remain open.

**Fifteenth improvement batch (2026-10-03):** completed automated keyboard/settings
acceptance in Phases 19/14.6. Cancelling ready/results now restores the selected
mode instead of always Classic. Global shortcuts respect browser modifiers,
already-handled events and repeats; a consumed Space/Escape press stays consumed
through modal autofocus and keyup, preventing an immediate accidental resume.
Equipment announcements are rendered inside native dialogs, where the modal
backdrop cannot make them inert. The existing combined motion/flash control
meets acceptance without a new preference or storage migration; its accessible
description explains suppressed effects and retained text. README corrects the
Arcade bomb rule to the actual half-score penalty, rounded down.

Validation: 186 Bun tests / 3,703 assertions, lint and application/browser/tooling
typechecking passed. All 28 production browser checks passed in one full run;
after extending held-key protection to Escape, all four affected keyboard/settings/
equipment cases passed again against the final build. New checks cover both Tab
directions, background inertness, focus restoration and public keyboard transitions
for all five dialog types, native slider/checkbox/button behavior, OS motion
defaults, saved overrides/zero audio, profile/pause persistence and sensitivity
through real slow practice gestures. Production build precaches 30 entries /
4085.32 KiB. Renderer decomposition in Phase 14.4 is the next independent code
task; physical input/device performance, screen-reader/listening and human
balance QA remain open.

</details>

---

## Review and implementation history

Historical findings below describe the build reviewed at the time. They are not
a current defect list or a fresh rating; use the active backlog above for next work.

<details>
<summary>Original review and the eight improvement batches (2026-10-03)</summary>

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

**Fourth improvement batch (2026-10-03):** three implementation subagents
delivered Phase 17 gesture scoring, the spawn/power-up director and swept collision;
an independent review checked lifecycle and ordering. Pointer-down IDs persist
across movement chunks and close on release/cancellation. Three fruit in one
stroke earn a configurable bonus; separately capped timed streaks replace the
previous quadratic points. Ordered contacts, immediate Double Points and causal
Frenzy/bomb behavior are tested independently of candidate enumeration. HUD,
results, canvas labels, audio and announcements distinguish stroke combos and
streaks; results include stroke accuracy and peak gesture size.

Every mode opens with three safe solo fruit, then follows a six-beat pattern
with fans, ladders, alternating throws, combo groups and recovery. Active/queued
fruit and bomb budgets, whole-group admission and conservative trajectory lanes
bound pressure; debug displays envelopes and the upcoming pattern. Seeded
60-second simulations across 30 seeds, three layouts and every mode found zero
clearance/budget violations; documented mean launches were 118 Classic, 259.5
Arcade and 74 Zen fruit. These are automated pressure measurements, not human
difficulty or reward validation. Power-up refresh, independent clocks and
existing/queued Frenzy bomb retirement are documented and tested.

Fresh horizontal swipes now hit the swept pre/post-physics fruit capsule, while
stationary pointers and historical visuals cannot cut. The production browser
suite adds a held-gesture fruit group, combo/accuracy results and horizontal
contact before/after rotation. Validation: 134 Bun tests / 2,652 assertions, nine
browser checks, lint, application/browser typechecking and production build.
Phase 16 onboarding/presentation is next; Phase 17 human balance tuning remains
unchecked alongside physical input, listening, performance and offline/update QA.

**Fifth improvement batch (2026-10-03):** completed the first remaining Phase 16
task, concise onboarding. Independent subagents implemented practice and browser
coverage; a separate review checked rule copy and lifecycle/accessibility risks.
First-time mode selection offers optional safe practice, mode rules and combo
instructions; completion/skip is remembered, and menu help remains repeatable.
The static practice controller shares fresh-input tracking, sensitivity and
collision helpers, with no engine, RAF loop, scoring, RNG or reward settlement.
It supports coalesced/release-only swipes, retry, DPR/resize and input cleanup.

Every launch and replay now prepares in an idle three-second countdown with
Start now and cancellation. Backgrounding/lost focus suspends it until explicit
continuation, preserving the full timed round. Native dialog transitions keep
focus inside the current modal and restore the correct menu/play control.
Validation: 139 Bun tests / 2,680 assertions, thirteen production browser checks,
lint, application/browser typechecking and build. New browser checks cover
practice miss/stationary/success/retry, unchanged rewards, remembered/repeat help,
keyboard skip/cancel, short-screen scrolling, reduced motion, countdown cleanup,
background suspension and full Arcade/Zen timer budgets. Remaining Phase 16 hit
punctuation, layered audio/listening and visual identity are next; physical input,
human balance, performance and offline/update QA remain pending.

**Sixth improvement batch (2026-10-03):** completed Phase 16 meaningful-hit
punctuation. The controller forwards ordered event batches to a bounded renderer
effect layer. Same-stroke combos create double rings and deterministic rays;
growing gestures refresh one burst. Bombs add an orange impact burst, a brief red
flash and a high-contrast label with the actual penalty or zero-score hit cue.
Effects age on presentation time after game-over/pause, reset on menu/new runs,
and preserve normalized positions through rotation. Reduced motion keeps static
score/combo/bomb text and suppresses rings/flash; input mapping, simulation,
random streams, scoring and mode clocks remain unchanged.

Validation: 146 Bun tests / 2,724 assertions, fifteen production browser checks,
lint, application/browser typechecking and build. Regressions cover event delivery,
duplicate prevention, combo coalescing, bounded catch-up work, reset, rotation,
edge-label placement, terminal expiry and unchanged engine state. Browser checks
observe real canvas combo bursts and swipe actual Arcade bombs with motion on/off,
then confirm impact expiry while paused. Action audio and visual identity are
next; subjective listening and physical-device checks remain pending.

**Seventh improvement batch (2026-10-03):** implemented layered Phase 16 action
audio. Three cuts combine blade sweep, cut body and delayed juice/droplet layers;
two explosions combine a transient, descending bass body and warm noise tail.
Growing stroke combos raise a chord by up to four semitones; activation and
expiry have distinct ascending/descending cues. Eleven WAV variants are baked
on unlock, with audio-local deterministic noise and round-robin variation.
Each layered cue consumes one of eight voice slots. Master updates reach every
variant; playback resets rates, and disposal unloads/revokes all generated sounds.
Sample headroom, master silence and existing music ducking are retained.

Validation: 150 Bun tests / 2,834 assertions, fifteen production browser checks,
lint, application/browser/tooling typechecking and production build. Signal
regressions check non-silent bodies, zero-valued edges, bounded peaks, repeatable
PCM, WAV headers/payloads, variation cycling and capped gesture pitch. Browser
checks observe real decoded cut/combo buffers and fresh-launch mute. The generated
`bun run audio:preview` page provides individual variants and combo pitches at
the default mix; its WAVs/page are ignored by Git. Subjective headphones/phone
listening and in-game mix comfort remain unchecked. Visual identity is the next
implementation task; physical input, human balance, performance and offline/update
QA remain pending.


**Eighth improvement batch (2026-10-03):** completed Phase 16 visual identity.
The semantic wordmark and decorative sliced-citrus SVG are available before art
loads. Shared warm palette/font tokens, raised controls, fruit mode cards and
opaque dialogs establish a consistent Saftladen fruit-stall look. A board-header
shade supports the HUD while objects remain bright. The renderer/practice use one
aspect-preserving 2.3-radius maximum sprite dimension for every aspect ratio;
collision geometry and simulation remain unchanged. Removing the title bitmap
from required artwork reduces the production precache to about 4075 KiB.

Validation: 150 Bun tests / 2,834 assertions, sixteen production browser checks,
lint, application/browser/tooling typechecking and build. The new browser check
measures guide contrast and font inheritance, verifies 44px menu controls and
horizontal/vertical bounds at 320×568, 390×844 and 844×390, and saves screenshots
for visual inspection. Phase 18 currency policy/equippable cosmetics are next;
subjective listening, physical input, human balance, performance and offline/update
QA remain pending.

</details>
