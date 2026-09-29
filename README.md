<p align="center">
  <img src="assets/banner.jpg" alt="LAD JOKES — adults-only humour commons. Vote. Rage. Repeat." width="100%">
</p>

<h1 align="center">LAD JOKES</h1>

<p align="center">
  <a href="https://lin4cre.github.io/lad-jokes/"><img src="https://img.shields.io/badge/live%20prototype-GitHub%20Pages-FF2D55?style=flat-square" alt="Live prototype on GitHub Pages"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-FFB020?style=flat-square" alt="MIT licence"></a>
  <img src="https://img.shields.io/badge/18%2B-only-c9243a?style=flat-square" alt="Adults only">
  <img src="https://img.shields.io/badge/dependencies-0-2fe08a?style=flat-square" alt="Zero runtime dependencies">
  <img src="https://img.shields.io/badge/tests-304%20passing-2fe08a?style=flat-square" alt="304 tests passing">
</p>

An adults-only humour commons: raunchy confessional stories, interactive user-generated
polls, a forum with **anonymous outrage ratings**, encrypted chat rooms, and a staff back
room with real-time collaboration, drag-and-drop dashboards and automated KPI reports.

Built as a **self-contained front-end prototype** — no build step, no server, no runtime
dependencies — so every feature in the brief is actually clickable and actually tested. The
production mapping (Postgres schema, Redis fan-out, Kubernetes, E2EE key agreement) lives in
[Production architecture](#production-architecture-what-this-prototype-maps-onto) at the
bottom, and the honest split between what is real and what is simulated is
[here](#security-model-what-is-real-and-what-is-simulated).

```
4,544 lines of JavaScript across 28 files · 552 lines of CSS · 101 lines of shell markup
18 app modules (9 `lib/*` services + 9 `views/*` routes) · 21 <script> tags · zero dependencies
304 end-to-end assertions · 205 static checks · all green from a clean clone
```

---

## Quick start

The app needs a static server (not for build reasons — for secure-context reasons). One line:

```bash
git clone https://github.com/LIN4CRE/lad-jokes && cd lad-jokes
npm run serve            # → http://localhost:8123/
```

`npm run serve` is just `python3 -m http.server 8123`. Any static host works: `npx serve`,
Caddy, nginx, GitHub Pages. The service worker and WebCrypto key derivation need a **secure
context** (`https://` or `localhost`); open it over a bare LAN IP and the app still runs, it
just falls back to the demo cipher and skips push registration.

Four things to try in the first minute:

1. **Age gate** — enter a DOB under 18 and you are refused; the gate stores a boolean, never
   the date (`LJ.util.store.del('lj:age:v1')` in the console puts you back through it).
2. **The 18+ filter as a guest** — the forum arrives with flagged stories hidden; the button
   labelled "NSFW hidden" turns them on. Guests always start hidden, a signed-in member keeps
   their last choice (persisted), and `?nsfw=0|1` on the link beats both.
3. **Log in as a moderator** — the login screen has a one-click demo account per role (`taz`
   is staff, `kevsaggy` is a member). The shared demo passphrase is `scouse-18+-demo`.
4. **Open two tabs** — vote on a story in one, watch the counter and the staff activity feed
   move in the other. That is the real-time sync demo, and it keeps working offline.

## Testing and checks

```bash
npm ci
npm run test:ci     # serves the app, then runs the jsdom harness → 304 passed · 0 failed
npm run check       # 205 static checks: script tags, precache list, JSON, CSS tokens, syntax
```

**`tests/harness.mjs`** boots the whole app in jsdom over http and walks it in order — age
gate, guest gating, login, forum filters, sorting, search, polls, ratings, replies, the
composer's moderation gates, encrypted chat, sharing, the admin dashboard (content,
moderation, kanban drag-and-drop, files, reports, custom widgets), notifications, sync,
settings, theme, logout, unknown routes — asserting against real DOM and real store state,
with separate expectations for the guest and signed-in passes. It exits non-zero on any
failure and on any uncaught console error. Base URL override:
`LJ_URL=http://127.0.0.1:PORT/ node tests/harness.mjs`.

**`tools/check.mjs`** is the boring safety net a no-build app needs: every `<script>` and
asset reference resolves, every JS file in the tree is loaded by the page in the right order,
the service worker's precache list matches the shell, JSON parses, CSS braces balance, every
`var(--token)` is declared, every class the JS emits has a rule, the manifest's icons and
shortcuts exist, no script points at a deleted file, and nothing that looks like a credential
is committed. Both run in [CI](.github/workflows/ci.yml) on every push and pull request.

### Optional: snapshots and a shippable bundle

```bash
npm run preview    # tools/make-preview.mjs → preview.html (git-ignored)
npm run package    # tools/make-package.mjs → dist/ + lad-jokes-v1.0.0.tar.gz
```

`preview.html` boots the app, snapshots eleven routes as the DOM the app actually produced and
inlines the stylesheet into one self-contained file — a frozen layout check with a dark/light
pair, not a pixel screenshot; its buttons are inert. `npm run package` derives the runtime file
set from `index.html` and `sw.js` (never a hand-written list) and leaves ~545 KB in `dist/`.

## Repository layout

```
index.html          shell: age gate, app frame, 21 script tags in load order, pre-paint theme
app.js              boot: route registration, shell painting, global actions, keyboard
app.webmanifest     PWA manifest · sw.js  offline shell + push handlers · icon.svg, icons/
styles/app.css      all styling: tokens, five accent presets, components, four breakpoints
lib/
  utils.js          DOM/format/icon helpers, toasts, modals, activity log
  theme.js          dark/light + accent presets, persisted, theme:change
  crypto.js         PBKDF2 → AES-GCM, envelopes, in-memory session cache
  store.js          the ONLY module touching localStorage; outbox, presence, export/wipe
  sync.js           BroadcastChannel fan-out, offline queue, peer simulation
  accounts.js       auth, keys, karma, biometric gate, require() guard
  notify.js         permission, inbox, badge, engagement ticker
  share.js          native share, 7 targets, permalink, canvas share card
  router.js         hash router, guards (18+/auth/admin), delegated data-action dispatcher
data/seed.js        deterministic fictional seed: 7 members, 11 stories, 5 polls, 3 rooms…
views/              splash · feed · story · polls · create · chat · admin · account · settings
tests/harness.mjs   304-assertion end-to-end walk (jsdom)
tools/              check.mjs (static) · make-preview.mjs · make-package.mjs
.github/            CI + Pages workflows, issue forms, PR template, CODEOWNERS, dependabot
assets/             banner.png/.jpg, social-preview.png (the GitHub social card)
```

---

## CI, deployment and releases

| Automation | What it does |
|---|---|
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | On every push and PR: `npm ci`, `node tools/check.mjs`, then serve the app and run the 304-assertion harness. A second job runs `npm audit --audit-level=high`. |
| [`.github/workflows/pages.yml`](.github/workflows/pages.yml) | Builds no artefact (there is no build) and uploads the file set the app actually loads as a Pages deployment. |
| [`.github/dependabot.yml`](.github/dependabot.yml) | Monthly bumps for the single dev dependency and for the Actions themselves. |
| `npm run package` | `dist/` plus a versioned `.tar.gz` for an internal drop or a release asset. |

**Live now:** https://lin4cre.github.io/lad-jokes/ — published from the `main` branch root,
so it updates on every push without waiting for a CI job. The only cosmetic side effect of
branch publishing is that Jekyll also renders `README.md`; `tools/check.mjs` and the app are
untouched by it, and switching to the workflow above (`.github/workflows/pages.yml`) takes the
`/jekyll` build out of the path — add a `.nojekyll` file at the root and flip *Settings → Pages*
from "Deploy from a branch" to "GitHub Actions".

**If the CI badge is red:** that is the account's Actions allocation, not this repo. A canary
workflow containing nothing but `echo "runner reached"` was queued to `ubuntu-latest` and
failed in four seconds with no runner ever assigned, which is what GitHub does when a personal
account has no usable Actions minutes (usually a $0 spend limit under
[Settings → Billing](https://github.com/settings/billing)). The two jobs are byte-identical to
`npm run check` and `npm run test:ci`, both of which pass from a clean clone:

```
$ git clone https://github.com/LIN4CRE/lad-jokes && cd lad-jokes && npm ci
$ node tools/check.mjs         →  205 checks passed · 0 failed
$ npm run test:ci              →  304 passed · 0 failed · 0 console errors
```

Top up or enable the spend limit and re-run the workflow (Actions → Re-run all jobs); nothing
in the repo needs to change. `assets/social-preview.png` (1280×720) is ready to become the
repo's social card at *Settings → General → Social preview* — that one screen is browser-only,
there is no API for it. `assets/banner.png` is the same artwork at 1200×675 for the README,
with `banner.jpg` as the lighter embed.

---

## Content policy

This is a "lad mag" tone brief, so the seed content is cheeky, crude and full of innuendo —
and stops there. The rules the seed data and the composer gates both follow:

* **Adults only, and enforced**: the 18+ age gate has to pass before anything paints (a
  refusal stores a boolean, never the date), 4 of the 11 seeded stories carry an `18+ NSFW`
  badge, and the forum has a one-tap "NSFW hidden" filter that is checked against the seed in
  the harness (per-room and forum-wide).
* **No graphic sexual content.** Implication and aftermath, never description.
* **No minors, no non-consent, no targeted harassment** of real, named people.
* **No slurs.** The composer refuses them outright (hard refusal, not a warning), and the
  "no contact details" gate holds submissions for a human rather than deleting them.
* **Anonymity is for the teller, not for the target.** Handles are pseudonymous, ratings and
  votes are anonymous-by-design, but every write is still attributable server-side for
  moderation, and abuse gets escalated by IP/device rather than answered with a reply.

The two client-side regexes in `views/create.js` (`BANNED`, `CONTACT`) exist to demonstrate
the *product* behaviour; in production the same two decisions belong to a server-side
classifier plus a human queue, with the client gate as a courtesy, not a control.

---

## Features → where they live

| Requirement | Implementation | File |
|---|---|---|
| Raunchy anecdote feed | 11 seeded stories, hero pick, cards with vote/outrage/reply/share/report rails | `views/feed.js` |
| Interactive user-generated polls | 5 seeded polls, ballot + results + turnout rails, create-your-own, revoke, "discuss this poll" | `views/polls.js` |
| Community forum | Threads with replies, anonymous-reply mode, per-category rooms, live reply counts | `views/feed.js`, `views/story.js` |
| Bold, dark, provocative UI | Archivo Black display type, 5 accent presets, oversized numerals, brutalist cards | `styles/app.css`, `index.html` |
| Anonymous outrage rating | 0–10 dial on every story, keyed to a **device token** not a handle, retractable, feeds a histogram + mean | `views/feed.js` (`rateBlock`) |
| Social sharing | Share sheet: native Web Share API when present, 7 network targets, permalink, generated 1080×607 PNG card, share counters | `lib/share.js` |
| Push notifications | Notification permission request, subscription registration, engagement ticker, inbox with badge, DM pings, test-push button | `lib/notify.js`, `sw.js` |
| Search + sort by engagement | Search across title/body/tags/author; Hot / Top / New / Outrageous / Most argued | `views/feed.js` (`SORTS`, `list`) |
| Secure login + account management | PBKDF2 verifier auth, demo accounts, signup, profile editing, karma tiers, device revocation, logout everywhere | `lib/accounts.js`, `views/account.js` |
| Real-time multi-device sync | Outbox → `BroadcastChannel` apply, 90 ms debounced flush, offline queue + rehydration, peer presence heartbeats, activity feed | `lib/store.js`, `lib/sync.js` |
| Dark-mode toggle | `html[data-theme]` + inline pre-paint script (no flash), persisted, `theme:change` event, `theme-color` meta | `lib/theme.js`, `index.html` |
| Encrypted chat | AES-GCM-128 per-thread keys derived from the passphrase, ciphertext-only at rest, reveal/re-lock, ciphertext peek, read receipts | `lib/crypto.js`, `views/chat.js` |
| Modular architecture | 9 `lib/*` services + 9 `views/*` route modules + `data/seed.js`, all on one `window.LJ` namespace, no bundler | `index.html` script order |
| Encrypted data storage | Envelope encryption helpers, per-collection store, session key held in memory only | `lib/crypto.js`, `lib/store.js` |
| Admin dashboard: analytics | KPI tiles, 14-day DAU + 7-day engagement series, sparklines, bar and donut charts, CSV export | `views/admin.js` |
| Admin dashboard: content management | Pin / edit / remove / restore, author notification, flags, user muting | `views/admin.js` |
| Real-time team collaboration | Shared activity feed, moderation kanban, peer-synced writes, "simulate a peer" button | `views/admin.js` (`collab`), `lib/activity.js` |
| Drag-and-drop dashboard | Kanban columns (native HTML5 DnD) **and** drag-to-reorder dashboard widgets | `views/admin.js` (`wireDnD`) |
| Custom widgets | 8 widgets, show/hide + order persisted, dashboard respects both | `views/admin.js` (`widgets`) |
| Automated KPI reports | Run / schedule-toggle / download report, delivered to the notification inbox | `views/admin.js` (`reports`) |
| Fully responsive + offline | 4 breakpoints, bottom tab bar on small screens, service worker cache + offline fallback, queued writes | `styles/app.css`, `sw.js` |
| Biometric login for sensitive data | WebAuthn-shaped enrol/unlock with graceful simulated fallback, gates chat unlock + account actions | `lib/accounts.js` (`biometric`) |

---

## Routes

| Route | Access | What it is |
|---|---|---|
| `#/splash` | pre-gate | Age gate; nothing else paints until it passes |
| `#/feed` | public | The forum. `?cat=pub&sort=top&q=sauna&nsfw=0&polls=1&mine=1&held=1` are all deep-linkable |
| `#/story/:id` | public | One thread: full text, attached poll, rating histogram, replies, share rail |
| `#/polls` | public | Ballots, results, turnout, create-your-own |
| `#/create` | member | Composer: live preview, quality meter, drafts, moderation gates, attach-a-poll |
| `#/chat`, `#/chat/:id` | member | Encrypted rooms |
| `#/login` | public | Sign in / sign up / biometric / demo roles |
| `#/account` | member | Profile, karma tiers, my threads, security summary, devices |
| `#/settings` | member | Appearance, alerts, sync, security, data (export / import / wipe) |
| `#/admin/:tab` | staff | `overview` `content` `moderation` `collab` `files` `reports` `widgets` |

Guards are in one place (`lib/router.js`): age gate → auth → admin → 404-to-feed. A guest who
taps a member-only control gets the auth modal with a "continue as demo member" path rather
than a dead end; deep links to `/admin` bounce to `/feed`.

---

## Data model

One collection per `localStorage` key (`lj:<name>:v1`), plus `lj:settings:v1`,
`lj:widgetOrder:v1`, `lj:auth:v1`, `lj:age:v1`, `lj:device:v1`. Everything goes through
`LJ.store` (`ready/get/set/all/get1/put/patch/remove/where`), which is also the sync boundary:
every mutation is journalled to an outbox and broadcast.

| Collection | Shape (abridged) | Notes |
|---|---|---|
| `users` | `id, handle, name, bio, role, karma, createdAt, flags` | 7 seeded, one moderator |
| `posts` | `id, type(story\|poll), title, body, category, tags[], authorId, votes, views, comments, shares, outrage, ratings{deviceId:0-10}, flags[], pollId, status, nsfw, featured, createdAt` | `status: draft → queued → open → removed`; `queued` never reaches the public forum, `removed` keeps its thread page for the record |
| `polls` | `id, question, context, options[{id,label,votes}], closesAt, authorId, postId` | ballots keyed by device token, one per device, revocable |
| `pollVotes` | `id, pollId, optionId, deviceId, at` | the anti-double-vote ledger |
| `comments` | `id, postId, author, authorId, anon, text, votes, at` | `anon` stores `anon_<hash>` and drops `authorId` |
| `threads` / `messages` | `id, kind, title, members[], unread{userId}` / `id, threadId, sender, env{c,iv,alg}, at, read` | **messages hold ciphertext envelopes only** |
| `files` | `id, name, bytes, mime, folder, by, at` | drag-and-drop uploads, object-URL previews |
| `board` | `id, list, title, by, note, at` | moderation kanban, drag between lists |
| `reports` | `id, name, cadence, lastRun, enabled, metrics` | the "automated KPI report" definitions |
| `notifs` | `id, kind, title, body, at, read, postId` | inbox + badge + push payload |
| `activity` | `id, actor, verb, target, at` | shared staff feed, fed by every mutation |
| `outbox` | `op, coll, id, patch, at, sent` | queued writes; flushed on reconnect |
| `shares` | `id, postId, net, at` | share attribution for the analytics widgets |

Seed data is deterministic (`U.prng` with a fixed seed) so screenshots, tests and the
"sort by hot" ordering are reproducible; `data/seed.js` runs once and only when a
collection is empty.

---

## Security model — what is real and what is simulated

**Real, and verifiable in the code:**

* **No plaintext passwords.** `lib/crypto.js` derives a PBKDF2-SHA256 key (150,000 iterations,
  random salt) and stores only `{salt, verifier, iter}`. A wrong passphrase fails the verifier
  check and yields no key. The harness asserts that no `pass` field ever reaches storage.
* **AES-GCM-128 for chat**, with a per-thread key derived from the user's passphrase, random
  96-bit IV per message, and an envelope `{c, iv, alg}` as the only thing written to storage.
  Locking a room drops the key from memory and evicts cached plaintext; the harness asserts
  that no plaintext message body is findable in `localStorage`.
* **Session key in memory only** — never mirrored to `localStorage`, so a stolen disk cache
  gets ciphertext and a salt.
* **Anonymous ≠ unattributable.** Ratings and poll ballots are keyed to a device token
  (`lj:device:v1`) so one device = one ballot and the handle stays off the record, while the
  write still carries a server-side author for moderation. Ratings are retractable —
  `unrate` deletes the ballot and recomputes the mean.
* **Least privilege by route guard**: `auth` and `admin` flags in the router, plus
  `LJ.accounts.require(what)` on every write action, so a guest clicking "vote" gets the
  auth modal instead of a half-applied mutation.
* **Purge is real**: settings → data exports the whole store as JSON, imports replace it,
  and wipe drops every `lj:*` key and reloads.

**Simulated, and labelled as such in the UI:**

* **Multi-device sync** is `BroadcastChannel` between tabs, with an outbox that survives
  reloads — not a server. Cross-device conflicts resolve last-write-wins on `updatedAt`.
* **Push notifications** register a real service worker and a real subscription object, but
  there is no push server; the engagement ticker fakes the interesting part (a story
  trending, a DM landing) and respects `LJ.activity.last` so it never nags while you type.
* **The "cipher" for the sync payload** is `xor-demo` — obviously not encryption, only there
  to show a payload envelope on the wire. The harness asserts chat skips key re-derivation for
  it rather than pretending to decrypt.
* **Biometric unlock** uses WebAuthn if `credentials.create/get` exist; in a browser without
  them (or a headless harness) it falls back to a modal that behaves identically, so the
  gating logic is exercised even when the platform API isn't.
* **Everything is local.** `localStorage` is readable by anything running on the origin, so
  posts, votes and profiles are *not* confidential here. Only chat plaintext is protected, and
  only against someone who doesn't have your passphrase.

---

## Real-time, offline, and sharing

* **Sync** (`lib/store.js`, `lib/sync.js`): every `put/patch/remove` appends an op to the
  outbox and emits `lj:store:change`; a 90 ms debounce batches a flush onto
  `lj:remote:sync`. Peers apply ops, bump `heartbeat`, and show up in the presence rail.
  Offline, ops queue; on `online` they flush and the current view repaints via `view:refresh`.
  `status()` powers the top-bar dot.
* **Offline** (`sw.js`): cache-first for the shell (every entry index.html and the manifest reference — 21 scripts, CSS, manifest, icon and root — versioned
  `lad-jokes-v1`), network-first pass-through for anything else, an offline fallback page,
  `SKIP_WAITING` on demand from settings, and `push`/`notificationclick` handlers that route a
  tap straight to the story. Missing service worker (`file://`, iframe preview) is a silent
  degrade, not an error.
* **Share** (`lib/share.js`): `navigator.share` / `canShare` with a `shareFiles` fallback
  chain, a generated 1080×607 PNG card (title, handle, outrage score, QR-ish identicon)
  downloadable and copyable as a permalink, seven network targets, and a per-post share
  counter that feeds the analytics widgets.

---

## Admin dashboard

`#/admin/overview` leads with KPI tiles (members, stories, avg outrage, replies/hour,
queue depth, retention), a 14-day DAU series, 7-day vote/comment/retention series,
sparklines and a donut, and a CSV export of the
current window.

* **Content** — searchable table with status filters; pin, edit, remove (with confirm),
  restore; removal notifies the author and vanishes the card from the forum on the next
  repaint in every tab.
* **Moderation** — flag queue with approve / action / dismiss, held-for-review submissions,
  user muting. A post held by the contact-details gate shows up here and nowhere else.
* **Collaboration** — the shared activity feed, presence dots, and a kanban board you can
  drag cards across (`new → triage → actioned → closed`); order and state persist to the
  store, so a second tab sees the move.
* **Files** — drop-zone uploads, folder moves by drag, delete, size/mime read-outs.
* **Reports** — KPI report definitions with run-now, schedule toggle, and a delivered copy in
  the notification inbox.
* **Widgets** — show/hide and drag-to-reorder the dashboard; both the list state and the
  order persist, and the dashboard respects them.

---

## Production architecture (what this prototype maps onto)

The prototype's module boundaries are the production service boundaries.

```
clients (PWA / iOS / Android)
   │  HTTPS + WSS
   ▼
edge: CDN + TLS + rate limiting + WAF ── object storage (S3-compatible) for uploads & share cards
   ▼
API: stateless Fastify (or Go) pods behind an LB
   ├── auth     argon2id password hashes · refresh-token rotation · WebAuthn/Passkeys
   ├── feed     Postgres 16 (PgBouncer) + read replicas; hot ranks in Redis ZSETs
   ├── polls    Postgres, ballots unique (device_id, poll_id); results cached in Redis
   ├── ratings  append-only ballots table + materialised mean per post (no UPDATE race)
   ├── chat     E2EE: server stores envelopes only; key packages per device
   └── mod      classifier (hard-refuse / hold / publish) + human queue + immutable audit log
   ▼
real-time: Redis Streams (or Kafka) → fan-out workers → WS/SSE to devices, push via
           Web Push/VAPID, APNs, FCM; outbox pattern on every write so nothing is lost
           when a client or a consumer is offline
   ▼
analytics: CDC (Debezium) → warehouse; KPI reports rendered by a scheduler, delivered to
           inbox/email; dashboards read a serving layer, never the OLTP primary
```

* **Data model**: `posts(id, author_id, type, category, status, nsfw, created_at, edited_at)`,
  `post_stats(post_id, votes, views, replies, shares, rating_n, rating_mean, outrage)` kept
  current by the outbox worker rather than by write-through UPDATEs,
  `poll_ballots(poll_id, option_id, device_id, voted_at)` with a uniqueness constraint,
  `ratings(post_id, device_id, score)` likewise, `chat_threads / chat_envelopes(thread_id,
  sender_id, payload, iv, created_at)`, `moderation_events(...)` append-only with an
  `actor_id`, and `devices(user_id, push_token, public_key, last_seen)`.
* **Sync**: exactly the outbox the prototype already runs, pointed at a queue instead of
  `BroadcastChannel`; server-side, idempotent `op_id` dedupe and per-collection
  `updated_at` vector clocks give you multi-device convergence without OT for this data
  shape (text posts edit rarely; votes and ballots are commutative).
* **E2EE chat**: X3DH-ish key agreement per thread with per-device key packages, sender keys
  ratcheted per message; the server only ever sees `{c, iv, alg}`, and the "revoke device"
  action rotates the sender key and re-wraps for the remaining devices.
* **Scaling**: horizontal pods with HPA on p95 latency + Kafka consumer lag; Postgres with
  PITR and a lagging replica for accidental-deletion recovery; Redis for ranks/presence/rate
  limits with AOF; blobs offloaded to object storage with signed URLs; feed queries indexed
  `(category, status, created_at desc)` and rank queries served from Redis.
* **Privacy/ops**: DOB is checked and discarded (age band, not date), IP/device retained on a
  fixed clock for abuse escalation only, deletion is a hard purge with a tombstone row,
  moderation decisions are auditable and reversible, and the "held for review" state exists
  precisely so a borderline post is never silently deleted.

---

## Code patterns worth stealing

* **Namespace modules, no bundler**: `window.LJ.<thing>`, each file an IIFE, load order in
  `index.html`. Views register themselves with the router; `app.js` boots last.
* **A single store boundary**: every read and write goes through `LJ.store`, which makes
  journalling, broadcasting, export and wipe one-place concerns instead of per-feature ones.
* **State-first filtering**: `LJ.postTools.state` is the source of truth; the URL mirrors it
  via `history.replaceState` and deep links hydrate it. (Round-tripping filters through a
  query string is how you end up losing a filter — the harness has a check for exactly that.)
* **Action delegation**: `data-action="name"` + `LJ.router.actions` + one document-level
  listener, so a re-rendered view doesn't need re-wiring. Destructive paths get a
  same-task re-entrancy guard so a click and a submit can't double-write.
* **Idempotent seeding** with a fixed PRNG, and a pre-paint inline theme script to kill the
  light-mode flash.

## Known limitations

* No server: "multi-device" means multi-tab; nothing leaves the browser.
* `localStorage` isn't confidential — only chat is encrypted, and only against someone
  without your passphrase.
* The push ticker and report delivery are simulated locally; a real VAPID/APNs/FCM sender
  isn't in the sandbox.
* `crypto.subtle` needs a secure context; over a bare LAN IP or `file://` the app degrades to
  the demo cipher rather than failing.
* The share card and biometric flows are browser-API dependent; both have visible fallbacks.
* Charts are hand-drawn SVG (no charting library), so they're simple by design.
* The shell cache is cache-first with background revalidation, so after you edit a file the
  first reload can still serve the old copy; the second one is fresh (or hit
  Settings → Sync → "Update cache" and reload).
