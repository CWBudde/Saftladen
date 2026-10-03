# Game Layer Architecture

This folder contains the imperative game runtime and its React UI adapters.
React mounts the canvas, renders overlay UI, and forwards user intents to the game API.

## Folder Roles

- `core/`: runtime loop primitives and stage integration (`requestAnimationFrame`, canvas mount lifecycle).
- `engine/`: deterministic simulation lifecycle and game state transitions.
- `systems/`: simulation systems that mutate state in place for hot-path performance (spawning, physics, slicing, scoring, particles).
- `model/`: shared domain types and factories for entities/world state.
- `render/`: canvas renderer implementations and draw helpers.
- `input/`: pointer/touch trail capture and coordinate conversion.
- `ui/`: React-facing adapter helpers for HUD/menu state.
- `assets/`: game asset manifests and loading metadata.
- `audio/`: layered sound generation, playback, voice limits and music mixing.

## React Boundary

React components can:
- mount/unmount the game canvas
- display HUD/menu/settings state snapshots
- dispatch high-level commands (`start`, `pause`, `resume`, `reset`)

React components must not:
- run simulation steps
- mutate world state directly
- perform per-frame entity rendering logic

`App.tsx` owns the engine/audio services, launch preparation, reward settlement,
equipment commands and safe update acceptance. [MenuScreen](ui/MenuScreen.tsx),
[ProfilePanel](ui/ProfilePanel.tsx), [PauseOverlay](ui/PauseOverlay.tsx) and
[GameOverOverlay](ui/GameOverOverlay.tsx) receive copied UI values and command
callbacks. They preserve the existing DOM structure and share native
[GameDialog](ui/GameDialog.tsx) focus handling. App supplies live announcements
inside profile/results dialogs and gates update notices before passing them in.
[useGameKeyboard](ui/useGameKeyboard.ts) owns global shortcuts, interactive-target
guards and held Space/Escape suppression across modal autofocus, including
capture-phase keyup and blur cleanup. It sends engine commands without running
simulation or subscribing to gameplay events.

## Debug Flag Convention

`VITE_DEBUG=1` sets the initial overlay state through `isGameDebugEnabled()` in
`src/game/debug.ts`. The `D` shortcut toggles it at runtime, including production.
The overlay shows timing, trails, trajectory envelopes and the next spawn pattern.
The build retains runtime instrumentation. Analytics remains optional backlog.

## Simulation contracts

The RAF controller passes elapsed time to the headless engine; the engine owns
the fixed-step accumulator, phase transitions and system ordering. Systems mutate
engine-owned state in place. Geometry helpers are pure, but the system pipeline
is not; deterministic behavior comes from explicit clocks, inputs and seeded RNG.
See [system contracts](systems/README.md#system-contracts) and
[engine API notes](engine/README.md) before changing the simulation.

`getState()` and state subscription payloads are borrowed views of mutable state,
not immutable snapshots. Renderers read them synchronously. React uses
`selectGameUiSnapshot` to copy the relevant primitive values and counters, and
retains the prior snapshot when visible values do not change. Presentation-event
batches are copied/frozen separately and are safe to retain across steps.

## Input and Runtime Ownership

`core/gameCanvasController.ts` owns pointer listeners, cached canvas metrics,
the frame loop, and rendering. `GameCanvasLayer` only mounts and disposes it.
Fresh raw pointer segments queue before simulation and are consumed once on the
next fixed step. Each pointer-down allocates a new stroke ID; movement chunks
retain it across fixed steps, and release sends an end marker even if the last
movement was already consumed. The visual trail has its own 150ms fade and cannot cause cuts.
Pointer-up preserves pending movement; cancellation, phase changes, resize, and
backgrounding clear input. Sensitivity changes the movement threshold (120 world
units/second, converted through the viewport scale and divided by sensitivity).

`core/viewport.ts` defines an adaptive playfield with a 720-unit shorter edge and
one uniform transform for positions, radii, input and debug probes. The canvas
controller sends viewport bounds through `engine.setWorldBounds`; React never
mutates world geometry. Resize keeps entity radii fixed in world units, remaps
live and pending launches, preserves exterior margins, and adjusts velocity to
preserve normalized ballistic arcs. Flight time scales with the square root of
the world-height change; mode clocks and spawn deadlines remain unchanged.

`core/practiceCanvasController.ts` owns a static practice apple, event-driven
rendering and fresh pointer movement through the same tracker/collision helpers.
`ui/PracticeSwipe` mounts it and displays discrete success/miss feedback. It has
no game engine, frame loop, gameplay RNG, scoring or reward settlement. Its
velocity threshold follows the full playfield scale and saved sensitivity.

`ui/OnboardingDialog` offers optional first-run practice and repeatable menu
help. A separate versioned acknowledgement remembers completed/skipped help;
blocked storage still permits play and retains acknowledgement for the session.
`ui/ReadyCountdown` keeps the engine idle for three seconds before `App` sends
`setMode`/`start`. Blur/hidden pages suspend it until explicit continuation;
cancellation/unmount discards pending timers. Replay and restart use the same
preparation flow, leaving the full mode duration available to the real run.

## Events, Statistics and Determinism

The engine exposes `subscribeEvents` alongside UI snapshot subscriptions. It
publishes frozen, ordered event batches once per command/advance, preserving
slice, miss, bomb, power-up activation/expiry and run-end events across catch-up
steps. Audio and rewards consume these payloads; `App` does not read simulation
world fields. Run-end includes a unique run ID and copied authoritative counters.

`ui/eventFeedback.ts` maps ordered events into audio cues; growing stroke combos
carry a playback rate rising by one semitone per additional fruit, capped at four.
Timed streaks retain the ordinary slice cue. `audio/soundDesign.ts` defines layered
recipes: blade/cut/juice, explosion transient/body/tail, and rising/falling chords.
The audio service bakes eleven mono PCM WAVs on first unlock and selects cut/bomb
variants round-robin. Layers are premixed into one voice per cue, with 12% sample
headroom and click-free envelopes. All noise streams and selection state are
audio-local, independent of engine RNG; there are no external sample downloads.
The shared eight-voice limit also counts sounds awaiting decode. Every variant
receives master-volume updates, every playback resets its rate, and `stopAll`
stops voices, unloads variants, revokes URLs and resets selection/ducking.
Bomb/game-over duck music to 35% for 650ms, then restore the current saved volume.
`bun run audio:preview` generates ignored WAVs and a page for subjective listening;
automated signal/browser checks do not establish comfort on physical speakers.

`score.combo` remains the legacy field name for timed streak hits;
`score.strokeCombo` counts fruit in the latest moving gesture, and
`score.streakMultiplier` holds the capped fruit multiplier. Three fruit in one
stroke earn a bonus; additional fruit award incremental bonuses. `stroke-combo`
events drive audio and announcements. Stats distinguish moving gestures,
fruit-hitting gestures and peak stroke combos. Scoring configuration is supplied
through `createGameEngine({ scoring: ... })` and survives run/mode resets.

Physics captures sliceable centers before movement only when fresh input exists.
Collision checks the swept circle capsule between the old and new centers, so
a swipe through the last rendered fruit remains valid. This is conservative
within one simulation tick: input and simulation clocks are not synchronized to
infer exact simultaneous contact. No historical visual trail is reused. Contacts
resolve by input timestamp, stroke/pointer IDs, segment fraction and entity ID;
entity-map insertion order cannot reorder a bomb and fruit. Feedback begins at
the earliest blade surface contact.

The authored spawn director derives its rhythm from mode progress and wave count.
Hazard budgets include active and queued bombs, with conservative ballistic
envelopes separating hazard and fruit lanes. Debug rendering shows these boxes
and the upcoming pattern. See [systems rules](systems/README.md) for pressure and
power-up policies.

Spawn randomness and cosmetic randomness use separate seeded streams. Engines
allocate gameplay IDs locally; effects use a separate negative-ID sequence.
Disabling cosmetic effects cannot change the subsequent spawn schedule or score.
Slash direction drives fragment separation and juice spray, while local cut
angles preserve the original fruit pose for complementary clipped sprites.

The renderer scans entities once into reusable layer buffers, caches sprite
size factors, and uses scalar coordinates/opacity in the entity draw paths.

[`render/renderer.ts`](render/renderer.ts) owns asset snapshots, per-renderer
caches and layer order: board, decals, whole objects, halves, particles, score
labels, trails, impacts and debug overlays. [`entityLayers.ts`](render/entityLayers.ts)
draws objects/fragments and juice with the shared sprite-size cache;
[`feedbackLayers.ts`](render/feedbackLayers.ts) draws score labels and fading
cosmetic trails. [`backgroundLayer.ts`](render/backgroundLayer.ts) handles image
cropping and fallback painting, using [`woodTexture.ts`](render/woodTexture.ts)
for deterministic procedural wood before decoding or during simple-artwork play.
Shared renderer contracts live in [`renderTypes.ts`](render/renderTypes.ts), so
draw modules depend on types without importing the renderer factory. All layers
read the borrowed state synchronously; they never mutate simulation or consume
gameplay RNG.

The canvas controller also forwards ordered presentation events to the renderer
once per frame, including every catch-up step. `render/impactFeedback.ts` owns
contact-centered combo bursts and bomb rings/penalty labels. It retains at most
12 impacts, coalesces growing combos by stroke ID, and ages effects on the RAF
clock (360ms combos, 700ms bomb labels, 220ms bomb flash), including after
game-over or while paused. Run changes/menu reset the effects. Normalized impact
positions survive rotation. These effects consume no RNG and change no simulation
state, timers or input mapping. Reduced motion suppresses rings/flash while
retaining static bomb labels and the existing score/combo text.

The asset manifest references the actual imported sprite/background URLs.
A shared loader owns decoded images, progress and retry state independently of
React mounts. The menu gates run starts until decoding succeeds or the player
explicitly chooses simple artwork after a failure. The renderer consumes this
same decoded cache rather than starting a second set of image requests.

The presentation palette and font stack live in `src/index.css`; controls inherit
that font, and canvas score/impact text uses the same stack. `SaftladenBrand` is
semantic text with a decorative inline citrus SVG, so branding is available
before image decoding. Panel surfaces are opaque; a board-header gradient is
drawn behind objects for HUD contrast. `getSpriteScale` gives whole fruit,
fragments, bombs and practice art the same 2.3-radius maximum dimension while
preserving aspect ratio. Presentation sizing does not change collision radii.

## Cosmetic reward policy

`ui/cosmetics.ts` is the shared catalog and ownership resolver. Starfruit is a
lifetime earned counter, not a spendable wallet. Blades unlock at 0/40/110
Starfruit; dojos unlock at Levels 1/3/5 (0/560/1120 XP with 280 XP per level).
Unlocks are automatic, cumulative and cosmetic; resolving ownership never
mutates the profile. Existing version-2 and migrated unversioned profiles retain
their counters and therefore their unlocks, without a second ownership ledger.
Equipment uses a separate version-1 `saftladen.cosmetics.selection` save, leaving
earned reward counters unchanged. Reward schema v3 adds progression fields and
migrates v2/legacy profiles without re-awarding completed starter objectives.
Each blade/dojo ID is validated
against the catalog and earned totals on load/save; unknown or locked IDs fall
back independently to Bamboo/Great Wave. Missing, malformed or blocked storage
leaves usable starter equipment, and blocked saves retain in-session choices.

React owns equip commands and previews (`ui/CosmeticCard.tsx`). The canvas
controller reads the selected IDs as presentation preferences each frame without
remounting the runtime or passing them into the engine. `render/cosmeticArt.ts`
draws both previews and live artwork: cream/green, ice/violet and gold/ember
trails; wood/waves, sunset harbor and moonlit temple backgrounds. Trail width,
expiry, input geometry and scoring remain shared. Static canvas scenery adds no
bitmap downloads or gameplay random calls. Reduced motion retains the selected
appearance without introducing animations or flashes.

`render/boardCache.ts` retains one complete static board surface per renderer:
background, dojo scenery and HUD shade. CSS/backing dimensions, DPR, dojo and
decoded background identity invalidate it; changing size/equipment reuses the
same surface. The cache keeps native backing-store resolution, consumes no RNG
and leaves simulation untouched. If offscreen drawing is unavailable, direct
drawing remains usable. The separate production fixture and measured memory
tradeoff are documented in `docs/PERFORMANCE.md`; it is excluded from deployment.

Run settlement compares earned totals before/after to celebrate newly crossed
milestones once. Results offer direct equip buttons, per-mode best, all objective
progress, replay and a shortcut to the full equipment panel. Equipping never
settles a run, spends currency, or automatically replaces an existing selection.

Eligible runs last at least five seconds, score above zero and slice fruit.
Base Starfruit is `floor(score / 70) + max(0, peakTimedStreak - 2)`, plus two
for zero misses/bomb hits. Objectives add 10/16/24 Starfruit once (runs/streak/score).
XP and reward settlement rules remain in `ui/rewards.ts`; recent run IDs prevent
duplicate payouts. The profile displays lifetime totals, exact unlock thresholds,
remaining XP/Starfruit and objective payouts.

## Progression goals

`ui/progression.ts` defines six permanent mode achievements and a completion-driven
challenge board. Three slots (one per mode) cycle through 20 cumulative fruit,
two eligible runs and a three-fruit stroke. Progress never expires; there are
no date/streak gates. Completing all slots rotates the board after settlement;
the closing run does not contribute to the next board. Targets and payouts are
rehydrated from canonical templates. Only bounded board index/progress and
permanent achievements are stored, alongside the existing recent-run ledger.
Achievement/challenge bonuses join the same eligible, exactly-once settlement,
and duplicate/ineligible runs cannot progress or rotate goals. Accuracy requires
20 fruit and 10 successful strokes; its threshold uses the unrounded ratio.
Classic safe cuts reject bomb-hit runs; survival requires 20 fruit. Base reward
formulas are unchanged. `getNextGoal` prefers pending goals in the selected mode,
then other modes when that mode's goals are done. React displays progress and
dispatches ordinary mode/countdown commands; goals never mutate simulation.

An automated arithmetic baseline repeats 210-point/20-fruit runs with peak timed
streak three, one miss, 10/12 successful strokes and a three-fruit stroke combo:
four base Starfruit per run, plus ten on the fifth run. With new goal bonuses,
Classic reaches Comet/Dragon Fang at runs 2/17, Arcade at 7/24, and Zen at 5/20.
Both later dojos still unlock by run eight, without streak/score starter-objective
bonuses. This verifies a repeatable
progression route under those inputs; measured human playtests must establish
whether these scores and unlock times feel attainable on mouse/touch devices.

## Installation and updates

`ui/pwaUpdates.ts` owns native production service-worker registration, reconnect
recovery and discrete update availability. React subscribes to those values and
offers deliberate acceptance on menu/results. Controller changes never reload an
active or paused run; acceptance blocks launches and waits for activation before
the safe UI boundary reloads. This is independent of engine state and reward
settlement. See [PWA policy and verification](../../docs/PWA.md).
