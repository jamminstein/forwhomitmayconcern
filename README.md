# Tiago Pereira — to whom it may concern

Interactive artwork at https://tiago.lol/: a 25-point Bézier mesh, handwritten notes and controls, Acervo music, and a small playable drum machine.

## Run, build, and check

Use Node.js 22 or newer. Run `npm ci`, then `npm run serve` and open http://127.0.0.1:8766/. The server supports media range requests. JavaScript modules require HTTP rather than opening index.html directly.

`npm run build` creates `dist/`. It includes only the current artwork and runtime assets, rewrites all module references to one content-derived release version, and writes `release.json`. `site-config.js` is the source of truth for the main video, manifest, and poster. `writings.json` supplies the semantic text inserted into the built HTML; handwriting renders from that same HTML.

For the complete browser checks:

```sh
npx playwright install --with-deps chromium webkit
npm run build
SITE_ROOT=dist npm run check
SITE_ROOT=dist npm run serve
# In another terminal:
npm test
```

`BASE_URL` can point the tests to another preview port. Tests cover desktop and five touch layouts, undo and keyboard controls, email copying, WebGL loss/restoration, autoplay, delayed mixer startup, rapid track changes, reduced motion, and recoverable media failures. Audio tests generate their own short WAV fixture. They do not modify the soundtrack collection. Native Safari listening, actual device performance, and trackpad gestures still need device testing.

## Interaction

- Drag anchors or tangent handles. Guides appear on hover/focus and fade after inactivity.
- Drag near the video's center, or hold Space and drag, to move it. The top-right trace resizes; the top-left trace rotates. Clicking either trace restores that transform. Pinch resizes the artwork.
- The large scribble makes a wild warp. The looping petals toggle continuous morphing. Editing a point stops morphing.
- Command-Z or Control-Z undoes shape and view edits. One drag is one edit; continuous zoom input is grouped. No artwork is persisted between visits.
- Tab enters the mesh once. Arrow keys select points, brackets select tangent handles, and Enter toggles editing. While editing, arrows move the selected point; Shift makes finer adjustments. Escape exits editing; Tab leaves the mesh. The transform traces also accept arrows and Enter.
- The three drum pads respond to clicks or J/K/L. The small refresh drawing loads a new kit. Drag the drum's center trace to place it; its arrows work from keyboard focus.
- Music controls navigate the shuffled Acervo collection. The volume slider controls the shared mix. The waveform links to Acervo; the envelope copies `tiagopereira@me.com` and confirms only after a successful copy. If browser copying fails, a selectable address appears.
- A visual pause control is available on keyboard focus and for reduced-motion visitors. Pausing keeps the artwork's shape and stops automatic visual motion. Music is independent. Failed artwork playback exposes the same small control as a retry action.

The default handwriting remains unchanged. `?readability=1` is an optional comparison with a faint, theme-aware halo around the writing. On touch layouts the video stays fixed above the scrolling text. The transport stays reachable at the viewport bottom, with invisible touch targets around its small drawings. The drum and contact controls remain usable when overlapping the video.

## Runtime responsibilities

- `app.js`, `undo-history.js`: mesh geometry, transforms, interaction, and bounded undo history.
- `warp-renderer.js`, `renderer.css`: GPU resource lifecycle, drawing-buffer sizing, and ordinary-video fallback when graphics are unavailable. Context restoration retains the mesh.
- `video-source.js`, `video-playback.js`: source selection, autoplay, bounded retries, visibility and motion preferences.
- `soundtrack.js`, `audio-mixer.js`: playlist, playback intent, transport fades, and shared music/drum routing.
- `drum-machine.js`, `drum-layout.js`: kit loading/playback and collision-aware placement.
- `handwriting.js`, `song-id.js`, `brand-strip.js`, `contact.js`: text and identity UI.
- `waveform.js`, `morph-icon.js`, `favicon.js`, `dancers.js`: small visual details. They honor visual-pause preferences.
- `styles.css`, `contact.css`, `readability.js`: layout, focus/touch presentation, and the optional reading experiment.

## Media and performance

The current artwork is an 82.3-second H.264 video at 1920×1080 and 24 fps, without source audio. Safari uses the fast-start MP4 for reliable autoplay and WebGL texture updates. Other compatible browsers use native HLS or the locally bundled MIT-licensed hls.js 1.7.3 light build. The 480p/720p/1080p renditions have aligned two-second segments. Playback starts small and adapts without a screen-size cap. A first-frame poster is rendered through the mesh until a decoded frame arrives. Media is hosted on GitHub Pages and buffers separately from the page.

Textures upload only when decoded video frames change. Mesh interaction stays on the display animation clock. Hidden guides and unchanged transforms/waveforms skip DOM writes. The main video pauses and HLS stops loading while the page is hidden, resuming when visible unless deliberately paused. Reduced-motion visitors start with the poster and can deliberately start the artwork. Secondary motion also respects visual pause; only one of the five small CORPUS renders is selected and loaded.

`soundtrack.json` contains 962 direct links from https://jamminstein.github.io/acervo-public/. The files remain on their original repositories. Startup waits for mixer readiness, begins at zero gain, and fades to a low default level. Next/Previous uses a brief fade before switching; the latest playback intent wins. Recoverable failures retry twice, then wait for a manual retry or restored connectivity.

The drum selection contains 16 normalized mono WAV files per category from the local Sample Stacker collection. Only material recorded as CC0/public-domain in its provenance was included; see `drum-samples/SOURCES.json`. The full library is not uploaded. Music and drums share a compressor and soft ceiling. Per-class active-RMS normalization and peak headroom balance hits; hats choke their preceding tail.

Five transparent 36.8-second CORPUS collages are 96×128 pixels. Their provenance is in `dancer-sources.json`; the other four are never preloaded. The portrait is a lossless WebP matching the original cutout's pixels. Logos use transparent noise masks rather than opaque stripes.

The favicon has a 16-frame GIF plus a script that replaces one icon link with successive PNG frames. Browsers may suppress tab-icon animation. Reduced motion and visual pause intentionally freeze it.

## Deployment

GitHub Pages uses the Actions workflow in `.github/workflows/pages.yml`, not the repository root. Every publication installs pinned test dependencies, builds `dist`, checks references, and runs Chromium/WebKit regressions before uploading and deploying the artifact. Pull requests run the same verification without publishing. Compare live `release.json` with the locally built file to identify the deployed release.

Old media, prototype sources, and third-party license files remain in Git history/the checkout as appropriate; obsolete video versions and unused experiment modules are excluded from the deployed build. The unused liquid-glass experiment retains its upstream MIT license: https://github.com/ccl125/liquid-glass.
