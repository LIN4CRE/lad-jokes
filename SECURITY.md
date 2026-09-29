# Security policy

**Lad Jokes is a client-side prototype.** There is no server, no account database and no
network traffic beyond a static file fetch, so "vulnerability" here means *the pattern is
wrong in a way that would carry into a real deployment*. That is still worth reporting, and
I will take it seriously.

## Where the trust boundary actually is

| Area | Model | Real risk today |
|---|---|---|
| Passwords | PBKDF2-SHA256, 150k iterations, random salt; only `{salt, verifier, iter}` is persisted | None in-app; production needs argon2id server-side, not this |
| Chat | AES-GCM-128 per-thread key derived from the passphrase, random 96-bit IV per message, session key never written to disk | Key lives in memory for the tab's lifetime; a memory read or a devtools session defeats it |
| Everything else | Plain `localStorage` on your own origin | **Not confidential by design.** Anyone with the browser profile can read posts and votes |
| Sync payload | `xor-demo` envelope between tabs | Explicitly fake. Do not copy it anywhere near a wire |
| Biometric unlock | WebAuthn when the platform offers it; otherwise a labelled simulation | The simulation is a UX stub, not an authenticator |
| Moderation gates | Two regexes in `views/create.js`, mirrored by a human queue in the admin view | Client-side only, and deliberately so: they demo the product behaviour, they are not a control |

Every string interpolated into markup goes through `LJ.util.escape`; `tools/check.mjs`
greps the views for unescaped insertion of stored fields, because a self-XSS in a story
body would be the one genuinely embarrassing bug in a forum prototype.

## Report a vulnerability

* Open a **private** report: GitHub → Security → *Report a vulnerability*
  (https://github.com/LIN4CRE/lad-jokes/security/advisories/new). If that is unavailable,
  open a normal issue with just the words "security report" and I will get in touch to move
  it somewhere private.
* Include: what you ran, what you expected, what happened, and the commit SHA.
* You will get an acknowledgement within 7 days and a fix or a reasoned refusal within 30.
* Please don't open a public issue with a working exploit, and don't post screenshots of
  someone else's `localStorage`.

## Out of scope

Anything that requires an attacker to already control your browser profile, your machine,
or the origin's storage; the demo passphrase (`scouse-18+-demo`) being, well, a demo
passphrase; and the fact that this prototype has no server to attack.

## If you are building the real thing from this

The production notes in the README are the checklist: argon2id plus refresh-token rotation,
WebAuthn/passkeys, server-side classification with a human queue and an immutable audit log,
E2EE sender keys with device revocation that re-wraps for the remaining devices, rate limits
at the edge, and an append-only rating/ballot model so "anonymous" never means "unattributable
to moderation".
