# Architecture

Two repositories, one contract.

```
enigma-core (library)                    enigma-lab (site)
├── src/core/*     headless machine      ├── src/state/store.ts   the operator's state
├── src/render/*   geometry + painter    ├── src/render/*         WebGPU + SVG backends
├── dist/*.js      ESM bundles           ├── src/ui/*             panels
└── release vX.Y.Z ──tarball + sha256──▶ └── lib.lock.json        the pin
```

## The library

`src/core` is plain data in, plain data out: `MachineConfig` describes a machine,
`EnigmaMachine` runs it, `keyspace()` counts it. No DOM, no I/O, no globals, so it runs in
a test runner, a worker, or a service worker.

`src/render` is optional and deliberately unopinionated. `buildMachineScene` projects the
machine once into screen space; `renderMachineSvg` paints it; `hitTestScene` answers what a
point landed on. `RenderTheme` has no defaults, so the library cannot impose a look.

Two invariants hold the renderer together:

- the scene's bounds are grown to the viewport's aspect ratio, so a canvas that stretches
  and an SVG that letterboxes agree about where every rotor is;
- `hitTestScene` is the only definition of "which rotor is this", used by every backend.

## The two interfaces

`src/modes/form.tsx` is the form: settings, message, keyboard, key space, all as controls.
`src/modes/three-d-mode.tsx` wraps `ThreeD`, which renders the machine with
`src/render/scene3d.ts` — cylinders and a case box, an orbit camera, a painter's algorithm on
a 2D canvas, and `hitTest3d` for taps. Neither mode owns state: both take the same
`LabState` and call the same `onChange`, so they are two views of one machine rather than two
implementations of one idea.

## The site

State is one serialisable object, persisted to `localStorage` and mirrored into the URL
hash, so a setup can be shared as a link.

Rendering is split by job, not by fashion: WebGPU rasterises the rotor discs, SVG draws
everything that must be readable, focusable or announced. The machine stage renders the
scene, forwards pointer gestures to a camera, and turns taps into hits through the
library's own hit test. If the GPU cannot be initialised — no adapter, no device, a lost
context — `createGpuMachine` resolves `null` and the SVG discs take over.

The build is Vite 8, which bundles with Rolldown and minifies with OXC: the same bundler
family the library itself uses. `scripts/postbuild.mjs` writes the service worker's
precache manifest from the real, hashed filenames and refuses to finish if a PWA artifact
is missing or a budget is exceeded.

## Where the facts come from

Rotor, reflector and notch data follow the published Crypto Museum catalogue and the 1954
*wirings* catalogue, and are pinned by tests against the traces those sources publish. The
history in the UI is attributed: Rejewski, Różycki and Zygalski of the Polish Cipher
Bureau; Turing, Welchman, Keen and the staff of Hut 6 and Hut 8 at Bletchley Park.
