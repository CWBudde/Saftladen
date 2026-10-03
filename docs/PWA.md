# Offline installation and updates

The production build at `/Saftladen/` precaches the HTML, bundled code/styles,
manifest/icons and all 18 decoded gameplay images. Music uses a separate runtime
cache after requested playback. The splash screen is excluded from precaching.
An incomplete first download cannot provide a full offline game: required
artwork offers retry or an explicit simple-artwork choice.

`vite.config.ts` generates a waiting worker (`skipWaiting: false`) with client
claiming. `src/game/ui/pwaUpdates.ts` owns native registration and discrete
update snapshots; `src/App.tsx` owns the update action and reload boundary.
The Workbox runtime is inlined into `sw.js`, so its activation-message handler
registers synchronously when the worker starts. Acceptance resolves the current
registration; failed activation restores the action after at most 15 seconds.
There is no automatic registration script or automatic reload listener.
Reconnect and foreground return check for updates. If a failed first install
removes its registration, the next check registers again rather than updating
the obsolete handle. Registration failures leave the existing game usable.

An installed update appears on the menu or results as **Update game**. The
action sends Workbox's `SKIP_WAITING` message and waits for activation before
reloading. New runs cannot launch during that action. Running/paused games,
practice and ready countdowns have no update action. A controller change from
another tab records availability without reloading this tab; the player can
finish or leave the run and accept the update afterward. Profile settlement
and saved equipment/settings stay independent of service-worker state.
Closing all controlled tabs also lets the browser activate a waiting worker
normally; the next launch uses that version.

This policy applies to clients running this version. An already open older
version retains its earlier automatic-update listener until it loads the new
code; changing the new build cannot change that old tab's running JavaScript.

## Automated verification

```sh
bun run build
bunx playwright install chromium
bun run test:browser
# Only the offline/update cases:
bun run test:browser tests/browser/offline.pw.ts
```

Ordinary game smoke checks block workers for isolation. The five offline/update
cases enable real Chromium workers with a fresh context per test. A localhost
fixture on port 4175 serves the actual `dist` build; it can fail downloads or
change the generated worker's HTML precache revision and an HTML release marker.
Failure cases wait for recorded worker fetch failures before checking recovery.
The fixture is tooling only and is not bundled into the game or deployed.
No service-worker APIs, caches or game state are mocked. It checks:

- Offline reload, decoding all 18 gameplay images, and starting Zen.
- Interrupted initial artwork/precache downloads, retry/reconnect recovery,
  completed installation and subsequent offline reload.
- Failed update installation retaining the previous offline HTML/artwork,
  then successful retry and deliberate activation/reload.
- Waiting updates and activation accepted in another tab preserving a paused
  run, resumption, and later acceptance with saved rewards/equipment intact.
- A waiting update through the ready countdown and an entire 90-second Zen
  run, remaining on the old HTML until accepted from results.

The existing CI browser step runs these checks before publishing. This is
Chromium evidence; installed iOS/Android behavior, physical touch and storage
eviction remain physical-device QA.
