# Verification

Verified locally on Windows with Node.js 24.19.0, October 23, 2026.

## Automated checks

`node --test`: **32 tests passed**. Covers ordered session results, streaks, draws, corrections, nonnegative totals, reset/undo, validation, layout backup round trips, historical aggregates, missing ticker values, API cache validators, 429 backoff, serial fetching, year-boundary archives, authentication, cross-origin rejection, read-only token restrictions, SSE delivery, SQLite persistence across restart, ticker timing/pause/scroll calculations, HTTP-compatible CTA IDs, explicit timer commands, and dock routes.

## Browser checks

- Signed in to the private control panel.
- Pulled real Chess.com stats for the configured player at initial verification time. Neither that personal username nor the returned ratings are hardcoded into the application.
- Recorded wins, a loss, and a draw; confirmed session totals, win rate, result history, and streak updates.
- Moved the stats widget from X=2070/Y=70 to X=1860/Y=260 by dragging and confirmed saved coordinates.
- Resized the card from 430×390 to 520×480 by its corner handle.
- Enabled the scoreboard, locked the layout, and switched between native and downscaled output previews.
- Applied Minimal and Session visibility presets and verified updated fields.
- Switched the CTA ticker from rotation to scrolling and confirmed substituted messages.
- Opened the read-only overlay in a separate browser view and confirmed new scores propagated immediately.
- Confirmed overlay canvas dimensions 2560×1440, transparent body background, and zero interactive controls.
- No errors/warnings in the final control-panel and overlay browser consoles.

## Deployment checks still needed

Combined dock follow-up: `/dock` was browser-verified with one sign-in, Score/CTA switching in the same page, and selected-tab restoration after refresh. It shares one authenticated event connection, exposes connection status and sign-out, and retains the separate dock URLs. The combined route is included in the existing HTTP/auth integration checks.

Dock/timer follow-up: verified Score and CTA pages in browser views at 380 px width, password login, starting/pausing/restarting the clock, preserved scores/history after restart, and adding an additional CTA. Both dock consoles were free of errors/warnings. OBS embedding itself remains a deployment-side check.

Ticker follow-up: replaced the interval/Web Animations implementation with an elapsed-time renderer and repeated scrolling content. A browser fixture verified rotation at a two-second interval and moving scroll text while receiving state updates every 250 milliseconds. Pause held the same text and transform across observations; resume and hide/show restored visible motion without console errors. Actual OBS verification is still required on the streaming PC.

The project has not been installed on the user's Proxmox host. Verify the Linux systemd service, LAN firewall/DNS, persistent directory permissions, and actual OBS Browser Source rendering on the streaming PC after deployment. Docker configuration is supplied but was not executed here. API archive edge cases are tested with fixtures; historical aggregates depend on whatever public archive data Chess.com provides.

Preview screenshots contain disposable local test-session results. The shipped project starts with a new zero-score session and contains no preview database or credentials.


## Credits and tips branch

The 26-test suite additionally covers legacy database/settings/preset migration, old backup import, credits duration and speed calculations, play-once/loop behavior, isolated playback timelines, tip navigation/shuffle/pause, new input validation, static module routes, and read-only token restrictions for playback commands.

Browser checks verified the four-tab dock with one login; dedicated credits autoplay; live pause and restart; independent local preview playback while the live source stayed paused; held final message; and tip Next/Pause/Resume controls. A five-second disposable configuration was used for timing checks. Real OBS scene activation and Advanced Scene Switcher integration still require verification on the streaming PC.


OBS activation fix: three additional regression tests simulate per-source activation events and exercise the real credits timeline. They verify inactive reset, restart on reactivation, duplicate-event handling, activation before settings arrive, suppression of off-air dock commands, active pause/resume, source independence, and browser-only autoplay. The full 29-test suite passes; the new module is also served by the HTTP integration test. Event name/payload were checked against the official obsproject/obs-browser documentation and implementation. Actual OBS scene switching remains a streaming-PC verification step.


## Optional authentication

October 24, 2026: all 32 tests pass. New authentication tests cover strict AUTH_REQUIRED parsing and default behavior, conditional credential validation, token-free reads and SSE, password-free control actions, retained cross-origin/JSON/input checks, and returning to protected mode with expired pre-restart cookies and preserved results. Existing protected-mode tests still verify read-only tokens cannot write.

Browser checks verified a password-free combined dock with an authentication-disabled indicator and hidden Sign out, score recording, token-free overlay and credits rendering, clean source URLs in Settings, and a protected dock that still requires login and shows Sign out after authentication. The open control panel had no console warnings or errors. Disposable previews used loopback addresses and contain no production data. LXC/Compose deployment and real OBS embedding remain host-side verification steps.


## Chess tips advanced text mode (October 24, 2026)

Isolated branch based on freshly fetched main `94bb42d80c2b7cf7cca4f28d09c408aa97b97096`; no Creator Studio changes included.

- Node **24.22.1**: **40/40 tests pass** (`node --test`). Syntax checks pass for all **28** application/test modules; `git diff --check` passes. The portable official Node runtime was checksum-verified. The default environment Node 22 baseline also passed 32 tests, but final validation uses the required Node 24 runtime.
- New tests cover exact serializer/parser round trips (IDs, ordering, duplicate text, omitted existing metadata, disabled flags, CRLF, Unicode, colons, multiline/quoted whitespace), invalid fields/values, required text, item/length limits, append/replace/undo, stale writes, validation through the existing API, draft protection and failed saves, and retained current-tip identity/playback commands. HTTP tests cover serving the new modules, authenticated text updates, stale-update rejection, and read-only-token rejection.
- In-app browser QA against a disposable loopback-only server with polling disabled passed: full-panel validation, append and undo; combined dock replacement confirmation/apply/undo, simple-mode metadata warning, plain HTML-like text, navigation with retained draft, and realtime conflicts between two clients. Existing Next/Pause/Resume controls worked. Both checked clients had no warning/error console entries.
- Native JavaScript confirmation initially stalled browser automation; the implementation now uses the existing in-page app dialog. Replacement and format-change checks passed after this fix.
- A requested 380px viewport override did not take effect (actual viewport remained 1280px). Narrow-width rendering and real OBS embedding are **not verified**. No deployment, merge, production data change, or OBS configuration change was performed.
- Undo is one step and page-local. It refuses to overwrite a later changed list. Drafts survive tab switching and realtime refreshes, but closing/reloading the page after accepting the browser warning discards them. Existing blank tip text must be completed before structured validation succeeds.

## Responsive outputs (October 24, 2026)

New branch from freshly fetched main `635f85e86b614ceb12268c6def7e13cd7ed2966f`, preserving merged advanced tips. No Creator Studio changes.

- Node **24.22.1**: **52/52 tests pass**. Includes 12 viewport tests (native/720p/1080p/4K, 2560x1400, ultrawide, narrow, portrait, zero/invalid sizes, independent resize listeners), existing OBS activation/timeline regressions, preset/backup round trips and HTTP serving of the shared module. The initial sandbox run passed 50 and failed two HTTP tests because localhost connections were denied; the complete suite passed with approved loopback access.
- Syntax checks pass for all **31** modules; `git diff --check` passes. Focused review found and corrected stale fixed-resolution instructions; logical validation, saved data and playback implementations are unchanged.
- Reproducible browser fixture: run `node scripts/viewport-qa.mjs`, open `http://127.0.0.1:3317/qa`, and click **Run viewport and playback checks**. It uses a fresh temporary database, a loopback listener, stubbed Chess.com responses and no credentials or production configuration. Stop it with Ctrl+C. Test data remains in the OS temporary directory.
- In-app Chromium passed the fixture at actual iframe document viewports **1920x1080, 1280x720, 2560x1440, 3840x2160, 2560x1400, 3440x1440, 800x600, 1080x1920**. Each size was verified against innerWidth/innerHeight after a live resize; these are real browser layout viewports, not merely requested overrides. Uniform centered bounds, unchanged logical dimensions, no document overflow, right stats/bottom ticker containment, and transparent page margins passed.
- Crawl DOM identity and continuous movement, paused position across resize, resume, held final state, zero-opacity/opaque credits background, independent source activation, duplicate activation, repeated SSE state and an actual HTTP SSE disconnect/reconnect passed. OBS activation events were **simulated**, not sent by OBS.
- Embedded credits at a 1280x720 logical widget size scale exactly once. The 1080p Layout Studio preview matches its stage and keeps 2560 logical width. Full-panel credits preview and actual **380x800** dock credits preview fit correctly. Fixture console had no warnings/errors.
- Real OBS embedding, scene switching, Advanced Scene Switcher, deployment and encoded output remain **unrun**. No merge, deployment, production data or security configuration changes were performed. Non-16:9 margins remain transparent; portrait uses the original composition rather than reflow.


## Pawn branding and Linux service documentation (October 24, 2026)

- Isolated branch from freshly fetched main `3d864b38f3c4252da27fa65eb1cb5cf0395e8d78`, which includes merged PR #5. Existing responsive outputs and advanced tips remain intact.
- Original SVG cyan pawn on a dark rounded tile replaces application branding in the login mark/art, sidebar and Appearance preview; the dock header and all HTML favicons use the same asset. Chess navigation/statistics symbols remain unchanged. A one-unit internal overlap removes a rasterization seam at the pawn base.
- Node 24.22.1: all 52 tests pass, including added unauthenticated SVG route/MIME and favicon-link checks for control, dock, overlay and credits. All 31 modules pass syntax checks; `git diff --check` passes.
- Browser pixel inspection passed at 16, 24, 48, 96 and 240px plus the 440px login art. Full control/Appearance checked at 1280px and 380px; combined dock checked at 380px and 320px; control login at 380px and dock login at 320px. Logos remain loaded, square, readable and unclipped, with accessible naming. No horizontal overflow in checked narrow views and no warning/error console entries. Responsive viewport overrides were verified against actual DOM dimensions and reset afterward.
- QA used disposable loopback-only data with external API polling disabled. Real OBS embedding remains an end-user check. No deployment or service installation was performed.
- README systemd commands were checked against the supplied unit, environment example and source: service name, checkout paths, EnvironmentFile, StateDirectory, DATA_DIR and health endpoint match. Debian/Ubuntu/systemd assumptions are explicit; generic backups replace Proxmox-specific framing. Docker and local-development instructions are preserved.

## Social handle callouts (October 24, 2026)

- New isolated LV426 checkout and branch `codex/social-handle-callouts`, from freshly fetched main `63e464827b94850f9c729f05d054bfe295a00c20` (merged PR #6). Pawn branding, Linux service docs, responsive output and advanced tips are preserved. No Creator Studio work.
- Node **24.22.1**: **62/62 tests pass**. Includes legacy database/settings/preset/backup migration; session preservation; portable custom-icon preset/export/import and restart; stale/repeated edits; count/string/platform/config limits; unsafe IDs/traversal; upload/read-only-token/origin/auth checks; no overwrite; safe MIME/nosniff; references preventing deletion; PNG signature/CRC/dimension/decompression/filter/size/total-storage validation; unknown settings and import bypass rejection; timeline continuity, pause/resume, next/previous, reorder, disable/removal, static mode and empty lists. Existing chess/tips/ticker/credits/auth/viewport tests remain passing.
- All **37** MJS files pass `node --check`; `git diff --check` passes. Security review verified static file allowlists, generated asset IDs, no user-controlled paths, plain DOM text, same-origin authenticated uploads, bounded PNG decompression, metadata stripping, atomic imports, reference preservation and credential-free exports. Unrelated UI setting edits now submit only changed top-level settings; direct conflicting Socials settings also require an expected snapshot.
- Reproducible browser QA: `node scripts/socials-qa.mjs`, open `http://127.0.0.1:3318/qa`, click **Run Socials browser checks**. It creates a disposable temporary database, uses loopback only, disables API polling and stubs external fetches. Stop with Ctrl+C; its SIGINT/SIGTERM handler closes the server and removes its own temporary directory. Close other local QA tabs first to avoid the browser's HTTP/1 connection limit on simultaneous SSE clients.
- Browser checks: full panel at measured 1280x900, 380x900 and 320x900; combined dock at measured 380x900 and 320x900; overlay at actual 1920x1080 and 2560x1440. Verified CRUD/repeated reorder, custom PNG preview/upload/replacement/removal, failed upload recovery, local draft retention across SSE and tab switching, stale-save rejection with draft retained, explicit reload, plain HTML-like strings, next/previous/pause/resume, rotation during repeated real HTTP SSE updates, retained renderer DOM, eight loaded built-in icons, static-row fit and disabled output. No horizontal document overflow in the narrow checks.
- Pixel inspection caught invisible monochrome SVGs under dark color-scheme inheritance; fixed with explicit black fills/light icon tiles and rechecked all eight recognizable icons at 1080p. It also caught an unreadable shrunken dock content preview and a 320px full-panel reload-button overflow; the preview now scrolls at readable size, buttons wrap, and the actual output fit remains in Layout studio.
- Limits: uploads intentionally accept only non-interlaced 8-bit RGB/RGBA PNG (512px, 200 KiB each; 30 icons / 1 MiB total). Twenty entries, 120-character handles, 80-character CTA, 5–300s interval. Large static lists in tiny widgets scale down; rotation or a larger widget is recommended. Rotation clocks are per viewer, and a newly loaded viewer starts with the first enabled entry. Drafts are page-local. Original icon paths and upstream license/disclaimer/provenance are retained; no blanket trademark permission is claimed.
- Real OBS embedding, encoded output, deployment and service installation remain **unrun**. Tests use disposable fixtures only; no production session, credentials, account connections, merge or deployment was changed.

## Shared Handle Groups (October 24, 2026)

- Fresh isolated LV426 checkout, branch `codex/shared-handle-groups`, explicitly fetched `origin/main` before branching at `3562ed89d09f3aa65f3730c13128f0cf2c3a50ae`. Existing Socials, Pawn branding, advanced tips and responsive overlay changes are preserved. No Creator Studio work.
- Node **24.22.1**: **70/70 tests pass**; all **38 MJS modules** pass syntax checks and `git diff --check` passes. The initial restricted run could not connect to disposable loopback servers; the complete approved run passes, including auth=true/default and auth=false behavior and cross-origin/read-only-token protections.
- Added coverage for legacy independent entries/old backups, exact matching conflicts (case, spaces, @, URLs, CTA and enabled state), group/split ordering and custom refs, count/string/platform/unsafe ID validation, atomic stale/repeated writes, edit/reorder/hide/remove, current-item timeline continuity, grouped asset retention through presets/backup/import/SQLite storage, and empty/hidden groups. Legacy representation is accepted losslessly and normalized by the editor on save; no automatic merging or eager state rewrite.
- Updated `node scripts/socials-qa.mjs` fixture passes in Chromium: full panel at measured **1920x1080**, **380x900** and **320x900**; combined dock at measured **380x900** and **320x900**; overlay at actual **1920x1080** and **2560x1440**. It tests grouping preview/cancel/confirmation/save/undo after save, subsequent-edit undo invalidation, split/remove recovery, icon ordering/enabling, shared handle once, uploads/replacement/failure, HTML-like plain text, stale-save rejection, draft retention across SSE/navigation, row/rotation/next/previous/pause/resume, retained DOM/current identity across SSE, 120-character text with 20 icons, and hidden/empty output. No horizontal overflow in narrow documents; no warning/error browser console entries.
- Actual pixel review included narrow previews/editors/confirmation and full/native overlay. Improved narrow content preview to wrap the icon cluster above the shared text at readable size. Confirmation now says **Apply to draft**, making the separate Save socials publication step clear. Focused review also fixed matching-button refresh while typing, protected the immutable undo snapshot and checked draft/undo asset references again at deletion time.
- Undo is one step and page-local, survives saving the operation, and is unavailable after a different edit. It still uses the existing expected-state conflict check on save. Saved group/preset references protect assets server-side; another client's unsaved draft cannot reserve assets globally. Dense groups in undersized output widgets can still scale down; use Layout studio and a suitable widget size. Readable dock previews scroll instead of shrinking.
- Disposable QA uses loopback, temporary data and stubbed upstream responses; no deployed URL, production data or credentials are used. Real OBS embedding/encoded output remain unrun. No merge, deployment, auth-default change or account connection.

## CTA ticker advanced text mode (October 24, 2026)

- Isolated LV426 checkout and new branch `feat/cta-advanced-text`, created after explicitly fetching latest `origin/main` at `5b8f3d5bd50f4d4ffa68823c2e8bfd2cc1eb97b4`. Existing shared Socials groups, authentication, Pawn branding, responsive output and advanced Chess Tips remain intact. Scope is CTA only; no End Credits advanced mode, Creator Studio, deployment or credential changes.
- Node **24.22.1**: **78/78 tests pass**. New coverage includes CRLF/Unicode/colons, literal and substituted tokens, multiline JSON strings and significant whitespace, required text, invalid enabled/unknown/duplicate fields, duplicate IDs, all CTA limits, exact identity/order/metadata round trips, atomic append/replace/undo, stale and repeated writes, failure/retry, confirmation cancellation, draft protection, and real rotation-renderer identity/timing through high-rate updates, reorder/edit/removal/pause. HTTP checks cover module routes, authenticated writes, stale/invalid rejection and read-only-token denial. Existing auth/origin/session/socials/credits/tips tests pass. Initial restricted HTTP tests failed with sandbox loopback EACCES; the approved full run passed.
- Disposable `node scripts/cta-qa.mjs` browser harness: **all checks pass** in Chromium. Actual full panel measured **1920x1080**, **380x900**, **320x900**; combined and separate CTA docks measured **380x900** and **320x900**; actual overlay measured **1920x1080**. Narrow documents have no horizontal overflow. Visually inspected the complete advanced CTA dock at measured **320x900**, including wrapping buttons, textarea, literal tokens and live substitution. Browser console contains no warnings or errors.
- Browser checks exercise visual default, structured identity/enabled state, multiline/plaintext preview, replace cancellation, format and navigation cancellation/retention, simulated interrupted request and retry, undo, duplicate Apply clicks, live remote-edit conflicts retaining the draft, pause/hide/show/reorder/edit/remove continuity, forty rapid SSE-producing actions for each rotation/scroll scenario, retained ticker DOM on irrelevant updates, scrolling/pause, a 500-character message and empty-set hiding. The harness closes narrow test frames between cases to avoid exhausting HTTP/1 SSE connection slots. An initial harness run exhausted those slots; the corrected full run passed.
- All **42 MJS modules** pass `node --check`; `git diff --check` passes.
- Focused review checked expected-list isolation from behavior/session settings, safe textContent rendering, unchanged token skip semantics, pending-confirmation double-click lock, and mode-switch clock reset. README documents exact formats, ID/metadata rules, simple-mode loss warnings, stale-save recovery, undo lifetime and viewer-local playback behavior.
- Real OBS embedding/scene switching, private deployment, Docker/systemd and physical browser-close prompts remain **unrun**. The `beforeunload` handler is covered in unit tests; prompt presentation depends on browser interaction policies. Scroll geometry can move when text widths change; retained-message leading-edge anchoring is best effort. No merge or deploy is performed.

### CTA variable reference and help readability follow-up

- Updated the still-open draft PR #11 branch with UI copy and scoped styles only; parser, saving and playback semantics are unchanged. All 12 implemented variables have descriptions and literal examples grouped by names, session, ratings/goals. Help explains literal parser preview, live substitution, missing-value skipping and unknown-token preservation. Format guidance uses six short titled sections with lists and examples.
- Node **24.22.1**: **79/79 tests pass**, including the documented-variable/substitution consistency test. All **42 MJS modules** pass syntax checks; `git diff --check` passes.
- Complete disposable CTA browser harness passes again, including desktop **1920x1080**, full panel and both docks at measured **320x900 / 380x900**, and overlay **1920x1080**. Both help disclosures opened and all 12 variables were present in every narrow view, with no horizontal overflow. Existing failure/retry, cancellation, stale-draft, repeated-click and playback checks also pass.
- Pixel inspection confirmed wrapped variable descriptions at **320px** and the sectioned format help at **380px**. Keyboard Enter opens/closes the native disclosures with a visible focus outline; toggling them retains an edited draft. Console warnings/errors: none. Real OBS and physical close-prompt checks remain unrun as above; no private instance or deployed settings were used.
