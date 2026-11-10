# Enigma Lab

A working Enigma machine in the browser: Wehrmacht Enigma I by default, Kriegsmarine M3
and M4 on request, and eventually any machine you can describe. Static files, no
backend, works offline.

**[Open the machine](https://indpriyanshuraj-bot.github.io/enigma-lab/)**

## Two interfaces, one machine

The **form** lists every setting an operator read off a key sheet. The **3D** view is the same
machine as an object you can turn over: drag to orbit, scroll to zoom, lift the lid, tap a
rotor to work it. Both read and write the same state, so a letter typed in one appears in the
other, and the URL always describes the machine you are looking at.

There is also a settings dialog (four themes, renderer choice, motion), an
[About page](./about.html) that explains the simulation and credits the people who broke the
machine, and a [Fun facts page](./facts.html) whose claims can all be checked against the
machine in under a minute.

## What you can do with it

- Operate the machine: press keys, watch the rotors step, catch the double step.
- Turn it: drag to change the viewing angle, scroll to zoom, lift the lid.
- Work a rotor: tap it to step it, or move it left and right in the stack.
- Set a key sheet: rotors, ring settings, window positions, plugboard cables.
- Send a signal: the six-letter indicator, with the message key encrypted twice.
- Build a machine that never existed: up to a hundred rotors, your own notches and
  alphabet, wiring derived from a seed you can share.
- Move the sliders in the key-space panel and watch 81 bits appear and disappear.

## What is here

| Path | What it is |
| --- | --- |
| `src/` | the site: Preact components, modes, state, renderers |
| `src/render/scene3d.ts` | the 3D machine: orbit camera, painter's algorithm, hit testing |
| `about.html`, `facts.html` | static pages, no JavaScript beyond a theme probe |
| `public/` | service worker, web app manifest, icons, `404.html`, `robots.txt` |
| `scripts/fetch-lib.mjs` | downloads and sha256-verifies the pinned core release |
| `scripts/postbuild.mjs` | writes the precache manifest, checks PWA artifacts, enforces budgets |
| `test/smoke.spec.ts` | Playwright: boots, ciphers `AAAAA` to `BDZGO`, no console errors |
| `lib.lock.json` | the one release of `@enigma-lab/core` this build bundles |
| `test/` | assertions against the built `dist/` |

## The library is pinned, not resolved

`lib.lock.json` names one tag, one tarball URL and one sha256. `pnpm run lib` downloads
it, refuses to continue on a mismatch, and unpacks it into `vendor/core`. Vite then
aliases `@enigma-lab/core` to that directory, so the bundle contains exactly the
release that passed its own test suite — never `latest`, never a floating range.

To move the site to a new library release, change `version`, `tag`, `url` and `sha256`
in `lib.lock.json` in one commit. The diff *is* the upgrade.

## Build and run

```bash
corepack enable
pnpm install
pnpm run dev       # fetches the pinned core, then Vite on :5173
pnpm run build     # fetch + Vite (Rolldown) + postbuild checks
pnpm run test:e2e  # Playwright: 11 checks across two viewports
pnpm test          # asserts on dist/
pnpm run test:e2e  # Playwright: two viewports, real browser
pnpm run preview
```

Node 24 for the toolchain. Vite 8 bundles with Rolldown and minifies with OXC, the same
bundler family the library itself is built with.

## What the site promises

- **Mobile first.** One column, thumb-sized targets, `100dvh` layout, safe-area insets.
- **Keyboard and pointer.** A–Z, `Backspace`, `Esc`; every rotor is also a button.
- **Rendering with a real fallback.** In the form view WebGPU rasterises the rotor discs when
  the device offers an adapter; SVG draws them otherwise, and always draws the letters,
  captions, focus rings and the lid. Both read the same projected scene and the same hit
  test, so a tap lands on the same rotor either way. The 3D view is a painter's-algorithm
  renderer on a 2D canvas, so it works on every device. The footer says which backend drew
  the frame.
- **Accessible by construction.** A skip link, landmarks, `aria-current` on the navigation,
  a native `<dialog>` for settings, `aria-live` readouts, real focus rings, keyboard control
  of the 3D camera, and a motion switch that also honours `prefers-reduced-motion`.
- **Findable.** Per-page titles, descriptions, canonicals and Open Graph tags, JSON-LD on all
  three pages, a sitemap, and semantic headings — with the two content pages shipping no
  JavaScript at all.
- **Offline.** A service worker precaches the shell and hashed assets, and answers a
  navigation with the cached shell when the network is gone.
- **Progressive.** `<noscript>` explains the machine and the key-space arithmetic for
  anyone without scripting; `404.html` is a standalone page.
- **No telemetry, no accounts, no server.** Settings live in `localStorage` and in the URL
  hash, so a setup can be shared as a link.

## Credits

Rotor and reflector data comes from `@enigma-lab/core`, which follows the published
Crypto Museum and 1954 wiring-catalogue measurements. The historical record belongs to
Marian Rejewski, Jerzy Różycki and Henryk Zygalski of the Polish Cipher Bureau, and to
Alan Turing, Gordon Welchman and the staff of Hut 6 and Hut 8 at Bletchley Park.

MIT © Priyanshu Raj
