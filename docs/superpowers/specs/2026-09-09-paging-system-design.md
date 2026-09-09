# Hatom Paging System — Design

**Date:** 2026-09-09
**Status:** Approved

## Goal

Add a personal paging surface to `hatom.im`. An authorized caller chooses an
optional emoji (default `📟`) and optional short message, then sends a page.
PagerDuty delivers a Critical Alert to the recipient's iPhone. A separate,
always-running macOS app discovers the same PagerDuty incident, wakes the
displays, shows the emoji and message full-screen, and sounds an alarm until
the page is acknowledged on either device.

The system does not add a paging database, event history, ntfy, or another
delivery service. PagerDuty is the transport and the single source of truth
for active and acknowledged pages.

## Decisions

1. **PagerDuty is the only paging backend.** The website creates incidents
   through the PagerDuty REST API (`POST /incidents`). The Mac reads and
   acknowledges incidents through the same REST API. The iPhone uses
   PagerDuty's native Critical Alerts.
2. **The Mac app polls.** It requests triggered incidents for one dedicated
   PagerDuty service every five seconds. This avoids webhooks, a realtime
   relay, and application-side event storage.
3. **The Mac stays system-awake while armed.** Its displays may sleep. A
   process cannot poll while macOS is truly asleep, so the app holds a power
   assertion and wakes only the displays when a page arrives.
4. **Acknowledgement is global.** A Mac acknowledgement updates PagerDuty.
   An iPhone acknowledgement changes the PagerDuty incident state and is
   observed by the Mac on its next successful poll.
5. **Web access reuses existing authorization.** `/paging` gets a new
   `paging` permission in the existing `AuthorizedEmail.allowedPages` matrix.
   Owners continue to receive all permissions implicitly.
6. **The macOS receiver is a separate repository named `hatom-pager`.**
7. **No automated tests are added unless explicitly requested.**

## System boundaries

### `hatom.im`

The existing Next.js application owns caller authentication, the paging UI,
Shortcut authorization, input validation, and creation of PagerDuty incidents.
It never reads PagerDuty incidents and stores no paging events.

### PagerDuty

A dedicated service named **Hatom Paging** owns incident state and routes
high-urgency notifications to the recipient. PagerDuty is the only component
that persists a page after the create request finishes.

### `hatom-pager`

A native Swift macOS menu-bar app owns polling, display wake, full-screen
presentation, audio, and acknowledgement from the Mac. It stores credentials
and local preferences, but no page history.

## `hatom.im` design

### Permission

Add `paging` to `PermissionKey`, `PERMISSION_KEYS`, `PERMISSIONS`, and the
middleware gate for `/paging`. The owner admin grants it through the existing
allowlist matrix. Server-side API checks use the same permission rather than
trusting the client.

The existing Mongo-backed authorization system remains unchanged. “No
MongoDB” in this design means no new paging collection or paging-event
storage; existing login and permission data continue to use MongoDB.

### Paging page

`/paging` presents:

- An emoji picker accepting at most one grapheme cluster. Blank input resolves
  to `📟`.
- An optional plain-text message of at most 280 characters.
- A single prominent Page button.
- Immediate accepted/failed feedback from PagerDuty.
- A control for installing or updating the caller's iPhone Shortcut.

The initial version has no page list, history, active-state indicator, cancel
flow, scheduling, or recipient selector.

### Create incident API

`POST /api/paging/pages` accepts either the existing Auth.js session or a
signed Shortcut bearer token. Its body is:

```json
{
  "emoji": "📟",
  "message": "Optional message"
}
```

The route:

1. Authenticates the caller and checks the current `paging` permission.
2. Validates and normalizes the emoji and message.
3. Generates a UUID used as the PagerDuty `incident_key`.
4. Calls `POST /incidents` on the Hatom Paging service with `urgency: "high"`.
5. Returns `{ incidentId, pageId, status: "accepted" }` with HTTP `201` only
   after PagerDuty accepts the incident.

The PagerDuty incident `title` is human-readable for the iPhone notification.
`incident.body.details` is a JSON string containing exactly `schema_version`,
`emoji`, `message`, `caller_email`, `source` (`web` or `shortcut`), and
`page_id` for the Mac app.

### iPhone Shortcut

An authenticated user with `paging` permission can request a signed,
long-lived Shortcut token. The token contains the caller email and a token
version and is signed with `PAGING_SHORTCUT_SECRET`; no token row is stored.

Every Shortcut request rechecks the caller's current site permission. Removing
`paging` from the allowlist therefore revokes the Shortcut without maintaining
a separate token database. Rotating `PAGING_SHORTCUT_SECRET` revokes all
issued Shortcut tokens.

The default one-tap Shortcut sends `{ "emoji": "📟", "message": "" }`.
Callers use the web page when they want to choose another emoji or include a
message.

## PagerDuty configuration

Create a dedicated **Hatom Paging** service with:

- A high-urgency notification policy routed to the recipient.
- The PagerDuty iOS app configured to allow Critical Alerts.
- Acknowledgement timeout disabled, preventing acknowledged pages from
  retriggering.
- No automatic merge with unrelated PagerDuty services.

`hatom.im` stores a server-only PagerDuty REST API key (`PAGERDUTY_API_KEY`) in
Vercel environment variables. It optionally sets `PAGERDUTY_SERVICE_ID` to skip
service discovery and `PAGERDUTY_FROM_EMAIL` for the required REST `From`
header. The key is never sent to a browser.

The Mac uses the same PagerDuty REST API key (or a user-specific token with
equivalent read/acknowledge scope) stored only in macOS Keychain. A
distributable version would use scoped OAuth instead; personal token setup is
the intentionally smaller first version.

## `hatom-pager` design

### Application lifecycle

The receiver is a native Swift application using SwiftUI for settings and
AppKit where window-level control is required. It:

- Runs as a menu-bar application.
- Registers to start at login.
- Has an explicit Armed/Disarmed control.
- Holds a prevent-idle-system-sleep power assertion while armed.
- Allows displays to sleep normally.
- Releases the assertion when disarmed or quitting.

The menu-bar icon communicates armed, disconnected/backing-off, and active-page
states.

### Polling

While armed, the app requests triggered incidents from PagerDuty every five
seconds, filtered to the Hatom Paging service. It treats PagerDuty as a
snapshot source:

- A triggered incident not present in the previous successful snapshot is a
  new page.
- For each new incident, the app fetches its associated alert details once to
  read `body.details` — a JSON string of the structured page payload (with a
  direct-object decode fallback for compatibility); the incident-list response
  is used only to discover IDs and statuses.
- An active incident that becomes acknowledged or resolved disappears from
  the triggered snapshot and is dismissed locally.
- A failed request never acts like an empty snapshot.
- Starting or rearming the app presents every currently triggered incident,
  including one created while the app was offline.

The app respects `Retry-After` after HTTP `429`, applies exponential backoff
with jitter for network/server failures, and returns to the five-second
interval after a successful request.

### Page presentation

For each newly triggered incident, the app:

1. Declares user activity to wake sleeping displays.
2. Starts a looping bundled alarm sound.
3. Opens a borderless full-screen overlay on every connected display.
4. Renders the emoji prominently, with the optional message and caller beneath.
5. Provides an Acknowledge control and a keyboard-accessible equivalent.

macOS does not allow an application to bypass the secure lock screen. While
locked, the app wakes the displays and plays audio; the full overlay becomes
visible only after unlock.

If multiple incidents are active, the newest appears first with an active-page
count. Acknowledging the current incident advances to the next. Audio continues
while any triggered incident remains.

### Acknowledgement

The Mac acknowledges the current incident through PagerDuty's REST API. The UI
silences that page immediately and shows an acknowledging state while the
request is in flight. On a transient failure, the app retains the operation in
memory and retries with backoff. If the app exits before a retry succeeds,
PagerDuty still considers the incident triggered and it reappears when the app
starts.

Acknowledging in the PagerDuty iPhone app changes the same incident to
acknowledged. The Mac removes it after the next successful poll, normally
within five seconds.

## Security

- Website requests require the existing authenticated session and `paging`
  permission.
- Shortcut requests require a signed bearer token and a fresh permission
  check.
- The PagerDuty REST API key (`PAGERDUTY_API_KEY`) and Shortcut signing secret
  exist only in Vercel environment variables.
- The Mac's PagerDuty REST token exists only in Keychain and is never written
  to logs or preferences.
- Browser and server logs exclude secrets and authorization headers.
- Emoji and message values are length-limited plain text; they are never
  interpreted as HTML.
- The dedicated PagerDuty service prevents unrelated incidents from activating
  the Mac overlay.

## Failure behavior

- If PagerDuty rejects the website incident creation, the caller sees a failure
  and no local success is claimed.
- If the iPhone receives a page while the Mac is offline, PagerDuty retains the
  triggered incident. The Mac presents it after connectivity returns.
- If a poll fails, the current alarm remains unchanged and the app indicates
  degraded connectivity.
- If a Mac acknowledgement fails, the local page remains in a syncing state
  and is retried in memory.
- If the Mac app is disarmed, PagerDuty still alerts the iPhone and retains the
  incident; rearming the app presents any incident that remains triggered.

## Non-goals

- No ntfy, Mongo paging collection, websocket service, webhook receiver, or
  custom realtime relay.
- No custom iPhone application; PagerDuty supplies Critical Alerts.
- No Wake-on-LAN, router integration, or waking a truly sleeping Mac.
- No paging history or analytics in `hatom.im`.
- No multiple recipients or on-call schedule editor in `hatom.im`.
- No App Store distribution in the first version.

## Manual verification

No automated tests or test files are included unless the user requests them.
Before release, manually verify:

- Default and custom pages from `/paging`.
- The one-tap Shortcut and permission revocation.
- iPhone Critical Alert delivery while Focus and silent mode are enabled.
- Display wake, full-screen overlays, audio, and multiple active pages.
- Mac acknowledgement stopping PagerDuty escalation.
- iPhone acknowledgement dismissing the Mac within one poll interval.
- Startup recovery of a still-triggered incident.
- Offline and `429` backoff without false dismissal.
- Armed/disarmed power assertions and secure-lock-screen behavior.
