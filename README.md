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

`sample-video.mp4` is placeholder CC0 flower footage from MDN: https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4

`soundtrack.json` is a snapshot of 962 direct audio links from https://jamminstein.github.io/acervo-public/. Files stream from the original audio repositories; no audio collection is duplicated here.

The portrait was supplied by Tiago, with its baked checkerboard removed using image generation. Its frame outline is an SVG drawing.

The unused experimental `glass.js` and `vendor/liquid-glass/` are retained with the upstream MIT license; the current page does not load them. Upstream: https://github.com/ccl125/liquid-glass

## Deployment

Buildless static website. GitHub Pages serves the main branch root. All media and module references are relative, allowing deployment under a repository path. No secrets or build dependencies are required.

## Verification

Script initialization, mesh operations, morphing, audio transport, fade-in, volume, and handwriting rendering were checked with simulated browser/media objects. Real browser rendering, native gestures, and mobile audio policies still require device testing.
