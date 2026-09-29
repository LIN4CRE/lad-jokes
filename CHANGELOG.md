# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-09-29

First complete build of the prototype: every feature in the brief is implemented,
clickable and covered by the harness.

### Added
- **Age gate** (`views/splash.js`) — 18+ consent before anything paints; stores a boolean,
  never the date of birth; a refusal is remembered and reversible from browser settings.
- **Forum** (`views/feed.js`, `views/story.js`) — seeded stories, hero pick, category rooms,
  search across title/body/tags/author, Hot / Top / New / Outrageous / Most argued sorting,
  all deep-linkable (`#/feed?cat=pub&sort=top&q=sauna&nsfw=1`).
- **Anonymous outrage ratings** (`views/feed.js`) — 0–10 dial per story keyed to a device
  token rather than a handle, retractable, feeding a histogram and a recomputed mean.
- **Polls** (`views/polls.js`) — live and closed ballots, one vote per device enforced by a
  `pollVotes` ledger, revoke, turnout rails, create-your-own, "discuss this poll".
- **Composer with moderation gates** (`views/create.js`) — live preview, quality meter,
  per-member drafts, slur refusal, contact-details hold-for-review, attach-a-poll.
- **Encrypted chat** (`views/chat.js`, `lib/crypto.js`) — AES-GCM-128 envelopes, ciphertext
  only at rest, reveal/re-lock, ciphertext peek, read receipts, per-thread keys.
- **Staff back room** (`views/admin.js`) — analytics with 14-day and 7-day series and CSV
  export, content management (pin/edit/remove/restore), moderation queue, shared activity
  feed, drag-and-drop kanban, file dropzone, automated KPI reports, custom dashboard widgets
  with drag-to-reorder and persisted visibility.
- **Accounts** (`lib/accounts.js`, `views/account.js`) — PBKDF2 verifier auth, signup,
  biometric unlock (real WebAuthn or a labelled fallback), karma tiers, device revocation,
  profile editing, shareable profile.
- **Real-time sync** (`lib/store.js`, `lib/sync.js`) — write outbox, `BroadcastChannel`
  fan-out, presence heartbeats, offline queue with rehydration on reconnect.
- **Offline + push** (`sw.js`, `lib/notify.js`) — cache-first shell, offline fallback,
  notification inbox with badge, engagement ticker, DM pings, push-test button.
- **Sharing** (`lib/share.js`) — native Web Share when available, seven network targets,
  permalink, generated 1080×607 PNG card, per-post share counters.
- **Theme** (`lib/theme.js`) — dark by default, light toggle with an inline pre-paint script,
  five accent presets, `theme-color` sync.
- **Repo tooling** — `tests/harness.mjs` (304 assertions in jsdom), `tools/check.mjs`
  (static wiring), `tools/make-preview.mjs` (rendered-DOM snapshots), `tools/make-package.mjs`,
  CI and Pages workflows, issue and PR templates, banner and PWA icons.

### Fixed (found by the harness while it was being written)
- A submit button inside a `[data-action]` form could either double-fire a write or swallow
  it entirely, depending on `submitter` support; re-entrancy is now guarded at the action.
- The story view did not repaint when a reply was posted into it from its own form.
- Posts held for review were appearing in the public forum for everyone, including staff.
- The age gate shipped with eight class names and no matching CSS.

### Known limitations
- No server: "multi-device" is multi-tab; nothing leaves the browser. See `SECURITY.md`.
- Push delivery, the sync cipher and biometric unlock are simulated and labelled as such.
- `crypto.subtle` needs a secure context; the app degrades rather than failing.

[1.0.0]: https://github.com/LIN4CRE/lad-jokes/releases/tag/v1.0.0
