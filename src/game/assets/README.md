# Game Assets

Store original project assets and their metadata here.
Do not import copyrighted Fruit Ninja assets.

Current Phase 7 scaffolding:
- `manifest.ts`: image/audio key maps and expected file paths
- `preload.ts`: image preload helper with decode completion and optional `createImageBitmap` usage

Planned runtime flow:
1. Load `IMAGE_ASSET_MANIFEST` at startup
2. Decode images before gameplay (`preloadImageAssets`)
3. Prefer `ImageBitmap` on supported browsers; fallback to `HTMLImageElement`

Future additions:
- concrete atlas metadata (frame rectangles)
- audio decoding/preload service
- cache/versioning strategy
