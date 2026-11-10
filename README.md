# Enigma Lab

A working Enigma machine in the browser: Wehrmacht Enigma I by default, Kriegsmarine M3
and M4 on request, and eventually any machine you can describe. Static files, no
backend, works offline.

**[Open the machine](https://indpriyanshuraj-bot.github.io/enigma-lab/)**

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
| `src/` | the site: Preact components, state, renderer selection |
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
pnpm test          # asserts on dist/
pnpm run test:e2e  # Playwright: two viewports, real browser
pnpm run preview
```

Node 24 for the toolchain. Vite 8 bundles with Rolldown and minifies with OXC, the same
bundler family the library itself is built with.

## What the site promises

- **Mobile first.** One column, thumb-sized targets, `100dvh` layout, safe-area insets.
- **Keyboard and pointer.** A–Z, `Backspace`, `Esc`; every rotor is also a button.
- **Rendering with a real fallback.** WebGPU rasterises the rotor discs when the device
  offers an adapter; SVG draws them otherwise, and always draws the letters, captions,
  focus rings and the lid. Both read the same projected scene and the same hit test, so a
  tap lands on the same rotor either way. The footer says which backend drew the frame.
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
