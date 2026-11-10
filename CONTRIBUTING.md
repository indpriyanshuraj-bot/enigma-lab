# Contributing

## The shape of a change

1. Branch from `main`. Name it for the change, not the person.
2. Keep the diff to one idea. A bug fix that also reformats a file is two changes.
3. Run `pnpm run typecheck && pnpm run build && pnpm test && pnpm run test:e2e`.
4. Open a pull request. CI must be green before it merges.

## Commit messages

Conventional commits: `feat(scope):`, `fix(scope):`, `test:`, `docs:`, `chore(ci):`.
The body explains *why*; the diff already says what.

Every commit carries the same trailer block, so authorship and review are explicit:

```
Co-authored-by: Sarvam Agents <330910099+sarvam-agents[bot]@users.noreply.github.com>
Co-authored-by: Priyanshu Raj <243560345+indpriyanshuraj@users.noreply.github.com>
Reviewed-by: Priyanshu Raj <243560345+indpriyanshuraj@users.noreply.github.com>
Signed-off-by: Priyanshu Raj (bot) <351790193+indpriyanshuraj-bot@users.noreply.github.com>
```

## The rules that are not negotiable

- **The library stays headless.** Nothing in `@enigma-lab/core` may touch the DOM.
- **The site pins one release.** Change `lib.lock.json` in one commit, with the new
  sha256, and say why in the message.
- **No runtime dependency in the library.** It has none, and it stays that way.
- **The historical numbers are tested.** If a change alters `EWTYX`, `BDZGO`, the double
  step or the 81.2-bit key space, the test fails and the change is wrong.
- **No telemetry, no accounts, no server.** There is nothing to send and nowhere to send it.

## Adding a machine

Presets live in the library (`src/core/presets.ts`), not in the site. Add the rotor and
reflector wiring with its source, a preset that names the rotors it could carry, and a test
that pins a known trace. Wiring without a published measurement does not ship.
