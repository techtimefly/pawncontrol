# Presentation integration QA — 2026-10-26

## Reproduce

Use Node 24 or newer. Run `npm test`, then `node scripts/presentation-qa.mjs`.
The fixture creates a new disposable SQLite directory under the OS temp directory,
binds only `127.0.0.1:3148`, and uses synthetic goals/results with no external
polling or production data. Set `QA_PORT` to use another port. Stop with Ctrl+C.
Open `/control`, `/dock`, `/dock/score`, `/overlay` and
`/overlay?layout=portrait` on the printed origin. Authentication remains unchanged
in the product; the disposable fixture explicitly opts into local open mode.

## Automated coverage

The final Node 24 suite covers existing timer safety, goal semantics, recap freezing,
authentication, saved drafts, and the new regression cases:

- Guide drag/resize coordinates on scaled canvases; bounds, grid and edge snap,
  ratio lock, cancellation, lost capture and repeated gestures; independent layouts.
- Scoped guide edits against concurrent widget changes; stale guide conflicts;
  simultaneous authenticated SSE landscape/portrait sources.
- Hidden clock migration, styles/size validation, shared elapsed time, safe timer
  controls including pending/error/cancel behavior; opposite-orientation style saves.
- Empty/single/many selections, ordering, limits, archived/missing goals, rotation
  across unrelated updates and reconnect/visibility slots; backward featured mode.
- Honest bar/donut ratios, regression below baseline, stale/missing data, animation
  disabled/reduced motion, no replay on reconnect, numeric input draft preservation.
- Combined backup/import/preset and Store restart round trips, legacy additions,
  two authenticated clients, conflicting writes, static module serving and read-only
  overlay authorization.

## Browser checks performed

Real Chromium in-app browser, with pixels inspected as well as DOM geometry:

| Surface | Dimensions | Result |
| --- | --- | --- |
| Layout Studio | 1920 × 1080 | Board label dragged on scaled canvas; saved x/y changed from 70/70 to 180/140. Corner resize changed 1080/1080 to 1180/1120. Camera and board handles visible. |
| Landscape overlay | 1920 × 1080 | Clock, three horizontal goal cards and bar progress visible; long title wraps; missing rating says unavailable. |
| Portrait overlay | 1080 × 1920 | Independent stacked donut presentation; long titles contained; missing rating has no invented fill. |
| Smaller portrait | 720 × 1280 | Canvas scales, clock and cards remain bounded; no horizontal document overflow. |
| Combined dock | 360 × 800 | Start and pause work; both overlay clocks agree at 00:00:20 Paused. Goal controls and ordered list remain usable; successive rotating/donut saves succeed. |

With editor guides enabled, both overlays contained zero reservation elements;
computed body/canvas backgrounds were transparent (`rgba(0, 0, 0, 0)`). The browser
viewer displays transparency against black. Rotation visibly advanced from the wins
goal to the long-title manual goal. Screenshots exposed default portrait clock and
fixture-goal overlaps; the new clock default moved below Stats and the fixture goal
moved below Scoreboard, then spacing was visually rechecked.

Screenshots are in `assets/screenshots/presentation-qa/`. Full-page capture was used
for tall outputs because the normal host-window capture clips to the desktop height.
Dense stacks intentionally shrink text; increase height or reduce card count for
broadcast readability.

## Limits

No physical OBS source/capture test was performed. Pointer cancellation, restart
error handling, reduced-motion behavior, archived rotation and backup/concurrency
edge cases were exercised by automated tests rather than every combination in the
browser. The suite requires localhost sockets: sandboxed HTTP tests initially failed
at fetch; rerunning with localhost networking passed. Node 24.22.1 was downloaded
from nodejs.org and SHA-256 checked against its release checksum. The unchanged
baseline passed 144/144 under Node 24 before implementation.

Final integrated local run: **165/165 tests passed** on Node 24.22.1; all `.mjs`
syntax checks and `git diff --check` passed. Dedicated `/dock/score` was also checked
at 360 × 800: restart cancellation preserved the paused value; confirmed restart
ran from zero, then paused at 00:00:11 in both dock and overlay while the two recorded
wins remained intact. No browser console errors were reported in either output.
The Node tests workflow runs this same suite on pushes and pull requests.

## Goals sidebar follow-up (2026-10-26)

Layout-only revision: individual goals and their editor now occupy the main left
column; presentation and widget visibility occupy the right sidebar. This reuses
CTA/Stats' shared two-column breakpoint and dock stacking, with goals first in DOM
and keyboard order. No event handlers, IDs or state behavior changed.

Browser pixel checks: 1920 x 1080 and 1100 x 900 show both columns side by side;
800 x 900 and the 360 x 800 combined dock stack goals before settings. All four
widths had no document horizontal overflow. Desktop edit/save and landscape
stacked/donut changes succeeded. Dock edit/save and portrait horizontal change
succeeded with the saved status. Tab from the title reaches the target field;
Tab from Archived goals reaches the first presentation Display control. Portrait
controls are reachable by keyboard/scroll and render without clipping at 360px.
Screenshots: goals-desktop.jpg, goals-medium.jpg, goals-narrow.jpg and
goals-dock-settings.jpg in assets/screenshots/presentation-qa/.

Follow-up validation: 165/165 tests passed on Node 24.22.1; all module syntax and complete branch diff checks passed.
