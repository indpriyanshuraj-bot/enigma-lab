# Enigma Lab

A working Enigma machine in the browser: Wehrmacht Enigma I by default, Kriegsmarine M3
and M4 on request, and eventually any machine you can describe. Static files, no
backend, works offline.

**[Open the machine](https://indpriyanshuraj-bot.github.io/enigma-lab/)**

## What is here

| Path | What it is |
| --- | --- |
| `src/` | the site: Preact components, state, renderer selection |
| `public/` | service worker, web app manifest, icons, `404.html`, `robots.txt` |
| `scripts/fetch-lib.mjs` | downloads and sha256-verifies the pinned core release |
| `scripts/postbuild.mjs` | writes the precache manifest, checks PWA artifacts, enforces budgets |
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
pnpm run preview
```

Node 24 for the toolchain. Vite 8 bundles with Rolldown and minifies with OXC, the same
bundler family the library itself is built with.

## What the site promises

- **Mobile first.** One column, thumb-sized targets, `100dvh` layout, safe-area insets.
- **Keyboard and pointer.** A–Z, `Backspace`, `Esc`; every rotor is also a button.
- **Rendering with a real fallback.** WebGPU is used when the device offers an adapter;
  otherwise the same drawing is produced as SVG. The footer always says which one drew it.
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
