# Goals MVP verification

Base: freshly cloned main `3a3a1eef824d1213d40b147bacb2324a5310f3bf`; timer PR #17 confirmed merged. Isolated branch `feat/goals-mvp`.

## Automated validation

Node 24.22.1: **144 tests passed**, zero failures. All `.mjs` files passed `node --check`; `git diff --check` passed. Focused implementation and independent review resolved shared rating-target overwrite, stale settings/import writes, LAN HTTP ID creation, lost-response retry, archived outcome capture, and stale-status aging without SSE.

New tests cover recorded game edits/deletes/undo, aggregate corrections without invented games, ID baselines, manual undo, reset/repeat/ongoing behavior, valid and missing/stale rating values, immutable recap and legacy import, malformed inputs, caps, presets/migration, two clients, operation replay, authentication/origin boundaries, export/import and SQLite restart. Existing timer, recap, portrait, viewport and server suites remain passing.

Initial Node22 sandbox run could not use loopback. Final runs use the required Node24 runtime with loopback permitted. Existing import-triggered API refresh can log database-closed during test cleanup; no unrelated shutdown behavior was changed.

## Actual browser QA

In-app Chromium, disposable local SQLite data, username `goals_qa`, loopback port 3137, polling disabled and offline fetch fixture. No deployed data used.

- Recorded a win before creation: session-start wins showed 1/5; from-now games showed 0/5. Another recorded game moved from-now to 1/5. Correcting that result from loss to win updated the other client to 2/5 wins.
- Ongoing manual counter increment and its separate Undo produced 1 then 0. A later second-client increment was retained while an older title draft was rejected with its text preserved.
- Featured visibility enabled independently for both compositions. Both overlay orientations rendered the selected goal on a transparent body. A 112-character title wrapped with the count readable in landscape and portrait.
- Combined dock at a 390x844 viewport had no horizontal overflow (document scroll width 375 at viewport width390). Goal controls and counts were visible.
- Missing rating displayed Unavailable, including distance/start. Verified new rating form chooses the existing selected time-control target (rapid1500), rather than the count default. Stale aging, regression and valid-zero overrides are covered by automated tests.
- Completed recap capture plus atomic reset retained old session goal counts; ended goals did not accrue next-session progress. Ongoing manual progress persisted. Ended featured goal could be unfeatured.
- Restarted the disposable server, reloaded clients, and verified goals and completed recap persistence. Later manual title/count edits did not change the saved recap's original title and 0/5 outcome.
- No console errors observed during the exercised dashboard flows. Native OBS was not launched. Legacy imports, caps and replay/failure recovery were verified by automated tests, not by claiming exhaustive browser coverage.

## Limits

20 stored goals including archived, one featured widget; 120-character titles; count/manual bounds 1,000,000; rating target 1-10,000; 30 manual undo entries; 100 recent operation IDs. Correct totals affects aggregate score only; goals count recorded results and display an explanation when corrections are active. Goal widgets are hidden by default on upgrade. No rotation, streak/time/countdown goals, celebrations, chat or LLM features.
