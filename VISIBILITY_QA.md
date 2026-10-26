# Dock visibility verification — 2026-10-26

Base: freshly cloned/fetched `origin/main` at
`cbcba18af396678c4a9649a3ded03b244b842621`. PR #20 was confirmed merged;
no unmerged feature branch commits were included. Work is isolated on
`codex/dock-widget-visibility`.

## Reproduce

Use Node 24 or later: `npm test`, then `node scripts/presentation-qa.mjs`.
The existing fixture uses disposable temporary SQLite data, synthetic goals/results,
loopback binding, and no external polling. `QA_PORT` selects another local port.
Open `/dock`, a second `/dock/`, `/control`, `/overlay`, and
`/overlay?layout=portrait`. Stop the fixture after use.

## Automated coverage

The visibility suites cover all eight widgets in both orientations, exact mutation
boundaries, malformed IDs/layouts/booleans, expected-value conflicts, stale/ABA
revision conflicts, old server epochs, authenticated writes, read-only-token and
cross-origin rejection, two SSE clients, preset/backup round trips, and Store restart.
Controller tests cover shared pending state, repeated clicks, live updates during
pending, failed responses, latest confirmed state and retry. Credits tests exercise
no autoplay, hidden speed-mode dimensions, and paused playback preservation.
Geometry regression verifies a gesture cannot resurrect a widget hidden by another
client while dragging. Existing session, ticker, goals, presets/backups and auth
tests run as part of the full suite.

## Chromium checks performed

- All 16 dock orientation toggles changed their corresponding saved/output display
  values; a second dock matched over live updates. No reservation rows appeared.
- Landscape and portrait Layout Studio toggles synchronized back to the dock.
- Visibility remained available across Score, Goals, CTA, Credits, Tips and Socials.
  Reload retained the local tab/collapse preference. Collapsing did not change
  visibility or the already-open second client's disclosure state.
- 320, 360 and 390 pixel docks had no document horizontal overflow; every visibility
  button measured 44px high. The CTA contextual panel was inspected at 320px.
  Space saved the toggle while retaining focus, and Tab reached the other orientation.
- Both live clocks read 00:00:13 Running. They were hidden while the dock clock
  continued; after a server stop/restart using the same disposable data and reveal,
  both read 00:02:03 Running. Recorded scores remained two wins.
- Stopping the server produced a visible failure, retained the confirmed ON value,
  and released pending state. Reconnection to the same saved data succeeded and
  retry changed the desired visibility. A request timeout was also exercised when
  six same-origin SSE tabs exhausted Chromium's HTTP/1 connection pool; closing
  the excess client released the pool and retry succeeded.
- Main-overlay credits remained stopped when visibility was enabled. Their playback
  controls remain separate. Full-size landscape/portrait pixels were inspected.

Screenshots: `assets/screenshots/visibility-qa/`.

## Review and limits

Focused independent review identified contextual keyboard focus, visible Layout
Studio errors, old-instance responses after re-login, and stale drag snapshots.
These were corrected and regressions added. Current UI layout saves supply an
expected snapshot; older already-open control pages must reload after upgrade.
Visibility writes themselves always require the current server instance/revision.
This intentionally rejects a concurrent unrelated update too; reload/retry is safe.

No physical OBS test was performed. Authentication/authorization and rapid-click
race cases were exercised by automated tests; the browser fixture used explicit
local open mode. Six or more live SSE pages in one browser can exhaust its existing
HTTP/1 per-origin connection pool; keep fewer clients open for browser QA. This
change adds request timeouts but does not redesign SSE transport. Hidden credits
speed-mode and pause behavior have deterministic renderer tests, rather than a
complete physical OBS playback matrix.

Final validation: **172/172 tests passed** on Node 24.22.1. All `.mjs` syntax
checks and the complete branch diff whitespace check passed. Focused independent
review reported no remaining blockers after the geometry fix.
