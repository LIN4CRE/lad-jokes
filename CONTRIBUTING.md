# Contributing

Thanks for taking an interest in a repo full of terrible decisions. This is a
zero-build prototype, which means contributing is mostly about *not* adding machinery.

## Ground rules

1. **No build step, no framework, no runtime dependencies.** The app is 20 `<script>`
   tags and plain ES5-style JS on one `window.LJ` namespace. `jsdom` is the only
   dependency in the tree and it is dev-only, for the test harness. If your change needs a
   dependency, open an issue first and be prepared to lose.
2. **`lib/store.js` is the only module that touches `localStorage`.** Everything else goes
   through `LJ.store.get/put/patch/remove/where/setting`. Same for the sync boundary: if a
   mutation should reach other tabs, it must go through the store, not around it.
3. **Views own their markup, actions own their writes.** Register a `data-action` handler
   with `LJ.router.action(name, fn)`; don't bolt `addEventListener` onto nodes that a
   repaint will throw away (the one exception is form `submit`, which re-attaches per
   repaint and self-dedupes).
4. **Content policy is not negotiable.** 18+ tone, no graphic sexual content, no minors,
   no non-consent, no slurs, no real people. Seed stories are fictional. If a change makes
   the moderation gates weaker, it will be closed.

## Dev loop

```bash
git clone https://github.com/LIN4CRE/lad-jokes && cd lad-jokes
npm install            # jsdom, for the harness only
npm run serve          # http://localhost:8123
node tests/harness.mjs # 304 assertions against the served app
npm run check          # static wiring: refs, precache list, JSON, CSS, syntax
```

Both `check` and `harness` run in CI on every push and pull request, so run them locally
before you push and the pipeline should be boring.

## Style

* Two-space indent, semicolons, single quotes inside strings, no arrow functions in
  `lib/` and `views/` (they run as classic scripts and should read the same in any
  browser), ES modules are fine in `tools/` and `tests/`.
* Comments explain *why*, and only where a reader would otherwise guess. Several comments
  in this repo are the scar tissue of a specific bug — keep them, they're load-bearing.
* CSS lives in `styles/app.css` against the existing token set
  (`--surface-2`, `--accent`, `--line`, …). New components get a block with a heading
  comment, like everything else in that file.
* Line length: aim under 120. The files are already long; don't make them wider.

## Tests

Behaviour changes need a harness assertion. The style that works here:

* assert on **store state** when you care about the data (`LJ.store.all('comments')`), on
  **DOM** when you care about what a human sees;
* compare **deltas**, not absolute counts — seed offsets and other steps will drift;
* after a navigation, `await waitUntil(...)` rather than a fixed `sleep` where a repaint
  is involved, and keep `toFeed()` as the reset between feed probes.

Adding a check is cheap: `check('my thing works', condition, detailForFailures)`.

## Pull requests

* One idea per PR; the template asks for the *why* before the diff.
* Put a screenshot or `preview.html` snippet in the PR if the change is visible.
* If you touch `index.html` load order, `sw.js` `ASSETS`, or `app.webmanifest`, run
  `npm run check` — those three are where dangling references hide.
* Maintainers review for the content policy as carefully as for correctness.

## What I will say no to

Server code, React, TypeScript, a bundler, a database, analytics scripts, tracking pixels,
anything that phones home, and "just let people post whatever". The README already contains
the production architecture write-up for the first three; the last two are the point of the
project.
