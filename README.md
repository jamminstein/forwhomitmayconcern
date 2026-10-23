# Tiago Pereira — Living Image

An interactive moving-image website with a 25-point Bézier warp mesh, hand-drawn controls, continuously morphing shapes, and an independent Acervo soundtrack.

## Run locally

Serve this folder with a static HTTP server, for example `python3 -m http.server 8765`, then open localhost on that port. JavaScript modules and the soundtrack manifest require HTTP rather than opening index.html directly.

## Interaction

- Drag mesh anchors or their tangent handles. Editing guides fade after inactivity and start hidden.
- Drag the video near its center to move it. Space + drag also moves it.
- Top-left marker: drag to resize, click to restore the initial size. Top-right: drag to rotate, click to return upright.
- Pinch the trackpad to resize the video, or use the drawn horizontal slider.
- The changing scribble makes a wild warp; the looping scribble toggles continuous morphing. Dragging a mesh point stops morphing.
- The reset arrow appears after the mesh changes. It restores the mesh and view.
- Playback controls navigate the shuffled Acervo collection. The small vertical slider controls volume. Music tries autoplay, then retries on user interaction when blocked, fading in to a low default level.
- The sun/crescent toggles light and dark mode.

## Content and assets

`writings.json` contains Tiago's five passages. `handwriting.js` draws original upper/lowercase glyphs with slight variations on every load. The portrait links to Tiago's LinkedIn profile.

`tiago-2-3.mp4` is the supplied artwork, compressed to H.264 High Level 4.1 at 1080p / 24 fps (CRF 18, four reference frames, capped bitrate), without audio, with fast-start metadata for progressive playback. The soundtrack plays separately.

`soundtrack.json` is a snapshot of 962 direct audio links from https://jamminstein.github.io/acervo-public/. Files stream from the original audio repositories; no audio collection is duplicated here.

The portrait was supplied by Tiago, with its baked checkerboard removed using image generation. Its frame outline is an SVG drawing.

The unused experimental `glass.js` and `vendor/liquid-glass/` are retained with the upstream MIT license; the current page does not load them. Upstream: https://github.com/ccl125/liquid-glass

## Deployment

Buildless static website. GitHub Pages serves the main branch root. All media and module references are relative, allowing deployment under a repository path. No secrets or build dependencies are required.

## Verification

Script initialization, mesh operations, morphing, audio transport, fade-in, volume, and handwriting rendering were checked with simulated browser/media objects. Real browser rendering, native gestures, and mobile audio policies still require device testing.

## Drum machine and mobile canvas

A small three-pad drawing is playable by pointer/touch or J (kick), K (snare), L (hi-hat). Each load selects one different sound in each category from the previous session kit when available. The shipped selection has 16 normalized 44.1 kHz mono WAV files per category, sourced from the local Sample Stacker collection. Only layers recorded as CC0/public-domain in that collection's provenance were included; see drum-samples/SOURCES.json. The complete library is not uploaded. All public sample URLs are accessible to visitors.

The Web Audio mixer routes music and drums through a shared compressor and soft ceiling after a user gesture. The existing volume/fade controls drive both buses; per-class active-RMS normalization and peak headroom keep hits balanced. Hats choke their previous tail. Actual device latency, perceived loudness, and mobile browser policies still need listening tests.

On narrow screens the video stays centered in a fixed layer while the surrounding words, portrait, controls, drum drawing, and thank-you element scroll over a 240-viewport-height canvas. The video starts another 15% smaller than the earlier version. Logos use transparent scanline masks rather than painting background-colored stripes over the video. R/GA uses the wordmark without the isolated square. MESA is traced from the supplied logo image.

The favicon contains a valid 16-frame GIF and a script that replaces a single icon link with successive PNG frames for browsers that do not animate GIF favicons. Browser UI may still suppress tab-icon animation; reduced-motion preferences deliberately freeze it.

## Hidden CORPUS dancers

Five transparent 36.8-second dance collages sit behind the warped video. One is randomly selected per page load, excluding the previous session choice. Only that render downloads, at low priority after the main video has initial data; the other four are never preloaded. Eight real footage-cut phrases from the local CORPUS library crossfade into each continuous loop; provenance and file sizes are in `dancer-sources.json`. Renders are 96 × 128 pixels and use matching stills for reduced-motion preferences. No library runtime or source footage is loaded by the site.

### Adaptive artwork delivery

The current artwork uses `video/2-3/master.m3u8`: 480p, 720p and 1080p H.264 renditions with aligned two-second keyframes and fragmented MP4 segments. All assets are served by GitHub Pages. Safari uses the fast-start 1080p MP4 for reliable autoplay and WebGL texture updates; other compatible browsers use native HLS or the locally bundled MIT-licensed hls.js 1.7.3 light build. Playback starts at 480p in hls.js, then adapts without a screen-size cap, preserving access to full 1080p when bandwidth allows. The JS player keeps a short forward buffer rather than fetching the whole movie up front.

`video/2-3/poster.jpg` is a preloaded first-frame image rendered through the same WebGL mesh until a decoded video frame is available. `video-source.js` falls back to `tiago-2-3.mp4` on unsupported browsers or fatal HLS errors. Source audio remains excluded; Acervo plays separately. Custom local video uploads detach the adaptive player first.
