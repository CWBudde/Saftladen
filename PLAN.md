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

**Not started:** Phases 11–13.

**Code health:** See **Phase 14 — Quality Remediation** below for review findings
(correctness bugs, React-boundary violations, hot-path perf, dead code, a11y, CI,
and repo hygiene), ordered by priority.

---

## What’s Missing (Next Work)

### Phase 7 — Rendering (assets)

**Done:**
- [x] Whole fruit sprites for all 6 types (apple, orange, melon, pineapple, banana, starfruit)
- [x] Directional cut-half sprites for orange (orange3/4) and pineapple (pineapple4/5)
- [x] Single cut sprite for apple, melon, banana, starfruit (*3.png)
- [x] Bomb sprite (bomb.png)
- [x] Freeze power-up glyph (freeze-glyph.png)
- [x] Background image (background.png)
- [x] Title screen image (title.png)

**Remaining — asset loading gaps:**
- [ ] Load starfruit directional halves (starfruit4.png / starfruit5.png already exist but aren't loaded)
- [ ] Decide on `*2.png` variants (apple2, banana2, melon2, orange2, pineapple2/3, starfruit2) — use as visual variety on spawn, or ignore

**Remaining — still fully procedural (decide per item: keep procedural or replace with sprite):**
- [ ] Blade/swipe trail — currently not rendered in production at all (debug only); add a visible trail effect (glow sprite, gradient mesh, or procedural is fine)
- [ ] Particles (juice splatter) — white fading circles; could use a small soft-circle sprite for GPU batching later, or keep procedural
- [ ] Decals (slice splash marks) — fading ellipses on background; keep procedural or use a splat sprite
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
  - [ ] Sensitivity setting that adjusts trail smoothing / sampling
- [ ] Reduced motion setting
  - [ ] Lower particle counts
  - [ ] Disable screen flash/shake if implemented

### Phase 12 — Testing / QA

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
- [ ] Base path strategy if deploying under a sub-path
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
- [ ] **SFX relative mix is destroyed on volume change.** `audioService.ts` bakes
      per-effect volume offsets at creation, but `setSfxVolume` flattens every
      Howl to the same value, so the mix is lost the first time the slider moves.
      Store a per-effect multiplier and apply `base * sfxVolume`.

### 14.2 Architecture / React boundary (AGENTS.md contract)

- [ ] **Move the sim loop out of React.** `GameCanvasLayer.tsx` drives
      `engine.advanceBy()` and `engine.setInputTrails()` every frame inside a
      `useEffect` — a direct violation of "React MUST NOT run simulation steps."
      Move loop ownership into a non-React controller; let the component only
      mount/unmount the canvas.
- [ ] **Stop reading raw world state from `App.tsx`.** The audio/reward effects
      (`App.tsx:151-231`) reach into `state.world.misses`, `lastBombHitAtMs`,
      `modeState.arcade.powerUpTimers`, etc. Route everything through the
      `viewModel` snapshot (extend it with the event/transition signals audio
      needs) so `App` never couples to simulation shape.
- [ ] **Reconcile the "pure systems" claim.** AGENTS.md calls `systems/*` "pure,"
      but every system mutates `state` in place (a deliberate perf choice).
      Update the docs to say "in-place mutation for hot-path perf."
- [ ] **Move `localStorage` I/O out of the sim step.** `gameEngine.ts:225`
      (`saveBestScore`) runs inside `runSimulationStep` (up to 12×/frame). Flush
      once per `advanceBy` / on game-over instead.

### 14.3 Performance (hot path — 60fps target)

- [ ] **Stop measuring the DOM every frame.** `GameCanvasLayer.tsx:111`
      (`getBoundingClientRect` via `syncCanvasMetrics`) and `coordinates.ts:5`
      (per `pointermove`) force synchronous layout. Cache metrics; recompute only
      on `resize` and `pointerdown`.
- [ ] **Collapse the 4 per-frame entity passes into 1.** `renderer.ts` calls
      `Object.values(state.world.entities)` four times per frame (decals, fruit,
      halves, particles), each allocating an array; `worldToCanvas` allocates a
      `{x,y}` per entity. Single bucketed pass + inlined/scratch math.
- [ ] **Stop the whole `App` re-rendering ~60×/sec.** `elapsedMs` is in the UI
      snapshot and compared in `areGameUiSnapshotsEqual`, so `setSnapshot` fires
      every frame and re-runs all menu-derived work. Isolate the live HUD into a
      leaf component; memoize menu-only derived data (`rankInfo`, `dojos`,
      `blades`, `nextObjective`).
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
- [ ] **Wire up or delete the `reducedMotion` + `sliceSensitivity` settings** —
      loaded/saved but never consulted; also add a `prefers-reduced-motion` CSS
      block.

### 14.5 Gameplay logic gaps

- [ ] **Power-ups only work in arcade** but spawn in classic/zen
      (`spawnSystem.ts:144` vs `modeSystem.ts:59`). Either gate spawning to
      arcade or make effects mode-agnostic.
- [ ] **Clarify the two "freeze" concepts** (global `TimeScalePreset.freeze` vs
      the arcade slow-mo power-up that only scales entity motion/aging, not
      timers/spawns). Rename and/or apply the scale consistently.

### 14.6 Accessibility

- [ ] Remove `aria-live="polite"` from the running HUD (`App.tsx:316`) — it spams
      every score tick; announce only discrete events via a dedicated live region.
- [ ] Make the profile panel `inert`/`aria-hidden` when closed (currently just
      slid off-screen but still tabbable) and manage focus on open.
- [ ] Give pause / game-over overlays `role="dialog"` + `aria-modal`, focus
      move-in/restore, and Escape-to-close.
- [ ] Label the volume sliders (`aria-label` / `aria-valuetext`).

### 14.7 Tooling / CI / Deploy

- [ ] **Add a `pull_request` CI job** running `lint` + typecheck (+ tests once
      they exist); gate deploy on it. Today `deploy.yml` only builds+deploys on
      push to `main` — no lint, no tests, no PR checks.
- [ ] **Pin the Bun version** in CI (`bun-version: latest` is non-reproducible)
      and add an `engines`/`.bun-version` pin.
- [ ] **Trim the PWA precache (~8 MB).** Exclude `music.mp3` (runtime-cache on
      demand) and the oversized splash from `globPatterns`; the 3 MB
      `splash-screen.png` is only referenced by the (broken) manifest icon.
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
- [ ] **Optimize shipped assets** (WebP/AVIF for the 100–300 KB fruit PNGs;
      lower `music.mp3` bitrate). `dist` is currently ~8.8 MB.
- [ ] Move or remove `goal.md` (29 KB stale German draft with raw `citeturn…`
      artifacts).

### 14.9 Documentation

- [ ] **Fix the stale README structure** (`README.md:63-117`): lists the removed
      `placeholderRenderer.ts`, omits the `audio/` folder + `modeSystem.ts` +
      `ui/rewards.ts`, and its "Next Milestone #1: add audio service" is already
      done. Sync to reality.
- [ ] Fix language inconsistency in public metadata (`index.html` OG description
      is German while the rest is English).

---

## Optional Future — WebGL / Pixi Renderer Upgrade

- [ ] Introduce a renderer abstraction boundary (gameplay systems renderer-agnostic)
- [ ] Implement Pixi renderer (textures, batching, particles)
- [ ] Validate performance improvements on mobile
