# Plan

## Phase 1 — scaffolding (done)

Repositories, toolchain, CI, tag-driven release, and a site that pins the release by
sha256.

## Phase 2 — the library learns to draw (done, v0.2.1)

A projected scene shared by every backend; a whole-machine SVG painter with no colours of
its own; key-sheet procedures; seeded key generation; the M4 key space corrected to 672
rotor orders; rotors laid out in a row, with honest zoom and aspect.

## Phase 3 — the site becomes a machine (done, v0.2.0)

- WebGPU discs with an SVG fallback, one scene and one hit test behind both.
- The manual experience: lid, drag to turn, scroll to zoom, tap to work a rotor, swap
  rotors in the stack, lamps that flash.
- The builder: up to a hundred rotors, custom notches, custom alphabet, seeded wiring.
- The key-space explorer, including the result that thirteen cables is weaker than ten.
- The signal panel: the six-letter indicator, and why it leaked.
- Playwright smoke tests on two viewports, in CI, on every pull request.

## Phase 4 — quality (in progress)

- Accessibility: focus order, reduced motion, machine labels. Largely done; a screen-reader
  pass over the builder is still owed.
- A sourced history page. Done as a section; a dedicated page with citations is next.
- `CONTRIBUTING.md` and `ARCHITECTURE.md`. Done.
- A Lighthouse budget on the deployed page.

## Not planned

No backend, no accounts, no telemetry, no npm publication, no Netlify unless GitHub Pages
stops being enough.
