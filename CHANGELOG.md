# Changelog

All notable changes to the site are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
semantic versioning, and each tag is a deployable snapshot of `dist/`.

## [0.6.0] - 2026-11-10

### Changed

- **Text is geometry.** Every letter on the machine — window letters, key legends, socket
  letters, the reflector label, the operator's note — is emitted as quads in the scene, so it
  foreshortens with the camera, sorts with the parts and is occluded by them. The 2D overlay
  is gone, and with it the class of bug where a label drifted out of register.
- **Four backends, one ladder.** WebGPU, then WebGL2, then WebGL1, then SVG polygons. The
  same triangle list goes to whichever one answers; nothing is drawn by one path and missed
  by another.
- The camera fits the machine's bounding sphere instead of guessing from the window shape, so
  zoom works at any size and survives a rotation of the device.
- The deck is tiled rather than one quad: a painter's algorithm sorts by a face's average
  depth, and one enormous quad painted over the keys printed on its far half.
- The install banner sits at the top, "Not now" dismisses it for three days, and it no longer
  needs a refresh to come back.

### Added

- A console recorder in settings, for phones with no console: the last 200 lines, copyable.
- Full screen for the 3D view, a plugboard close-up, and a control-size preference.
- An operator's note card beside the machine, written on by hand and kept on the device.

## [0.5.0] - 2026-11-10

### Changed

- The interface is a calculator, not a document. The readout sits at the very top of the
  screen, the keys take the height that is left, and every setting moved into a sheet that
  slides up from the bottom. Nothing scrolls, on any phone.
- The machine has its own materials. A walnut-dark case, a brass reflector, blue, green and
  ochre wheels, ivory keys, amber lamps and brass sockets — the object keeps its colours
  whatever theme the page is in.
- The 3D view lost its duplicate readouts and its second keyboard: the machine is the
  keyboard.

### Fixed

- The first tap on a phone was swallowed: the page was a few pixels taller than the
  viewport, so the browser scrolled during the gesture and the tap landed somewhere else.
  The shell is now locked to the viewport.
- The install banner could appear mid-gesture and move the key out from under the finger;
  it now waits until a gesture has finished.

## [0.4.0] - 2026-11-10

### Added

- One rendering pipeline for the machine, with three backends: WebGPU, then
  WebGL2, then a 2D canvas. The machine no longer depends on SVG for its discs.
- A complete 3D model — case, lid, rotor stack, reflector, keyboard, lampboard and
  plugboard — as a single scene you can orbit.
- Custom machines as a first-class model: the maths lives in the core library,
  the site renders whatever parts a model declares.
- An install banner that appears on its own once the app is installable, and stays
  dismissed once dismissed.

### Changed

- The shell is a modern app: sticky header, a bottom action bar on phones, an icon
  set, and a layout that uses the width it has on a desktop.
- Release notes now contain only the section for the version being released.

### Fixed

- The release workflow repeats the CI steps; it now calls the CI workflow instead.
- The case no longer clips the rotor it encloses: the library now measures a wheel by its
  circumference rather than its bounding square.

## [0.3.0] - 2026-11-10

### Added

- Two interfaces over one machine: a form and a 3D model, sharing one state.
- A settings dialog with four themes, a renderer choice and a motion switch.
- `about.html` and `facts.html`, with per-page metadata, JSON-LD and a sitemap.

## [0.2.0] - 2026-11-10

### Added

- WebGPU discs with an SVG fallback, drawn from the library's projected scene.
- The manual experience: lid, orbit, zoom, rotor stepping and swapping.
- A builder for machines with up to a hundred rotors, and a key-space explorer.
- Playwright smoke tests on two viewports, in CI.

## [0.1.0] - 2026-11-10

### Added

- The static shell: Preact, Vite 8 (Rolldown), a service worker with a real precache
  manifest, a web app manifest, a standalone 404 page and a `<noscript>` fallback.
- A first working simulator pinned to `@enigma-lab/core` by sha256.
