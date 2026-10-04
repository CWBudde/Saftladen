# Saftladen

A Fruit Ninja-style browser game built with React + TypeScript + Vite.
Play Classic, Arcade or Zen, earn cosmetic blades/dojos and complete persistent
goals. Supports mouse/touch input and offline play after a completed installation.
Simulation/rendering run on an imperative canvas; React owns menus and overlays.

**[Play online](https://cwbudde.github.io/Saftladen/)**

## Stack

- Bun (package manager and scripts)
- Vite
- React
- TypeScript
- ESLint
- Prettier

## Requirements

- Bun `>= 1.3.10` (CI version is pinned in `.bun-version`)
- Node.js `20.19+` or `22.12+` for Vite (Node 18 is unsupported)

## Quick Start

```bash
bun install --frozen-lockfile
bun dev
```

Open `http://localhost:5173`.

## Scripts

- `bun dev` - start the Vite dev server
- `bun run dev:types` - run TypeScript project builds in watch mode
- `bun run build` - type-check and create a production build
- `bun run preview` - preview the production build locally
- `bun run lint` - run ESLint
- `bun run format` - format source, tests, configuration and documentation
- `bun run format:check` - check formatting without changing files (also required in CI)
- `bun run test` - run input/gameplay, event, rendering, reward/storage, and audio regressions
- `bun run audio:preview` - generate a local listening page at `output/audio-preview/index.html`
- `bun run test:browser` - run the browser smoke suite against a production build
- `bun run profile:render` - build and measure a separate production renderer fixture

For browser checks, install Chromium once with `bunx playwright install chromium`,
then run `bun run build` and `bun run test:browser`. The suite covers loading,
game modes, pause/resume, results/replay, compact-screen dialogs and real
service-worker installation/offline/update scenarios. CI runs
these checks before deployment.

Formatting uses the pinned Prettier dependency and `.prettierrc.json`: two spaces,
single quotes, no semicolons and a 100-column target. `.editorconfig` shares UTF-8,
LF and indentation settings with editors; Markdown retains intentional trailing
spaces. Run `bun run format` before committing. Generated bundles, listening and
performance output, browser reports and the Bun lockfile are excluded.

The optional renderer benchmark uses the native browser clock at DPR 1 and 3,
with all dojos and a fixed effects load. See [performance measurements](docs/PERFORMANCE.md)
for results, reproduction instructions and pending physical-device checks.

## Debug Mode Toggle

Use `VITE_DEBUG=1` to show the debug overlay initially:

```bash
VITE_DEBUG=1 bun dev
```

The shared flag check lives in `src/game/debug.ts`. The overlay shows timing,
trails, hazard envelopes and the next spawn pattern. `D` toggles it at runtime,
including production; the environment flag controls its initial state.
No analytics adapter or `VITE_ANALYTICS` behavior is implemented.

## Controls and Help

- Drag on canvas: slice fruit (multi-touch supported on touch devices)
- `Space`: pause/resume when focus is outside buttons and form controls
- `D`: toggle debug overlay at runtime
- `Esc`: pause a run; dismissing the pause dialog resumes it. In help/profile
  it closes the dialog, in ready it cancels launch, and in results it returns to menu.
- `Tab` / `Shift+Tab`: navigate controls; `Enter` or `Space`: activate focused buttons
- Backgrounding the page pauses automatically; resume explicitly

Game shortcuts ignore browser modifier keys and held-key repeats. Dialogs keep
Tab navigation inside the panel; closing one restores focus to its opener or
the selected mode/Pause button after a screen change.

The first mode selection opens skippable help with a safe practice apple and
the rules for each mode. Revisit it with **How to play** on the menu. Practice
does not change scores, objectives or rewards. Each new run has a three-second
ready countdown; **Start now** skips the wait. Leaving the page suspends the
countdown until you explicitly continue. The full round timer starts after it.

Stroke combos create a brief burst at the cut; bombs show an impact ring and
their actual score penalty. **Reduce motion and flashes** keeps readable text
while suppressing these bursts and the bomb flash.

## Input Notes

The canvas sets `touch-action: none` in `src/App.css` so pointer events are not interrupted by browser pan/zoom gestures while playing.
Trade-off: while interacting over the canvas area, page scrolling and zoom gestures are intentionally suppressed.

The playfield adapts to portrait and landscape with a uniform scale: its shorter
edge is 720 world units. Rendering, pointer mapping and circular hit areas share
that scale. Resizing preserves live and queued launches, clears pending swipes,
and keeps the current run and timer.

## Architecture

`src/game/core` owns canvas/input/RAF lifecycle; `engine` owns the fixed-step
simulation and transitions. `systems` mutate engine-owned state in place;
`model` defines entities, `input` captures fresh gestures, and `render` draws
Canvas2D art/effects. `assets` owns decoded image readiness, `audio` owns sound
generation/playback, and `ui` adapts snapshots, commands and saved progression.
`App.tsx` composes menus, dialogs and high-level actions.

See [runtime architecture](src/game/README.md), [engine API](src/game/engine/README.md)
and [system contracts](src/game/systems/README.md#system-contracts) for ownership,
mutation, event ordering and determinism rules.

## Modes and Settings

| Mode    | Goal and ending                                                | Hazards / pickups                                                                      |
| ------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Classic | Survive for a high score; ends on a bomb or three missed fruit | Bombs end the run; no pickups                                                          |
| Arcade  | Score within 60 seconds                                        | Bombs subtract half your score, rounded down; Freeze, Frenzy and Double Points pickups |
| Zen     | Relaxed, timed 90-second session                               | No bombs or pickups; misses do not end the run                                         |

Profile and pause dialogs offer audio, sensitivity, and reduced-motion settings.
Preferences persist locally; the initial motion preference follows the OS.
Your saved motion choice overrides that initial default. One combined control
suppresses flashes, bursts and particles while preserving score and bomb text.

## Equipment and Rewards

Cosmetics unlock automatically from lifetime rewards: Comet Blade at 40 earned
Starfruit and Dragon Fang at 110; Sunset Harbor Dojo at Level 3 (560 XP) and
Storm Temple Dojo at Level 5 (1120 XP). Bamboo Blade and Great Wave Dojo start
unlocked. Starfruit is never spent, and unlocks remain available as rewards grow.
The profile shows visual previews, requirements, remaining progress and objective
payouts. Equip an unlocked blade or dojo to change the live trail or background;
both choices survive reload. New rewards appear on the results screen with an
equip button, followed by replay or a shortcut to all equipment. These choices
change appearance only.

## Audio and Slice Feedback

Action audio layers a blade sweep, cut and juice droplets, with three cut
variations and two explosions. Larger gesture combos raise a short chord;
power-up activation and expiry use separate rising/falling cues. Eight active
effects share a voice budget, and bomb/game-over cues briefly duck music.
For listening QA, run `bun run audio:preview` and open the generated page.
It uses the default effects mix; also check rapid groups with music in the game
on headphones and phone speakers. Generated WAVs and the page are ignored by Git.

The HUD displays score, lives or time, stroke combos, timed streaks and power-up
remaining durations. Results include fruit sliced, misses, bomb hits, best stroke
combo, peak streak and stroke accuracy (fruit-hitting gestures / moving gestures).
A stroke combo counts fruit cut during one held gesture; three fruit earn a
15-point bonus, with 5 more for each additional fruit. Separate swipes never
combine into a stroke combo. A timed streak chains cuts within 320ms and raises
the fruit multiplier by 0.25 for every five hits after the first (sixth hit:
×1.25), capped at ×2. Bonuses and multiplier
limits are configurable through the headless engine's scoring options.

## Spawn and Power-up Rules

The spawn director opens each mode with three safe solo fruit, then alternates
fans, ladders, side launches, combo groups and recovery beats. Classic ramps
survival pressure; Arcade builds toward a timed crescendo; Zen stays relaxed.
Bomb budgets and separate trajectory lanes preserve a safe fruit corridor.

Arcade pickups refresh their own fixed duration; different types run together.
Freeze slows object motion while the round and pickup clocks continue. Frenzy
removes existing and queued bombs, then suppresses new bombs until it expires.
Double points multiplies fruit, pickup and stroke-bonus points; streaks multiply
fruit points only.
See [simulation rules](src/game/systems/README.md) for duration and pressure budgets.

## Saved Progress and Goals

Rewards require a completed run lasting at least five seconds, at least one
fruit sliced, and a positive score. Flawless bonuses require zero misses and zero
bomb hits in every mode. Recent run IDs prevent duplicate payouts; versioned
storage migrates existing profiles/preferences and validates fields independently.
Results show per-mode best scores, starter objectives, mode achievements and
challenge progress. Six permanent achievements reward Classic survival/safe
cuts, Arcade score/stroke combos and Zen harvest/accuracy. Three challenges
(one per mode) rotate through harvest, practice and stroke-combo sets after all
three finish. They have no expiry or daily streak, and partial progress survives
time away. Each achievement pays once; each challenge pays once per set.
Profile and results suggest a next goal with a button to play its mode.

Progress, settings, best scores, help acknowledgement and equipment use validated
browser-local storage. Clearing site data removes them; they do not sync between
devices. If storage is blocked, play and in-session choices remain available.

## Artwork and Presentation

Saftladen uses a citrus fruit-stall wordmark, cream/citrus/coral/leaf colors,
matching UI/canvas typography and consistent controls. Opaque panels and a
shaded board header keep text readable against the wood; sprites share one
aspect-preserving visual diameter. The wordmark needs no image or web font.

Before the first run, the menu loads and decodes the required gameplay
artwork. Failed or timed-out images keep play disabled until you retry or choose
**Play with simple artwork**. Successful images are retained during retries;
music continues to load on demand.

## Release Checks

Pull requests run lint, unit and browser regression tests, and a production build. Passing builds
on `main` deploy to GitHub Pages under `/Saftladen/`. Gameplay artwork is
precached for offline reload; music is cached after its first requested playback.
Run `bun run build`, then `bun run preview` and open
`http://localhost:4173/Saftladen/` to check the production build locally. The
development server uses `/`; the production base, manifest scope and worker
registration use `/Saftladen/`. When changing deployment location, update
`vite.config.ts` and the canonical/Open Graph URLs in `index.html` together.

Updates wait for **Update game** on the menu or results screen. Runs, pauses,
practice and ready countdowns never reload automatically, including when another
tab accepts an update. Saved progress, equipment and settings survive the reload.
An interrupted first install retries registration on reconnect or return to the
page; failed artwork still offers **Retry artwork**. Offline reload requires a
completed initial cache installation. See [offline/update checks](docs/PWA.md).

The automated suite currently has 186 Bun tests and 28 production Chromium
checks. It covers lifecycle/contact/scoring, saved rewards/equipment/goals,
keyboard/dialog flows, audio decoding and real offline/update recovery. Installed
iOS/Android behavior, physical touch calibration, headphone/phone listening,
human mode/reward balance and long-session device performance remain pending.
The host renderer benchmark records variable repeat timings, not validated mobile
FPS or input latency. See [performance evidence](docs/PERFORMANCE.md),
[offline verification](docs/PWA.md) and [the active backlog](PLAN.md).
