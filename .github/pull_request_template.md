<!--
Keep the first line short; it becomes the commit subject when this is squashed.
-->

## Why

<!-- One paragraph. What breaks or what is missing today, in user terms. -->

## What

<!-- The shape of the change, not the diff. New store collection? New data-action? New route? -->

## Checklist

- [ ] `node tests/harness.mjs` — all green, and new assertions cover the change
- [ ] `node tools/check.mjs` — wiring, precache list, CSS tokens, JSON all pass
- [ ] Behaviour checked in **two tabs** (outbox flush, presence, `view:refresh`)
- [ ] Offline path considered (`sw.js` cache, queued writes, `?offline` reload)
- [ ] Small-screen layout checked at the 700px and 420px breakpoints
- [ ] Reduced motion respected for anything animated
- [ ] **Content policy**: no minors, no non-consent, no slurs, no real people; anything
      member-written is gated or held for review, not silently deleted
- [ ] No plaintext from chat messages, keys or passphrases in the diff, tests or screenshots
- [ ] README updated if a route, store collection, script tag or workflow changed
- [ ] `CHANGELOG.md` has an entry under Unreleased

## Screenshots / `preview.html`

<!-- Visible change? Show the before and after, or attach the regenerated snapshot file. -->

## Notes for the reviewer

<!-- Anything subtle: re-entrancy guards, repaint order, deep-link state, migration of stored data. -->
