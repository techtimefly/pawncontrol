# Session timer regression verification

Validated on Node 24.22.1, from main b28bb6d, using a fresh clone and disposable SQLite data. No deployed service or production data was used.

## Reproduced before fixing

- Start, run 5 seconds, pause, wait 60 seconds, undo: old code reports 65 seconds instead of restoring the captured 5 seconds.
- Restart after 5 seconds, wait 60 seconds, undo: same stale-anchor result.
- UI source queued a toggle closure: repeated Start clicks could execute as Start then Pause.

## Automated coverage

`node --test`: 127 passed. Every tracked/new `.mjs` passed `node --check`; `git diff --check` passed. Focused independent review found and verified the fix for first-template duration capture.

Timer tests cover explicit/idempotent commands, delayed timer undo, score undo after timer changes, full-session/legacy undo, epoch-zero anchors, pending controls, failures/retry and cancellation. Recap tests cover authoritative duration capture, explicit refresh, template consistency, frozen completion, reset/undo, malformed durations and legacy backup compatibility. Existing HTTP/auth/persistence/preset/layout tests remain passing.

## Actual browser checks

In-app Chromium against a dedicated localhost QA instance, polling disabled except the existing import-triggered API refresh:

- Rapid double-click Start left timer Running.
- Pause at 5 seconds; delayed undo restored 5 seconds with a fresh anchor.
- Score undo after timer undo preserved Running; subsequent timer reset/undo retained the captured clock.
- Reset confirmation zeroed and stopped. Delayed undo restored running captured duration.
- Restart & run confirmation zeroed and ran. Delayed undo restored pre-restart duration.
- Stopped QA server: Pause failed visibly and controls re-enabled. Restarted same QA data: clock persisted and included downtime; retry succeeded. Persisted timer undo remained usable.
- Full panel and score dock synchronized via SSE. Combined dock exposed all three controls and status/hint.
- Captured template duration 00:01:08 matched displayed statistics, remained 00:01:08 when completed later with session reset, and remained frozen after full-session undo.
- Imported a disposable legacy recap backup without duration; browser displayed `unavailable` rather than inventing a value.
- Full panel and combined dock fit a 390x844 portrait viewport without horizontal overflow; dock also inspected at landscape/default desktop size. Shared overlay layout/viewport regressions passed. Native OBS itself was not launched.

The sandbox initially denied integration-test loopback connections. Approved reruns passed; this was an execution restriction, not a product failure.
