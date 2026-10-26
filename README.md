# Pawn Control

A self-hosted, streaming-platform-neutral chess broadcast desk, pulling public Chess.com data for a configurable player. Runs locally or as a Linux service on your LAN, with independent **2560 x 1440 landscape** and **1080 x 1920 portrait** compositions that fit OBS Browser Sources proportionally.

> Main session page

![Session Page](assets/screenshots/session.png)

> Overlay Example in OBS as a browser source

![OBS Overlay - Browser Source](assets/screenshots/obs_overlay.png)
## Quick start

Requires **Node.js 24 LTS** (includes built-in SQLite). No npm packages or build step.

```sh
git clone git@github.com:techtimefly/pawn_control.git
cd pawn_control
npm run setup
# Save the generated login password; setup creates .env with unique credentials.
# Edit .env and set CHESS_USERNAME to your Chess.com username.
npm start
```

Open `http://SERVER-IP:3000/control` and sign in (unless AUTH_REQUIRED=false). Copy the read-only OBS URL from Settings into an OBS Browser Source, using the width and height of the area you want it to occupy (for example **1920 x 1080**). The overlay has a transparent background. For uninterrupted updates, leave “Shutdown source when not visible” disabled.

Alternatively, copy `.env.example` to `.env` and set CONTROL_PASSWORD (16+ characters) and OVERLAY_TOKEN (24+ characters), or explicitly set AUTH_REQUIRED=false for trusted LAN use. Setup never overwrites an existing `.env`.

Set `CHESS_USERNAME` in the untracked `.env` for the first startup. It seeds a new database only. After that, the saved username in Settings takes precedence; changing the environment variable does not overwrite an existing player or session. A missing/placeholder username blocks first startup rather than fetching a sample account. Keep personal values out of `.env.example`.

For a local preview, keep HOST=127.0.0.1. For access from another device, set HOST=0.0.0.0 and allow TCP 3000 from your streaming PC. No Twitch credentials or Chess.com API key are needed. This app does not connect to Twitch chat.

## Requirements and configuration

| Requirement | Details |
| --- | --- |
| Runtime | Node.js 24+ with built-in SQLite; Node 24 LTS is recommended. npm is used for the provided scripts; `npm install` is not needed. |
| Repository access | Git and permission to clone this private repository; the documented SSH URL requires GitHub SSH authentication. |
| Linux service | Debian/Ubuntu with systemd, a `pawn` service user, and Node executable by that user outside `/root`. `curl` is used for the health checks below. |
| Optional Docker deployment | Docker Engine and the Docker Compose plugin; the image includes Node, so the host does not need a separate Node installation. |
| Networking | Outbound HTTPS to `api.chess.com`; streaming PC access to the configured server port (3000 by default). |
| Browser/OBS | A modern browser for controls and OBS Browser Source support; custom browser docks for the controller dock pages. |
| Canvas | Browser Source dimensions match your intended scene area; the selected landscape or portrait design fits proportionally. |

Set deployment values in the untracked `.env` before first startup:

| Variable | Purpose / requirement |
| --- | --- |
| `AUTH_REQUIRED` | `true` (default) requires control login and source tokens; `false` disables both. Only exact lowercase `true` or `false` is accepted; an empty or invalid value fails startup. |
| `CONTROL_PASSWORD` | Required only with AUTH_REQUIRED=true. Control/dock login; 16–1024 characters. No uppercase, digit, or symbol rule. Example values beginning with `replace-` are rejected. |
| `OVERLAY_TOKEN` | Required only with AUTH_REQUIRED=true. Read-only overlay/credits access; at least 24 characters. Example values beginning with `replace-` are rejected. |
| `CHESS_USERNAME` | Your Chess.com username; required for a fresh database. Subsequent account changes use Settings. |
| `HOST` | `127.0.0.1` for local-only use; `0.0.0.0` for access from your streaming PC. |
| `PORT` | Listening port; defaults to `3000`. |
| `DATA_DIR` | `./data` for local use; **`/var/lib/pawn-control` for the supplied systemd service**. |
| `COOKIE_SECURE` | `false` for plain LAN HTTP; set `true` when accessing the app through HTTPS. |
| `CHESS_USER_AGENT` | Optional API identification header; the example uses `PawnControl/1.0`. |

`npm run setup` writes AUTH_REQUIRED=true and generates a random 24-character control password and a 64-character overlay token, saves them in `.env`, and prints the control password. It never overwrites an existing `.env` or silently rotates credentials on service startup. Set the username and deployment-specific HOST/DATA_DIR afterward. No Chess.com API key, Twitch login, or external database service is required.

## Optional authentication for a trusted LAN

| Setting | Control panel and OBS docks | Overlay and credits sources |
| --- | --- | --- |
| `AUTH_REQUIRED=true` (default) | Password login required | Read-only URL token required |
| `AUTH_REQUIRED=false` | Opens without login | Clean URLs; no token required |

Password-free mode was confirmed working by the deployment owner on October 24, 2026.

Authentication is enabled by default, including for existing deployments that omit AUTH_REQUIRED. To open controls, docks, overlays, and credits without credentials, edit the untracked `.env`:

```dotenv
AUTH_REQUIRED=false
```

Restart the app/service (or recreate the Compose container). CONTROL_PASSWORD and OVERLAY_TOKEN can be omitted or left unchanged in this mode; they are ignored. The control panel and all dock pages open immediately, sign-out buttons are hidden, and Settings and the dock identify that authentication is disabled. Copy the clean Browser Source URLs from the UI:

- `http://SERVER-IP:3000/overlay`
- `http://SERVER-IP:3000/credits`

Anyone who can reach this deployment can view stream data, edit settings/scores, control playback, and export/import backups. Use this mode only on a trusted LAN or behind your own access controls. JSON request validation and cross-origin POST rejection remain enabled. AUTH_REQUIRED is deployment configuration, not an editable web setting or part of settings backups.

For a first-time installation without generated credentials, copy `.env.example` to `.env`, set AUTH_REQUIRED=false and CHESS_USERNAME, then configure HOST and DATA_DIR for your deployment. Existing placeholder password/token values are ignored in this mode. Setup continues to generate credentials with authentication enabled by default.

For the Linux systemd service, edit `/opt/pawn_control/.env` and run `systemctl restart pawn-control`; the supplied service already reads that file. For Docker Compose, edit `.env` and run `docker compose up -d --force-recreate` so the new environment is loaded. No service-file or port-mapping change is needed. After restarting, reload the control panel and OBS docks, then copy the clean source URLs into OBS and refresh those Browser Sources.

To re-enable authentication, set AUTH_REQUIRED=true, supply a valid CONTROL_PASSWORD and OVERLAY_TOKEN, and restart/recreate again. Refresh the panel/docks and replace token-free OBS URLs with the full URLs from Settings/Credits. All prior login sessions are invalid after restart; session results and layouts stay saved. Blank, misspelled, or other AUTH_REQUIRED values fail startup rather than disabling authentication.

## Restore starter tips and CTA messages

Use **Restore default tips** or **Restore default CTA messages** beside the content editor in the full panel, combined dock, or CTA dock. Defaults mean the starter templates shipped with the installed app version. The confirmation previews the exact resulting list, order, enabled flags, titles/categories and literal tokens before replacing custom content. New installs use “Enjoying the games? Follow {channel} for more chess!”; upgrading never rewrites your saved messages automatically.

Only the selected content list changes. Position, theme, appearance, timing, speed, mode, pause, visibility, account/channel, goals, session, scores, socials, credits and presets remain unchanged. This is separate from **Reset session**. A removed current playback item falls back to an available item; pause and hidden state are preserved.

**Add missing defaults** appends only absent starters. A matching ID, or exactly matching text (plus title/category for tips), counts as present regardless of enabled state. Edited matching-ID entries are never overwritten, and repeating the operation does not add duplicates. The server enforces the existing 100-tip and 50-message limits atomically; an over-limit operation adds nothing.

**Undo template change** restores the previous list once, on this page only. Closing or reloading the page loses undo. A later change to the same list invalidates it; stale restore/add/undo requests cannot overwrite newer content. Cancel retains unsaved drafts. Confirmation explicitly discards unsaved visual edits in that list; advanced text drafts remain intact and must be explicitly reloaded before applying to changed content. Keep a copy before leaving the page. A failed request retains drafts; review current content before retrying.

## Included

- Reference-inspired charcoal stats card with cyan username, aligned rating rows, and orange streak badge.
- Separate scoreboard and CTA ticker; each widget can be shown, dragged, resized, layered, and locked.
- Landscape/portrait layout editor, edge/grid snapping, numeric positioning, reduced-size preview, and optional safe-area/board/camera guides.
- Per-stat visibility and ordering; Minimal, Session, Full, and custom presets.
- Click W/L/D scores to increment, dedicated plus/minus controls, result recording, undo, editable ordered result history, reset, and session timer.
- Ticker with editable/reorderable messages, enabled flags, scrolling or rotation, speed, direction, timing, pause, dynamic values, and appearance controls.
- Chess.com ratings, personal bests, profile/avatar, goals, rating deltas, cached completed-game history, recent form, color win rates, average opponent rating, opening and ending summaries, accuracy coverage, and Puzzle Rush best when available.
- Instant updates to connected overlays through server-sent events (SSE), automatic reconnection, SQLite persistence, settings export/import, and local session history.
- Authentication enabled by default: password-protected control API and separate read-only overlay token. The overlay URL does not embed control credentials, and its token cannot authorize control actions.

## Using the control panel

1. Open `/control` and sign in with CONTROL_PASSWORD when authentication is enabled. In **Settings**, confirm the Chess.com player and optional channel / creator name and copy the complete OBS overlay URL (token-bearing when authentication is enabled).
2. In **Layout studio**, enable the widgets you want, drag/resize them, or enter exact coordinates. Use **Lock layout** to prevent accidental dragging. **Save preset** stores a reusable layout; it does not reset scores.
3. In **Stats & visibility**, choose visible rows and their order, the active time control, rating goals, and any manual rating overrides. The active time control controls the highlight and time-control-dependent metrics.
4. In **Session**, record each win/loss/draw. Use Undo for mistakes, Correct totals for count adjustments, and history edits when a result was recorded incorrectly. Start/pause/resume the clock or use Restart timer without clearing results. Reset session starts a new zero-score session.
5. In **CTA ticker**, add/edit/reorder messages, enable the ones to show, and choose scrolling or rotation. Pause ticker freezes movement; Show ticker controls visibility. In a compact CTA dock, expand **Ticker settings** for advanced options. Text/settings save when a control changes; finish a text edit by leaving its field.
6. For in-OBS control, use the combined `/dock` page described below. Use the overlay URL from Settings as the on-stream Browser Source (`/overlay` in open mode); controller/dock pages should not be used as broadcast sources.

Changes propagate to connected clients automatically and are saved in SQLite. Refresh stats checks Chess.com; it never adds results to your manual session.

## Session rules

The session clock has separate Start/Resume, Pause, and Restart controls. Restart returns only the clock to `00:00:00` and starts it immediately; scores, streak, and game history stay intact. Reset session still clears the entire session. Timer actions synchronize between the main panel and OBS docks.

“Record win/loss/draw” and clicking a score append an ordered result. The minus button removes the latest matching result (or reduces a positive manual correction). Editing history recalculates streak. A draw breaks a win/loss streak. Direct total corrections do not fabricate chronological results; streak derives only from recorded results. Win rate is wins / (wins + losses + draws). Recent session results show the last ten ordered entries. Undo restores the previous session, including a reset. New sessions start at zero and snapshot available ratings. Session timer starts paused; start it when going live.

Session scores, streak, best session streak, session win rate, and session results are **manual stream-session statistics**, not imported from Chess.com. Empty values (`—`) or `0W` are expected before you record games. Saved sessions survive app restarts. A running clock measures elapsed wall time, including time while the app is stopped; pause it when ending a stream if you want to resume the same session later.

## API refresh and data meaning

- Profile: startup and daily, subject to upstream cache headers.
- Ratings: startup, then a five-minute scheduler, respecting upstream freshness and conditional requests.
- Current-month archive: fetched only when a historical stat is enabled. Also fetch the previous month for a recent sample across a month boundary.
- Requests are serial, timeout after 15 seconds, use ETag/Last-Modified validators, and back off on errors/429. “Refresh now” requests a check but cannot bypass upstream caching or retry backoff.
- Local scores, visibility, layout, and ticker changes propagate immediately.
- API failures retain the last good values. The control panel distinguishes last check, last successful response, rating game timestamp, and errors. No sample ratings are presented as live data.
- Optional manual rating overrides are clearly labeled in the panel and removed with “Use API”. Session rating deltas use one baseline per time control; if no rating exists at session start, the first available rating establishes the baseline.
- Historical metrics use up to the last 50 completed standard-chess games in the current and previous UTC months, filtered to the active time control. They are not lifetime statistics. Accuracy averages include only games with accuracy and show coverage. Opening labels are taken from available archive ECO data.

Chess.com data is cached and is **not guaranteed live**. Its documentation describes long refresh windows, so a post-game rating may remain unchanged even after Refresh now. Manual session tracking remains authoritative and is never silently overwritten by archive data.

Official references: [Published-Data API](https://www.chess.com/news/view/published-data-api), [caching guidance](https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it).

## Ticker tokens

New installations default to continuous scrolling. Existing installations retain their saved mode: select **CTA ticker → Display mode → Continuous scroll** for moving text and make sure **Pause ticker** is unchecked. Message rotation shows one CTA at a time, changing every configured interval (25 seconds by default).

`{username}`, `{channel}`, `{wins}`, `{losses}`, `{draws}`, `{streak}`, `{blitz_rating}`, `{rapid_rating}`, `{bullet_rating}`, `{blitz_goal}`, `{rapid_goal}`, `{bullet_goal}`. A message with an unavailable rating is skipped. Unknown tokens remain visible so they can be corrected. No enabled/usable messages means the ticker hides. All messages are plain text, never HTML.

**Channel / creator name** in Settings is optional display text, independent of your Chess.com username and the optional Share / Recap stream link. Names may contain spaces, Unicode and punctuation, up to 80 UTF-16 code units (the browser input limit); line breaks and control characters are rejected. The settings form trims outer whitespace. Blank or whitespace-only names render `{channel}` as **this channel** (for example, “Follow this channel for more chess!”), and the ticker badge as **LIVE** in both landscape and portrait. Names are displayed as text, never HTML; long badges are truncated visually to leave room for messages. New installations start with a blank creator name and neutral Pawn Control branding. Existing saved credit branding is preserved. Existing saved names, custom templates and backups remain intact under the compatible internal `channel` key. Backup import/export preserves the value, including blank; layout preset loading and session/content resets do not change your identity. Recaps continue to use `{username}` for the Chess.com player and `{stream_link}` for your separately configured link.

## Linux systemd service setup

These commands assume Debian/Ubuntu Linux with systemd running as the service manager. They work on bare metal, a VM, or a container that supports systemd; they do not apply to Windows/macOS or minimal containers without systemd. Use the quick start for local development or the optional Docker setup below instead. Install Git, curl, and Node.js 24 LTS using your trusted package source, and verify `node --version` is v24 or newer.

The repository and installation directory use the same name: `pawn_control`. The service expects the checkout at `/opt/pawn_control`. Install Git and configure access to the private repository on the server first.

Before installing the unit, verify the system-wide runtime:

```sh
command -v node
node --version
/usr/bin/node --version
```

The service requires Node.js 24+ at `/usr/bin/node`. If Node exists elsewhere (for example `/usr/local/bin/node`), set `ExecStart` to that absolute path before copying the unit. A root-only nvm installation under `/root` is not accessible to the `pawn` service with `ProtectHome=true`; install Node system-wide instead. If no Node executable is found, install Node.js 24 LTS from a trusted distribution source or the [official Node downloads](https://nodejs.org/en/download) before continuing.

Run the following in a root shell (for example, `sudo -i`) on the Linux server for a new installation:

```sh
useradd --system --user-group --home /opt/pawn_control --shell /usr/sbin/nologin pawn
mkdir -p /opt /var/lib/pawn-control
git clone git@github.com:techtimefly/pawn_control.git /opt/pawn_control
cp /opt/pawn_control/.env.example /opt/pawn_control/.env
# Replace the example placeholders in /opt/pawn_control/.env with a 16+ character password, 24+ character token,
# and HOST=0.0.0.0. Generate random credentials with your password manager.
# For trusted LAN use without credentials, set AUTH_REQUIRED=false instead.
# Set CHESS_USERNAME to your Chess.com username before first startup.
# Set DATA_DIR=/var/lib/pawn-control.
chown -R pawn:pawn /var/lib/pawn-control
chown root:pawn /opt/pawn_control/.env
chmod 640 /opt/pawn_control/.env
cp /opt/pawn_control/deploy/pawn-control.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pawn-control
systemctl status pawn-control
```

The unit remains named `pawn-control.service`, and persistent data stays at `/var/lib/pawn-control`. `StateDirectory=pawn-control` creates that directory at service startup with ownership for `pawn`, before filesystem sandboxing is applied. Only the checkout path uses the underscore. `WorkingDirectory` and `EnvironmentFile` use `/opt/pawn_control`; `ExecStart` invokes `/usr/bin/node` with `/opt/pawn_control/server.mjs`. The service defaults DATA_DIR to `/var/lib/pawn-control`; keep that value in `.env` too, since EnvironmentFile values take precedence. A different DATA_DIR also requires updating the unit's writable-directory settings and permissions.

If Node is installed at a different system-wide path, prefer a persistent override so future service-file updates do not undo it. Run `systemctl edit pawn-control` and enter, for example:

```ini
[Service]
ExecStart=
ExecStart=/usr/local/bin/pawn-node /opt/pawn_control/server.mjs
```

Use the actual executable path on your machine. Do not point it at `/root/.nvm/...` or symlink into `/root`. An independently installed/copied executable such as `/usr/local/bin/pawn-node` must be executable by `pawn`; check with `runuser -u pawn -- /usr/local/bin/pawn-node --version`. If using a copied binary, update that copy when upgrading Node. Drop-ins under `/etc/systemd/system/pawn-control.service.d/` survive replacement of the main unit file.

For an existing installation already at `/opt/pawn_control`, update the installed service after pulling:

```sh
git -C /opt/pawn_control pull --ff-only
cp /opt/pawn_control/deploy/pawn-control.service /etc/systemd/system/pawn-control.service
systemctl daemon-reload
systemctl restart pawn-control
systemctl status pawn-control
```

If your checkout is elsewhere, adjust all three service paths before installing it. If migrating from `/opt/pawn-control`, preserve its `.env` and continue using the existing `/var/lib/pawn-control` data directory. Do not rerun first-install commands over an existing configuration.

The service uses `/usr/bin/node`; adjust ExecStart if your Node installation differs. Logs: `journalctl -u pawn-control -f`. Health: `curl http://127.0.0.1:3000/health`. Keep LAN access restricted to trusted devices. For remote use, prefer your VPN. HTTP passwords are visible to observers on the network; use a TLS reverse proxy if the LAN is not trusted. Set COOKIE_SECURE=true when serving through HTTPS. A proxy must forward SSE without buffering and permit long-lived connections.

After starting or updating, allow Node to finish initializing and verify readiness rather than relying only on systemd's immediate "active" status:

```sh
curl --retry 10 --retry-connrefused --retry-delay 1 http://127.0.0.1:3000/health
ss -tlnp | grep ':3000'
```

Expected health response: `{"ok":true}`. Replace port 3000 above if you configured another port. Then open `http://SERVER-IP:3000/control` from the streaming PC. For ordinary code updates, pull and restart; reload the control panel/dock and refresh the OBS Browser Source to load changed frontend modules. Copy/reload the service unit when its configuration changes, as shown above. Preserve `.env` and DATA_DIR; do not rerun first-time setup to upgrade.

### Optional Docker deployment

Optional container image: `docker compose up -d --build` after configuring `.env` with real credentials and CHESS_USERNAME. Keep PORT=3000 for the supplied `3000:3000` mapping, or adjust the mapping to match. Compose sets HOST=0.0.0.0 and DATA_DIR=/app/data; a named volume holds SQLite data. The image uses Node 24. This deployment does not use the systemd unit.

### Startup troubleshooting

- `226/NAMESPACE` mentioning a missing `/var/lib/pawn-control`: update the installed unit to the version with `StateDirectory=pawn-control`, then reload systemd. For older units, create it with `install -d -o pawn -g pawn -m 0750 /var/lib/pawn-control`.
- `203/EXEC` and `Unable to locate executable '/usr/bin/node'`: Node is missing at the configured path. Check `command -v node`, install Node 24+ system-wide if necessary, or update `ExecStart` to the real system-wide executable. This error happens before application code runs.
- After correcting the unit/runtime, use `systemctl daemon-reload`, `systemctl reset-failed pawn-control`, `systemctl restart pawn-control`, then `journalctl -u pawn-control -n 50 --no-pager`.
- An error trying to create `/opt/pawn_control/data` under the hardened service: set `.env` DATA_DIR to `/var/lib/pawn-control`, not `./data`, and restart.
- Password/token startup rejection with AUTH_REQUIRED=true: check the length requirements above and replace example credentials. Do not paste `.env` into logs or support messages.
- A black OBS source: verify the full token-bearing overlay URL, source dimensions matching the intended scene area, and visibility settings. If that exact URL works in a browser on the streaming PC but OBS stays black, restart OBS and check its browser-source logs if necessary.
- CTA additions on plain HTTP are supported; if an older UI still reports `crypto.randomUUID is not a function`, update the checkout and hard-refresh the control panel/dock.

`StateDirectory` behavior is documented in [systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#RuntimeDirectory=).

## Backups and maintenance

### Secrets and Git

Commit `.env.example` with placeholders, never the real `.env`. With authentication enabled, the two application secrets are CONTROL_PASSWORD and OVERLAY_TOKEN. Generate them in a local checkout with `npm run setup`, or supply them through the service environment. Chess.com public data needs no API key, and no streaming-platform account or token is required. Keep SSH deployment keys outside the project and never put them in browser code. If GitHub Actions deployment is added, store deployment credentials in GitHub Actions secrets, not repository files.

The ignore rules exclude `.env` variants (except `.env.example`), runtime data, databases, logs, and common private-key files. The Docker build context excludes these too. Ignore rules do not remove already tracked secrets; if a real credential is ever committed, rotate it and remove it from history as appropriate. Application files live at the repository root; development preview data and credentials must remain outside the repository.

Back up the entire DATA_DIR and `.env` to protected storage. SQLite uses WAL, so stop the service before copying the data directory and restart it after the copy finishes; copying only the main database while the app runs is not a consistent backup. For the supplied Linux service, a manual backup can be made from a root shell as follows:

```sh
backup_dir="/var/backups/pawn-control/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "$backup_dir"
systemctl stop pawn-control
cp -a /var/lib/pawn-control "$backup_dir/data"
cp -p /opt/pawn_control/.env "$backup_dir/.env"
systemctl start pawn-control
systemctl status pawn-control
```

Check both copy commands succeeded before relying on the backup. Keep the backup directory private: it contains credentials. To restore, stop the service, restore the saved data directory and `.env` to their original paths, ensure the data belongs to `pawn:pawn` and `.env` is `root:pawn` with mode `640`, then start the service and check `/health`. Preserve a copy of the current data before restoring. For Docker, stop the Compose service before backing up its named data volume and restart it afterward; the Linux paths above apply only to the supplied systemd unit.

The Settings export is a portable settings/session backup, excluding credentials and API cache. Import validates and replaces settings/session, leaving credentials unchanged. Saved layouts include appearance and widget configuration, not scores. Keep tokens out of screenshots and source control. Rotate the overlay token in `.env` and restart if leaked.

## Development and verification

```sh
npm test
npm start
```

Tests exercise session/streak rules, undo/reset, validation, ticker substitutions, cache behavior, authentication, read-only overlay access, persistence, and realtime delivery. Browser QA should also check a real OBS source for transparency, readability at 1080p, reconnection, and network access from the streaming PC. This project can be prepared locally without access to your Linux server; deployment and real OBS verification remain host-side steps.

## Files

`server.mjs` HTTP/auth/realtime server · `setup.mjs` first-run configuration · `lib/` state, storage, API adapter · `public/` control panel and overlay renderer · `test/` tests · `deploy/` Linux systemd service · `.env.example` configuration.

## OBS browser docks

Recommended: add **`http://SERVER-IP:3000/dock`** once for a combined dock with **Score / CTA / Credits / Tips** tabs and a single login when authentication is enabled. With AUTH_REQUIRED=false no login is needed. Switching tabs stays on the same page and connection. The selected tab is remembered in that browser across refreshes when local storage is available. The header shows connection status, plus Sign out when authentication is enabled or an authentication-disabled indicator otherwise. With authentication enabled, the session expires normally after 12 hours. Separate dock URLs remain available below.

Add these URLs in **OBS → Docks → Custom Browser Docks** (replace SERVER-IP):

| Dock | URL | Controls |
| --- | --- | --- |
| Combined | `http://SERVER-IP:3000/dock` | Score, CTA, Credits and Tips tabs, one login, remembered tab, shared connection status and sign-out |
| Score | `http://SERVER-IP:3000/dock/score` | W/L/D, plus/minus, undo, corrections, reset, result history, and start/pause/restart clock |
| CTA | `http://SERVER-IP:3000/dock/cta` | Add/edit/reorder/enable messages, pause/show ticker, scrolling/rotation and appearance settings |

Sign in with your control password inside OBS when authentication is enabled. These are controller pages, not on-stream Browser Sources; do not use the read-only overlay token. Both docks share saved state with the main control panel and overlay, and retain their dock mode when refreshed. Start with a width around 360–420 px and resize as needed. Dock links are also available in the main Settings page. Continue using `/overlay?token=...` for the on-stream overlay, or `/overlay` with AUTH_REQUIRED=false.


## End credits and chess tips

Both widgets start hidden on the main overlay. Enable them in their editors or Layout Studio; drag, resize, lock, layer, and save them with a layout. Existing settings and saved layouts upgrade without resetting scores. Imported older backups also receive the new defaults.

### End credits Browser Source

1. Open **End credits** in the control panel, or **Credits** in the combined OBS dock. Edit, reorder, and enable sections and entries. The initial editable template uses the supplied hardware/software example; review it before broadcasting.
2. Copy the dedicated **credits Browser Source URL** from that page. With authentication enabled it is `/credits?token=YOUR_OVERLAY_TOKEN`; keep it private just like the overlay URL. With AUTH_REQUIRED=false it is simply `/credits`.
3. Add it as a Browser Source to your ending scene, with dimensions matching its intended scene area (for example **1920 x 1080**). The source restarts automatically on OBS source activation and stops/resets on deactivation. Keep **Refresh browser when scene becomes active** enabled as a reload fallback.
4. Credits automatically scroll on page load. The default is a 60-second run followed by a held final message. Choose a total duration or scroll speed, optional looping, font sizes, spacing, colors, and background opacity in Credits settings.

The dedicated source listens to the [OBS per-source activation event](https://github.com/obsproject/obs-browser#register-for-event-callbacks), independently in each browser source. Repeated active notifications do not interrupt playback. Ordinary browser previews still autoplay on load; switching browser tabs does not restart them. Use a dedicated source for the ending scene: if the same OBS source remains active in both scenes, OBS has no deactivation/reactivation to report. This behavior does not restart the main overlay or the editor preview.

Advanced Scene Switcher can activate your ending scene normally; no control-panel click is needed to start credits. If a macro should leave that scene afterward, configure its delay to match your chosen total duration. Pawn Control does not switch OBS scenes or emit a completion event.

**Play live**, **Pause live**, **Restart live**, and **Hide live** affect currently connected credits sources, including the main overlay credits widget when enabled. Play resumes a paused run or replays a completed run. Restart begins from the top. A newly loaded dedicated source autoplays, independently of an earlier hide or pause command, unless OBS has reported it inactive. While inactive, live dock commands cannot start that source; the next activation always restarts it. The dedicated source works even when the main overlay credits widget is hidden.

The editor has separate **local preview** controls: opening the editor and playing its preview do not start credits on live sources. Settings edits are shared live, so finish editing before airing the ending scene.

### Chess tips

Open **Chess tips** in the full panel or **Tips** in the combined dock. Add editable text with an optional title and category, enable or reorder entries, select sequential or shuffled playback, and set the rotation interval (5-300 seconds). Enable **Show tips widget**, then position it in Layout Studio. Next, Previous, Pause, and Resume controls update connected viewers. Shuffle avoids repeating the same tip immediately when multiple tips are enabled.

The supplied tips are general chess advice; this widget displays your own text and does not analyze live positions. Empty or disabled tips are skipped. Tip controls and credits controls share the same existing dock login.


### Advanced text entry for CTA ticker

Open **Available variables — names, scores and ratings** above the editor for all supported variables, descriptions and examples. This reference is available in the visual editor, advanced editor and both docks. **Examples and help** groups format instructions, append/replace safeguards, limits, multiline text and preview behavior into short sections.

The visual editor remains the default in the full CTA panel, combined CTA dock and separate `/dock/cta`. Choose **Advanced text mode**, an explicit **Structured blocks** or **Simple list** format, and **Append** or **Replace all**. **Preview changes** validates every block and displays the resulting messages as plain text, with literal tokens. **Apply preview** saves only that preview. Replace all always requires confirmation, including an empty replacement. Cancel keeps your draft.

Structured blocks are separated by a blank line. `Text` is required and nonblank; `Enabled` accepts only `yes` or `no`. New messages default to enabled. Example for new messages:

```text
Text: Follow {channel}: more chess!
Enabled: yes

Text: Wins: {wins} — thanks for watching ♞
Enabled: no
```

Loading saved messages includes an `ID: ...` line. Keep it to retain identity, ordering, enabled status and other saved metadata, including for messages with identical text. Omitted `Enabled` on an existing ID retains its saved value. IDs must belong to the current saved list and cannot repeat. Remove IDs for **Append**, which creates new messages. Unknown fields and duplicate fields are errors with line numbers. Limits match the server: **50 total messages**, **500 characters of text**, **80 characters per ID** (JavaScript UTF-16 length).

For multiline text, significant outer whitespace or text starting with a quote, use a JSON quoted string:

```text
Text: "First line: {channel}\nSecond line: ♞ {wins}"
Enabled: yes
```

The serializer uses this quoted form automatically. Values never execute HTML. Colons, Unicode and token spelling are preserved. Known tokens substitute only in live output; unknown tokens remain literal, and messages needing unavailable values are skipped as before.

Simple list uses one nonempty trimmed line per new enabled message:

```text
Follow {channel} for more chess!
Session wins: {wins}
```

**Simple list cannot represent IDs, disabled flags, other metadata or multiline messages.** Switching formats requires confirmation and starts a fresh draft; simple starts empty rather than flattening saved content. Cancel preserves the previous format and draft. Simple Replace all creates new IDs and enabled messages. Copy anything you need before confirming a format switch or reload.

Drafts and one-step **Undo last text apply** live only in this browser page. Tab navigation warns and retains the draft; switching to the visual editor asks before discarding it. Reload, closing the page, signing out or restarting the browser loses drafts and undo. The browser's leave-page warning requires browser support and prior interaction. A subsequent message edit invalidates undo; behavior/appearance changes alone do not. Server-side expected-list comparison prevents apply or undo from overwriting newer messages. SSE never rewrites the text draft. On a connection/save failure, the input remains available for preview/retry. If the save reached the server but its response was lost, reload the current list after copying the draft to reconcile it; stale retries cannot append twice.

Text actions change only messages, preserving ticker settings and unrelated state. Identical applies do not send a write. Unrelated SSE updates retain ticker DOM and clocks. Rotation keeps the current message ID and interval progress through edits/reorders when possible; removal/disable/unavailable text selects the item at the previous position, clamped to the remaining list, with a fresh interval. Scrolling preserves the visible message's leading-edge offset when it survives a content change; if removed, it starts at the first remaining item. Changed text widths may alter wrapping or scroll geometry. Empty sets hide output. Pause freezes playback; hiding alone keeps the viewer's clock running. Switching scroll/rotate starts that mode's clock. Clocks remain per viewer, and a newly loaded viewer starts at the beginning.

Disposable browser regression fixture: `node scripts/cta-qa.mjs`, then open `http://127.0.0.1:3327/qa` and click **Run CTA browser checks**. It uses temporary SQLite state, no `.env` and no external polling. Stop with Ctrl+C when finished. Real OBS embedding still requires a separate check.

### Advanced text entry for chess tips

The visual editor remains the default in the full panel and combined Tips dock. Choose **Advanced text mode**, select **Structured blocks** or **Simple list**, then choose **Append** or **Replace all**. **Preview changes** validates the draft and shows the complete resulting list before **Apply preview** can save it. Replacement requires confirmation, including replacing with an empty list.

Structured blocks use a blank line between tips:

```text
Title: Control the center
Category: Opening
Enabled: yes
Text: Influence the central squares with your pawns and pieces.

Text: Check your opponent's threats before moving.
```

Only Text is required. New tips default to enabled, with empty title/category. Enabled accepts exactly `yes` or `no`. Unknown or duplicate fields, empty Text, and exceeded limits produce line-specific errors. Limits remain 100 total tips, 120 title characters, 60 category characters, and 600 text characters.

Loading existing tips adds an `ID:` line to each block. Keep these IDs when editing or reordering: they preserve identity even for duplicate content and retain omitted title/category/enabled values. Remove an ID to create a genuinely new tip; IDs are rejected for Append. Unquoted values trim surrounding whitespace. JSON quoted values preserve significant whitespace, quotes, and multiline content, for example `Text: "First line\nSecond line"`. The serializer uses this notation automatically when necessary. Existing empty tip text must be filled before structured validation succeeds.

Simple list creates one new enabled tip per nonempty line. It cannot preserve titles, categories, disabled flags, or IDs. Changing formats requires confirmation and starts a fresh draft; it never silently converts existing tips into a lossy representation. All content is plain text, including HTML-like strings.

Drafts stay intact during realtime updates and when switching panel/dock tabs. Leaving a dirty draft asks for confirmation; leaving/reloading the page uses the browser's unsaved-change warning. If another client changes the tips, copy any draft you need, then **Reload current tips** and preview again. Saves and undo check the expected list atomically on the server, so a stale draft cannot overwrite newer tips.

**Undo last text apply** restores the preceding list while this page remains open, provided no later tip edit changed that list. It does not undo playback commands or unrelated settings. Reloading/closing the page clears this one-step undo; export a backup first if longer-term recovery is needed. Normal next/previous, pause/resume, shuffle, and retained-current-tip behavior remain unchanged.

## Resolution and fit policy

Both `/overlay` and `/credits` select their composition through an explicit URL parameter. `?layout=landscape` uses 2560 x 1440; `?layout=portrait` uses a separate 1080 x 1920 composition. Existing URLs without a layout parameter retain landscape. Changing the editor selector never changes an already open output source, so both compositions can run simultaneously with shared live scores, ratings, tips, CTA messages, socials and credits.

Scale is `min(viewportWidth / designWidth, viewportHeight / designHeight)`, with equal transparent margins on opposite sides. Landscape fills 1280 x 720, 1920 x 1080, 2560 x 1440 and 3840 x 2160. Portrait fills 1080 x 1920 and 720 x 1280. Other aspect ratios retain the chosen composition without stretching, cropping or breakpoint reflow.

### One broadcast, two layouts

Select **Landscape** or **Portrait** in **Layout studio**. Positions, sizes, visibility, widget scale, locks and snapping are saved separately. The initial portrait preset places a compact two-column stats header above a clear board region, with scores and CTA below. The **Portrait typography** controls tune portrait card, ticker, tips, socials and credits text independently; the existing appearance/content editors retain their landscape typography controls. Colors and content remain shared. Use the dock Visibility section or contextual widget controls to toggle Landscape and Portrait independently; Layout studio uses the same saved visibility values.

Optional safe-area guides have configurable top/right/bottom/left insets. Board and camera reservations have configurable rectangles and individual enable switches. Drag a reservation label to move it, or its cyan bottom-right handle to resize. The existing Snap to grid option uses the same 20-unit design grid and canvas edges; Lock aspect ratio preserves the current rectangle ratio when resizing, including width/height field edits. Layout lock disables guide dragging. Escape, pointer cancellation, leaving the editor, or switching orientation cancels an unfinished drag. Numeric guide edits remain available for precise placement. Landscape and portrait guide geometry and ratio locks are saved independently. Guide edits update only that guide and reject a stale edit if another client changed it, preserving newer widget changes. They are editor guides only: no board, camera, placeholder or guide is rendered by the broadcast output. Supply board and camera as separate OBS sources underneath the transparent overlay, and position the widgets around those regions.

Settings exposes separate landscape and portrait overlay URLs, and End credits exposes both credits URLs. For open mode, use `/overlay?layout=portrait` or `/credits?layout=portrait`; authenticated URLs also include the existing read-only `token` parameter. Copy the full URL, including both parameters. Set portrait Browser Sources to **1080 x 1920** or **720 x 1280** and landscape sources to their intended 16:9 dimensions.

Upgrading retains the exact existing landscape settings and adds the portrait preset. Saved presets and exported backups contain both compositions and their guides; loading a preset restores both layouts and shared presentation settings, without resetting scores. Older presets/backups gain the portrait defaults. Explicitly restoring a backup still restores its saved session. Keep a current backup before moving data to an older app version, which cannot interpret the new layout settings.

In OBS:

1. Copy the overlay or dedicated credits URL from the controller. Set Browser Source Width and Height to the intended area in scene pixels, e.g. 1920 and 1080 for a full 1080p scene. There is no required 2560 x 1400 workaround.
2. For an existing source with old transforms, use Transform > Reset Transform, then Transform > Fit to Screen for full-scene use. Clear any intentional crop if you want the entire source visible. For a partial-scene area, position the source at its intended location and keep its dimensions proportional.
3. Browser Source dimensions determine the web viewport. Settings > Video > Base (Canvas) Resolution determines the scene coordinate space. Output (Scaled) Resolution determines the encoded stream; changing only output resolution does not resize a browser viewport. A 2560 x 1440 base with 1920 x 1080 output can still use a 2560 x 1440 full-scene source.

The overlay page and fit margins stay transparent. Credits' configured background/opacity applies only to the fitted design rectangle (opaque black by default); set opacity to 0 for transparent credits, or place an OBS Color Source behind it if you want solid color across non-16:9 margins.

Resizing updates only the outer transform: crawl geometry, speed/duration, pause/final state and source activation behavior stay unchanged. A source reload still starts a new run as before. Layout Studio uses the selected design dimensions for its fit, drag and resize math. The dedicated portrait credits source wraps long text and fits its closing message within the frame; the content editor's small credits preview remains landscape.

## Social handle callouts

Open **Socials** in the full panel or combined `/dock`. Add up to 20 entries, choose Twitch, YouTube, Discord, Instagram, TikTok, X, Bluesky or Website, and enter a handle/display text/short URL (120 characters) plus optional call to action (80 characters). All content is plain text; URLs are never opened or fetched. No account login, OAuth, posting, follower counts or platform integrations are involved.

Edits stay in a local draft until **Save socials**. Reorder, enable or remove individual entries. Drafts survive realtime updates and panel-tab changes; failed saves/uploads retain them. A conflicting edit from another client is rejected instead of overwriting it. **Reload current socials (discard draft)** explicitly discards your local changes. The browser warns before leaving a dirty draft; accepting that warning or restarting the browser loses the draft. Uploading stores an icon immediately; saving publishes its assignment to the entry.

Choose **Rotate one at a time** (5–300 seconds) or **Static row (wraps)**. Previous/Next/Pause/Resume act on connected viewers. Each viewer has an independent elapsed-time rotation; a newly loaded viewer starts at the first enabled entry. Unrelated state updates and hide/show retain its current item and elapsed progress. Pause/resume preserves the remaining interval; manual next/previous starts a fresh interval. Reordering retains the current ID; disabling/removing it selects the nearest remaining position and resets that interval. Blank and disabled entries are skipped; with none, the output is empty. Static rows show all enabled entries; playback controls affect the retained rotating selection when returning to rotation.

Enable **Show socials widget** for landscape, or select Portrait and enable socials in **Layout studio**, then position, resize, lock and layer it in that composition. Colors/background/radius follow Appearance; text size is 18–60px before widget/content scaling, with a separate portrait typography setting. Rows wrap and scale down to fit the widget. Large lists in small widgets can become unreadable: use rotation, fewer entries, or a larger widget. The Socials content preview scrolls at a readable size; Layout studio previews the actual output fit.

### Custom icons and portable backups

Upload/replace a **PNG** from an entry, or choose **Use platform icon** to remove its custom assignment. Accepted files are non-interlaced, 8-bit RGB/RGBA PNG, 1–512 pixels per dimension, at most 200 KiB. Palette/grayscale PNG, JPEG, GIF, WebP, SVG and HTML uploads are not supported; export an RGB/RGBA PNG in your image editor. Server validation checks PNG signature, chunk boundaries/CRCs, dimensions, compressed stream length, bounded decompression, exact scanline lengths and filters. Metadata is stripped; only IHDR/IDAT/IEND are stored. No new dependencies.

The library allows 30 custom icons and 1 MiB of validated PNG bytes total. Uploads always receive a new generated identifier; original filenames and filesystem paths are never used. **Manage uploaded icons** allows deletion only when no saved entry or preset references an icon; the UI also protects the current draft. Replaced/unassigned icons stay available until explicitly removed. Deleting an unused icon referenced by another client's unsaved draft makes that client's save fail safely with its draft retained.

Backups embed the bounded icon library once as base64, with entries/presets referring to IDs. Import validates the images and references before an atomic state replacement, so another installation receives working icons rather than local paths. Backups contain no control password or overlay token. Import request limit is 6,000,000 bytes. Legacy state, presets and backups gain an empty hidden Socials widget; existing scores, timers and overlays remain intact. As before, explicitly restoring a backup restores its saved session.

Upload, library management and export require the control session when authentication is enabled, following the existing same-origin JSON POST restrictions. Image reads accept that session or the existing overlay read token and return `image/png` plus `nosniff`. With `AUTH_REQUIRED=false`, the existing open-LAN access model also applies to icons. Icons contain no remote-image references.

Built-in brand paths come from Simple Icons 16.0.0; the generic globe is original. See [artwork provenance and brand guidance](licenses/social-icons.md), [CC0 text](licenses/simple-icons-LICENSE.md), and [upstream disclaimer](licenses/simple-icons-DISCLAIMER.md). Brand marks identify destinations and do not imply endorsement.

### Shared Handle Groups

Each Socials callout has one handle/display label, one optional CTA and an ordered list of 1–20 platform icons. Use **+ Add platform** to share the handle across built-in icons or uploaded PNGs. Edit the handle once; reorder icons with **Icon left/right**, toggle **Show icon**, or remove a platform. Static rows and rotation show the handle once per callout. Disabled callouts, blank handles and groups with no enabled platforms are hidden; rotation treats a group as one item.

**Group matching handles** previews the exact callouts and icon order before **Apply to draft**. It only offers nonblank handles whose text, CTA and callout enabled state match exactly, including case, spaces and `@`; it never interprets URLs or strips text. Different CTA/settings remain separate. Groups exceeding 20 icons are excluded. The first callout keeps its identity/position and the icons retain their order, enabled flags and custom assets. Existing duplicates stay independent unless you confirm grouping.

**Split to callout** previews moving one platform to a new callout immediately after its group, retaining the handle, CTA and enabled settings. **Undo last group / split / removal** restores the preceding draft, including after saving, until a later edit changes it. Save again to publish an undo. Undo is one step, local to the page, and subject to the same stale-edit protection. Reload current socials clears draft and undo history. Draft/undo custom assets cannot be deleted from that page's library; server checks always protect references in saved groups and presets.

Old Socials states, presets and version-1 backups remain accepted losslessly as independent single-platform groups. Conversion to the explicit platform-list representation occurs when the editor saves; merely reading/importing legacy entries does not rewrite their IDs or settings. New backups include grouped platforms and uploaded assets; importing a new grouped backup requires this version or newer. Existing scores, sessions and layouts are unaffected. The 20-callout, 120-character handle, 80-character CTA and PNG limits still apply. Very dense groups need a suitably sized widget; use Layout studio to check actual fit.

Portrait tips and rotating CTA text reduce their font size to fit the chosen widget. Very long copy may become small: enlarge the widget or shorten the text for comfortable on-stream reading. Scrolling CTA mode retains its configured font size.

## Session Recap & Share

Open **Share / Recap** to prepare a manual social post. The dashboard shows wins, losses, draws, games played, rounded win rate, best winning streak, and the available rating for the selected time control. Win rate is wins divided by all games, including draws; zero games displays **N/A**. Best winning streak comes from ordered recorded results, not manual total corrections. Ratings use the same current API value or manual override as the app; unavailable ratings are labeled, and no rating change is invented.

Choose **Live Update** or **Session Complete**, then **Apply template to text** to generate a message. Changing message type never silently replaces text. Templates support `{username}`, `{wins}`, `{losses}`, `{draws}`, `{games}`, `{win_rate}`, `{best_streak}`, `{rating}`, `{time_control}`, `{stream_link}`, and `{hashtags}`. Unknown variables remain literal. Edit the two reusable templates and optional stream link/hashtags, then **Save templates & additions**. These additions appear only where their variables are used. All content is plain text.

**Save draft** persists your message and captured statistics. **Refresh draft statistics** explicitly captures current data while preserving your wording; review it or apply the template again so the text matches the numbers. Realtime score changes never rewrite drafts. **Copy message** reports success only after the clipboard accepts it; if unavailable or rejected, the message is selected for manual copying. The character counter counts Unicode code points; individual social platforms may count differently. Nothing is posted automatically.

**Save completed recap** freezes the displayed statistics and message in a saved snapshot. Open a completed recap to copy it or **Save text revision**; revisions change only text, not frozen statistics. To capture different statistics, create another recap. **Save completed recap & reset** atomically saves the recap and starts a new session with zero scores, empty history and a paused timer. Existing settings and recaps remain. The Session reset control opens this workflow; **Reset without saving a recap** is a separate confirmed action. Undo of a session reset does not remove the saved recap.

Conflicting recap edits or changed session data reject stale saves and resets while retaining your local edits. Refresh the statistics for a changed session, or copy any unsaved text before deliberately reloading saved recap data after an editor conflict. Saved drafts, templates and completed recaps survive server restart. Unsaved edits remain in the open page only and show a leave-page warning.

Recaps are stored in the existing SQLite state and included in **Export backup**. Import validates recap data and rejects a concurrent recap replacement; an older backup without recap data preserves existing recaps. As before, importing a backup explicitly restores its session and settings. Recap content is excluded from the public overlay state and event stream and requires control access when authentication is enabled. Open mode follows the app's existing local-access behavior. Limits: 100 completed recaps, 10,000 UTF-16 code units per message/template, 2,000 for stream link and 1,000 for hashtags. Export before deleting a completed recap you want to retain. No social accounts, publishing integration, game imports, or downloadable graphics are included in this milestone.

## Session timer and captured recap duration

The full control panel, combined dock and score dock share Start / Pause / Resume, **Reset timer**, and **Restart & run**. Reset timer confirms before zeroing the clock and leaving it stopped; Restart & run confirms before zeroing and starting immediately. Neither changes scores, history, corrections or streaks. Status reads Running, Paused, or Not started (zero and stopped). A running clock includes time while the panel or server is closed. Timer buttons disable while confirmation or saving is pending, capture the intended command before queueing, and recover after errors.

Undo of a score edit restores only results and corrections, preserving the current clock. Undo of a timer command restores the elapsed value captured immediately before that command and its running/stopped state, using a fresh running anchor so time spent paused or awaiting undo is not added. Full-session reset/import undo, including older saved undo entries, intentionally retains its whole-session restoration semantics. Existing saved state, presets and backup format remain compatible.

Recap statistics include **Captured duration**, measured by the server at the same instant as the other captured statistics. Use Refresh statistics to include more running time, then Apply template to update generated text. `{duration}` renders hours:minutes:seconds. The first template application captures a draft first; completing without a saved draft first captures statistics and asks you to review before completing again. Saving existing draft text does not refresh statistics. Completed recaps freeze their captured duration, including through later resets, undo, text revisions and server restarts. Timer ticks do not change recap conflict keys. Older recaps without duration remain valid and display `unavailable`; no historical duration is inferred.

## Goals dashboard and featured overlay

Open **Goals** in the broadcast desk to add session wins, games played, rating milestones, or manual counters. Up to 20 goals are stored, including archived goals; remove an archived goal to free a slot. Titles are limited to 120 characters. Count targets and manual progress are bounded at 1,000,000; rating targets at 10,000. Manual undo retains the latest 30 changes.

Wins and games goals count **recorded result history**, not the aggregate score. Editing or deleting a recorded result and using score Undo recomputes goal progress. **Correct totals** changes the displayed score without supplying individual game history, so it does not create goal progress. The Goals dashboard flags active aggregate corrections to explain any difference. Record actual games in Result history to count them toward a goal.

When adding a count goal during a session, choose **From session start** to include existing history, or **From now** to exclude the result IDs already present. This baseline remains stable through result edits, deletion, and undo. Changing a baseline starts that counting window again. Session goals end on session reset and retain their previous outcome; choose **Repeat** explicitly to activate one for the current session. Manual counters have explicit +/- and their own Undo and can be session-scoped or ongoing. Ongoing goals survive session reset. Save a completed recap before resetting when you want a permanent historical record.

Rating milestones use the existing time-control targets from **Stats & visibility**. Updating either surface updates the shared target. A milestone captures its player, time control, creation time, and valid current starting rating. It shows current rating, target, remaining distance, and regression below the start. Missing data is **unavailable**, never a fabricated zero. Cached ratings are marked **stale** after 15 minutes or a failed stats fetch; profile-only success does not make ratings current. Explicit rating overrides count as current. Changing players makes a milestone for the previous player unavailable.

Choose one **Featured** goal, then enable its widget independently in landscape and/or portrait. The widget starts hidden on upgrade, and existing widget positions are preserved. Hiding or changing the featured goal does not stop tracking. Layout studio controls its position and dimensions; layout presets store presentation, not live goal progress. The combined dock includes compact goal controls.

Recap statistics capture goal outcomes with the other session statistics. Explicit refresh updates a draft; completing freezes the captured results, including when completion resets the session atomically. Later edits to goals cannot rewrite saved recaps. Legacy recaps without goals show unavailable. Backups include goals and manual undo history; legacy backups remain supported. Concurrent goal edits reject stale revisions instead of replacing newer changes; reload saved values before retrying. The API deduplicates the latest 100 goal operation IDs. Goal writes use the same authenticated controls and origin protections as other actions; overlay tokens remain read-only.

Legacy backup restore without goal data clears the current goal list, as explained by the restore confirmation. Archived goals for the current session are included when capturing a recap; deleting a goal before capture removes it from that future capture. Saved snapshots remain immutable.

## Session Clock and goal presentation

In **Layout studio**, enable **Session Clock** and select it to adjust its position,
size, font family/size, text/background colors, background opacity and optional
status label. Landscape and portrait have independent placement, visibility and
styles. New and upgraded installations keep the clock hidden. The widget uses the
existing session timer: Session, the combined dock and `/dock/score` control the
same start/pause/resume/reset/restart state. Hiding it does not stop the clock;
resetting the timer does not reset scores or completed recaps.

In **Goals → Goal presentation**, configure each orientation independently:

- **single** shows the first available selected goal; **rotating** cycles one at a time.
- **stacked** and **horizontal** show up to the configured 1–4 visible cards.
- Keep **Use featured goal (legacy)** enabled to preserve the previous featured-goal
  behavior, or disable it, select goals, and use **Earlier/Later** to order them.
  Empty selections are blank; archived/deleted IDs are skipped without selecting
  unrelated goals. Selections may contain up to 20 IDs.
- Rotation dwell is 3–300 seconds. Its slots are anchored to session start, so
  unrelated updates do not restart the dwell. Reconnected/hidden sources catch up
  to the current slot; changing the list or dwell recalculates that slot.
- Choose **none**, **bar** or **donut**. Bar fill changes smoothly; donut changes
  use a short opacity pulse. Disable **Animate value changes** for static charts.
  System reduced-motion preferences also disable animations. Initial loads and
  reconnects render the current value without replaying missed changes.

Rating progress measures movement from a valid starting rating toward the target.
Stale/missing ratings, unavailable baselines and targets at/below the baseline do
not produce a fabricated chart. Text still reports the recorded value and status.
Wins/games continue to count recorded results, not aggregate corrections. Completed
recaps remain frozen. Historical line charts are deferred; these features do not
acquire extra historical data.

Increase the widget height/width or lower its visible-card count if a dense stack
becomes too small to read. Content fits within the saved widget rather than spilling
onto other sources. Layout presets and backups include both orientations and all
presentation settings; legacy files retain their existing composition and gain
hidden/default additions. Focused guide, clock-style and goal-presentation saves
preserve unrelated fields and reject conflicting saved values.

For the reproducible synthetic browser fixture and the verification record, see
[PRESENTATION_QA.md](PRESENTATION_QA.md).

## Quick widget visibility

Expand **Visibility** in any dock tab to show or hide Stats, Scoreboard, CTA ticker,
Chess tips, Credits (main overlay), Socials, Goals, or Session Clock independently
for **Landscape** and **Portrait**. Each ON/OFF button saves immediately. The
section stays available across dock tabs; its collapse preference is local to this
browser and does not change broadcast settings. CTA, Tips, Goals, Socials and
Credits also have contextual orientation controls.

All controls and Layout studio follow the same saved values through live updates.
A pending control says Saving and ignores repeated activation while retaining
keyboard focus. Conflicting/stale requests fail safely: the latest server values
are reloaded and an error explains how to retry. If disconnected, the last confirmed
values remain visible. Requests and recovery reads time out after ten seconds each.
After reconnecting, retry the desired toggle. Reload older open control pages after
upgrading so their layout edits use the concurrency guard.

Visibility never resets session time, scores, goals, content, or playback. Hidden
widgets continue their existing timelines. Credits visibility only affects its
widget in `/overlay`; it does not control `/credits`. Showing the main-overlay
credits no longer starts or restarts them. Use **Play live** or **Restart live**
explicitly; a newly opened main overlay waits for a new playback command. The
standalone credits source retains its existing OBS source-activation behavior.
Board/camera reservations remain editor guides and are not visibility rows.

See [VISIBILITY_QA.md](VISIBILITY_QA.md) for verification and limitations.
