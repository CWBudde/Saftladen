# PLAN (Condensed)

Focus: keep this file as a quick “what’s left” checklist.

Guiding principles:

- React = UI/overlay only; simulation+rendering = imperative RAF + fixed timestep.
- Canvas2D first; WebGL/Pixi only later.

---

## Status Summary

**Mostly done:** Phases 0–6, 8–10.

**Partially done:**

- Phase 7 (Rendering): procedural art + pipeline done; sprite/atlas draw missing.

**Not started:** Phases 11–13.

---

## What’s Missing (Next Work)

### Phase 7 — Rendering (assets)

- [ ] Migrate from procedural art to sprites: draw using atlas frames

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
