# Shipped asset compression

The 2026-10-04 Phase 14.8 pass replaces all 17 transparent gameplay PNGs with
lossless WebP. Encoded sprite payload falls from **2,769,288 to 1,979,554 bytes**:
**789,734 bytes saved (28.5%)**. Dimensions and every decoded RGBA value,
including RGB underneath transparent pixels, match the originals. No resizing,
quantization or lossy recompression is involved.

The comparison uses source assets from commit `906dc35`, Python 3.12.4,
Pillow 10.3.0/libwebp 1.3.2 and ImageMagick 6.9.12-98/libheif 1.17.6.
WebP uses `lossless=True, quality=100, method=6, exact=True`. Pillow's
[`exact` option](https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html#webp)
preserves RGB in fully transparent pixels; quality controls compression effort
in lossless mode.

AVIF candidates use `-quality 100 -define heic:chroma=444 -define heic:speed=6`.
[ImageMagick documents quality 100 for lossless HEIC encoding](https://imagemagick.org/formats/).
That setting alone does not prove an exact RGB round trip: this local AVIF path
preserves alpha but changes 1,147,199 sprite RGB channel values by at most 1/255.
Its aggregate sprite payload is also 87,118 bytes larger than WebP. These results
describe this encoder/configuration, not every possible AVIF implementation.

## Candidate sizes

Sizes are encoded file bytes, before HTTP headers/compression. All sprite
sources are RGBA PNG; their selected replacements have the same stem and `.webp`.

| Asset          |    Original | Lossless WebP | AVIF candidate |
| -------------- | ----------: | ------------: | -------------: |
| apple1         |      190049 |        137514 |         136103 |
| apple3         |      204704 |        148904 |         150656 |
| banana1        |      106954 |         75288 |          80421 |
| banana3        |      109216 |         80066 |          85906 |
| bomb           |      131650 |         93080 |          88003 |
| freeze-glyph   |      132666 |         98206 |         126081 |
| melon1         |      136916 |         98936 |          96177 |
| melon3         |      149219 |         96366 |         103421 |
| orange1        |      229712 |        174054 |         166804 |
| orange3        |      229906 |        172974 |         182939 |
| orange4        |      179179 |        131908 |         137930 |
| pineapple1     |      192713 |        140410 |         146054 |
| pineapple4     |      155477 |        103028 |         113863 |
| pineapple5     |      154686 |        102420 |         114061 |
| starfruit1     |      164098 |        113478 |         113338 |
| starfruit4     |      141328 |         99436 |         105115 |
| starfruit5     |      160815 |        113486 |         119800 |
| **17 sprites** | **2769288** |   **1979554** |    **2066672** |
| background.jpg |      705432 |       2317360 |        2067635 |

The existing JPEG background stays: both tested candidates increase its
size substantially. Public favicon/install icons retain PNG. The splash screen
remains excluded from precaching. Music remains byte-identical, loaded on demand
and cached separately after playback. `ffprobe` reports MP3 audio at approximately
182 kbps (181,988 bits/s), 48 kHz stereo and 69.864 seconds; the previous plan's
64 kbps note was incorrect. The 1,605,118-byte file contains 1,589,112 bytes of
audio packets and an 11,353-byte attached JPEG cover. Removing the cover offers
little savings; further lossy audio compression requires listening evidence.

## Quality and deployment checks

Pillow decoding confirms identical dimensions and exact RGBA bytes for all 17
WebP replacements. Chromium also compares each original/replacement at scales
1, 0.5 and 0.17 on transparent, white, ink (`#17201c`) and citrus (`#edb553`)
canvases: 204 comparisons. Alpha is identical in every comparison. Chromium's
PNG/WebP premultiplication paths produce a maximum visible RGB difference of
1/255 over each opaque background. Unpremultiplying almost-transparent canvas
pixels can magnify that RGB difference; those raw canvas RGB values are not a
visible-error metric. The encoded RGBA pixels themselves remain exact.

The asset manifest and menu imports use WebP; Vite fingerprints the files at the
production base. Workbox's precache glob includes `.webp`, and the offline test
fixture serves `image/webp`. Retry/fallback checks target the new bomb URL.
The existing offline test must still decode all 18 required images with the
network disabled, catching any sprite omitted from the worker. Browser gameplay
and equipment checks exercise the actual decoded sprites and canvas treatments.

The production build still reports 29 precache entries (25 unique URLs; existing
public icon/manifest entries occur twice in the generated list). Its unique
encoded payload falls from 4,183,065 bytes / 4085.02 KiB to 3,393,348 bytes /
3313.82 KiB: **18.9% smaller**. The 789,717-byte deployment reduction differs
slightly from the sprite savings because the bundled import URLs add 17 bytes.
The background, music, public identity assets and CSS remain byte-identical.

All 188 Bun tests / 3,756 assertions, formatting, lint, typechecking, production
build and 28 production browser checks pass. An initial unlock/replay failure
exposed a stale position in the synthetic-clock swipe helper: its 1ms clock step
could cross a RAF/physics boundary before input. The helper now follows the
nearest freshly rendered fruit and crosses its center; scoring assertions stay
unchanged. Three targeted unlock/replay repeats and the full suite pass.

This measures encoded payload and decode/render correctness. It does not measure
physical-device startup latency, decoded image memory or installed iOS/Android
behavior. Lossless encoding keeps image dimensions and decoded memory requirements.

## Reproduce the selected conversions

Pillow is optional local measurement tooling, outside the Bun/CI dependencies.
With the recorded Pillow/libwebp versions, run this from the repository root;
all candidates go into ignored `output/asset-compression/`. Original PNGs remain
recoverable from Git history without keeping duplicate deployment assets.

```python
from io import BytesIO
from pathlib import Path
import subprocess
from PIL import Image

revision = '906dc35'
output = Path('output/asset-compression')
output.mkdir(parents=True, exist_ok=True)
names = subprocess.check_output(
    ['git', 'ls-tree', '-r', '--name-only', revision, 'src/assets'], text=True,
).splitlines()
for name in names:
    if not name.endswith('.png'):
        continue
    source = subprocess.check_output(['git', 'show', f'{revision}:{name}'])
    original = output / Path(name).name
    original.write_bytes(source)
    image = Image.open(BytesIO(source)).convert('RGBA')
    candidate = original.with_suffix('.webp')
    image.save(candidate, lossless=True, quality=100, method=6, exact=True)
    decoded = Image.open(candidate).convert('RGBA')
    assert image.size == decoded.size
    assert image.tobytes() == decoded.tobytes()
    assert candidate.stat().st_size < len(source)
    print(original.name, len(source), candidate.stat().st_size)
```

For an AVIF candidate, use ImageMagick to encode, decode it to PNG, then compare
RGBA bytes, per-channel maximum errors and alpha separately. Do not infer an exact
round trip from the quality setting alone.

```sh
convert output/asset-compression/apple1.png -quality 100 \
  -define heic:chroma=444 -define heic:speed=6 \
  output/asset-compression/apple1.avif
convert output/asset-compression/apple1.avif \
  output/asset-compression/apple1.avif-decoded.png
```
