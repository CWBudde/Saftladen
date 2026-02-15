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

## Optional Future — WebGL / Pixi Renderer Upgrade

- [ ] Introduce a renderer abstraction boundary (gameplay systems renderer-agnostic)
- [ ] Implement Pixi renderer (textures, batching, particles)
- [ ] Validate performance improvements on mobile
