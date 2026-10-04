# Renderer performance

`bun run profile:render` builds a separate minified Vite bundle of the current
renderer and assets, then profiles it in Chromium on a local preview server.
Install Chromium with `bunx playwright install chromium` first. This command
does not require an application build and never adds the fixture to `dist/`.
Set `PERFORMANCE_LABEL=before` (or another lowercase label) to retain a named
report in `output/performance-reports/`. Bundles and raw reports are ignored.
The ordinary browser suite does not run this hardware-dependent benchmark.

Each of three dojos is measured at 390×844 CSS pixels and DPR 1/3, both empty
and under a fixed synthetic load: 30 whole fruit (the Frenzy ceiling), 40
fragments, 12 decals, 240 particles and two fresh 24-point blade trails. The
fixture does not advance simulation or imitate a human playthrough. All artwork
must be decoded. Each case warms up for 60 native RAF frames, then records 120
frames. CPU times cover renderer command submission, and RAF intervals capture
missed presentation opportunities. Intervals over 25ms count as missed frames.
The fixture checks that rendering leaves the entire game state unchanged,
including entities, scores, timers and gameplay/cosmetic RNG counters.

## Initial measurement — 2026-10-03

Linux x86_64 host, Intel Core i7-1255U, headless Chromium 153.0.8010.12.
Sequential runs used the same fixture before and after caching the complete
static board. Times are milliseconds; percentages count measured RAF intervals.

| Dojo          | DPR | Load    | CPU p95 before → cached | RAF p95 before → cached | Missed frames before → cached |
| ------------- | --- | ------- | ----------------------- | ----------------------- | ----------------------------- |
| Great Wave    | 1   | Empty   | 0.3 → 0.2               | 16.7 → 16.7             | 0% → 0%                       |
| Great Wave    | 1   | Effects | 0.7 → 0.9               | 16.7 → 16.7             | 0% → 0%                       |
| Sunset Harbor | 1   | Empty   | 0.3 → 0.1               | 16.7 → 16.8             | 0% → 0%                       |
| Sunset Harbor | 1   | Effects | 1.2 → 0.8               | 16.7 → 16.7             | 0% → 0%                       |
| Storm Temple  | 1   | Empty   | 0.2 → 0.1               | 16.8 → 16.7             | 0% → 0%                       |
| Storm Temple  | 1   | Effects | 0.9 → 1.1               | 16.8 → 16.7             | 0% → 0%                       |
| Great Wave    | 3   | Empty   | 0.2 → 0.1               | 16.7 → 16.8             | 0% → 0%                       |
| Great Wave    | 3   | Effects | 0.6 → 0.7               | 33.4 → 16.8             | 37.5% → 0.8%                  |
| Sunset Harbor | 3   | Empty   | 0.2 → 0.1               | 16.7 → 16.7             | 0% → 0%                       |
| Sunset Harbor | 3   | Effects | 0.5 → 0.7               | 33.4 → 16.7             | 27.5% → 1.7%                  |
| Storm Temple  | 3   | Empty   | 0.2 → 0.1               | 33.4 → 16.7             | 20% → 0%                      |
| Storm Temple  | 3   | Effects | 0.7 → 0.7               | 50.0 → 33.3             | 43.3% → 10.8%                 |

The cache removes recurring scenery paths, gradients, background image scaling
and the header shading pass. High-DPR RAF results improved in the first pair;
CPU submission times remain small and variable. A second cached run, after the
browser regression suite had ended, did not consistently reproduce those gains:

| DPR 3 effects case | Repeat CPU p95 | Repeat RAF p95 | Repeat missed frames |
| ------------------ | -------------- | -------------- | -------------------- |
| Great Wave         | 1.0            | 33.4           | 31.7%                |
| Sunset Harbor      | 0.8            | 33.4           | 23.3%                |
| Storm Temple       | 0.8            | 16.8           | 5.0%                 |

All DPR 1 repeat cases retained 0% missed frames. The baseline's empty Storm
Temple case also shows host variation. The cache guarantees less recurring
static drawing, but these short samples do not establish a stable FPS gain or
prove a specific GPU bottleneck. Repeat and compare on physical devices before
making further quality decisions. No pooling or dynamic FX/DPR tier was
introduced from this evidence.

The renderer retains one backing surface for the equipped board and reuses it
across changes. Its geometry, DPR, dojo and decoded background image form the
cache key. Resize, equip and asset availability changes repaint it. Direct
drawing remains available if a surface/context cannot be created. At 390×844,
the extra RGBA backing store is approximately 1.3 MB at DPR 1 or 11.8 MB at DPR 3,
excluding browser overhead and the procedural wood fallback. This is a deliberate
memory-for-drawing tradeoff; caches do not accumulate for previous dojos or sizes.

## Device validation still required

Provisional 60Hz targets are p95 RAF intervals ≤20ms, renderer submission ≤8ms
and input-to-visible-feedback ≤50ms. They need agreement and measurements on
physical midrange Android/iOS devices; they are recorded targets, not benchmark
pass/fail assertions. The renderer benchmark measures the first two only.

For each device/browser, record model, OS/browser version, viewport/DPR, motion
setting, dojo and run mode. Measure actual Arcade Frenzy with two simultaneous
touch gestures and normal audio, including input-to-feedback latency. Compare
foreground menu, running and paused work before changing idle scheduling. Follow
at least ten minutes of runs/replays/equipment changes with memory observations
after GC where available, separating retained image/canvas surfaces from growing
allocations. Select pooling, FX limits or DPR tiers from those findings, then
verify gameplay/spawn/scoring determinism and input/render alignment at each tier.
Physical input latency, real Frenzy play and long-session memory remain unverified.
