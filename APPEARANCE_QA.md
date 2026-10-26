# Appearance verification — 2026-10-26

Base: freshly cloned `origin/main` at `55fa453` (includes PR #21), isolated
worktree on `feat/appearance-color-schemes`. Existing checkouts were not changed.

## Automated checks

Node 24.22.1: **189/189 tests passed**, including 17 new appearance tests. All
repository `.mjs` files passed `node --check`. No lint script is configured.
`git diff --check` passed. The unchanged baseline passed 172/172.

Coverage includes legacy defaults and saved values, validation and limits, named
scheme CRUD, independent orientations, deliberate default/custom widget color
overrides, color-only apply/undo, repeated clicks, invalid hex input, pure preview,
cancel/navigation, keyboard focus, SQLite restart, presets/backups/imports,
two authenticated SSE clients, stale/ABA/restart guards, and read-only/cross-origin
rejection. HTTP tests need loopback access; the initial restricted run failed at
localhost fetch and the approved run passed.

## Browser checks

Used the existing disposable `node scripts/presentation-qa.mjs` fixture, with
temporary SQLite data, no external polling, and loopback-only binding. Chromium
browser checks on final code:

- Midnight applied to Landscape while Portrait retained its original accent and
  clock colors; Undo restored Landscape. Both updated both output orientations.
- Portrait subsequently accepted Classic Chess independently of Landscape.
- Save current, duplicate, rename and delete succeeded; reloading retained the
  remaining custom scheme and applied palettes.
- A second client retained its preview while another client applied a scheme;
  the stale Apply was rejected with an actionable message.
- Invalid hex input could be canceled. Space activated a swatch and moved focus
  to its hex field. Leaving Appearance discarded the draft without applying it.
- At 360px and 320px, the appearance controls fit with no horizontal document
  overflow. The 320px check found and fixed topbar wrapping; final client/scroll
  widths both measured 305px (15px browser scrollbar).
- Landscape clock inspector displayed effective scheme colors. A deliberate
  credits brand color `#123456` survived a subsequent scheme change.
- High Contrast rendered the cyan streak badge with black text. Legacy borders
  remain intact until applying a scheme; applied card border matched the palette.
- Overlay body stayed transparent. Existing sample results and clocks remained
  unchanged. Browser console reported no errors during these checks.

## Review and limits

Independent review caught and fixed legacy preset library loss, legacy border
loss, the tips border selector, invalid hex preservation, effective clock input
values, and swatch focus behavior. Review also checked that credits/ticker/goal
rendering does not reset playback or animate unchanged values when colors change.

No physical OBS test was performed. The appearance preview is an illustrative
palette sample; use Layout Studio for exact composition and widget overrides.
Undo is one step and page-local. Appearance writes deliberately reject a stale
server revision, including unrelated intervening updates; cancel/re-preview is
the safe retry. Legacy non-default clock/credits colors are treated as overrides;
the app cannot infer whether a legacy color equal to its original default was an
intentional override. New explicit widget edits record that intent.
