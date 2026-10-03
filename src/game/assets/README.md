# Game Assets

`manifest.ts` imports 18 required images (gameplay sprites and background) from
`src/assets`. Vite supplies fingerprinted URLs using the deployment base. The
wordmark is semantic text and an inline SVG; it requires no title image. The
manifest has no placeholder atlases or unused audio URLs.

`gameAssets` is a shared, module-level image loader. React subscribes to its
readiness snapshots and starts loading once at startup. Images become ready only
after the request, decoding and positive-dimension checks succeed. Loading and
decoding have a 20-second timeout. Concurrent requests and StrictMode remounts
share the same promise and decoded images.

The mode buttons stay disabled while artwork loads or fails. A failed attempt
shows retry and an explicit simple-artwork option. Retry retains successful images
and requests only failures. Procedural fallback gameplay requires the user's
simple-artwork choice; it never silently replaces failed required images. The
renderer draws the same decoded HTMLImageElements held by this loader and does
not issue independent image requests. The idle menu can render a procedural
background while its required artwork is being prepared.

Music remains loaded on demand by the audio service. No image-loading operation
starts music or waits for audio.

The production worker precaches every required image; music uses a runtime cache
after playback is requested. A completed first installation is required for full
offline reload. See [offline/update policy](../../../docs/PWA.md).

`preload.ts` exports the generic loader with injectable image creation and timeout
for deterministic loading, decode-failure, retry and timeout tests.
