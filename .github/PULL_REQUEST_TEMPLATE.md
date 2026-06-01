<!--
Thanks for the PR. Keep it small if you can. If you change loop / inference /
governor behaviour, be deliberate — other modules parse the episodic file
format and marker strings as a contract.
-->

## Change

<!-- One line on what this is. -->

## What changed

- ...

## Why this shape

<!--
Briefly: the alternatives and why this is the chosen form. If the change touches
an architectural commitment (see CONTRIBUTING.md), call it out here.
-->

## Verification

- [ ] `npm run typecheck` passes (server, `tsc --noEmit`)
- [ ] `cd web && npm run build` passes (frontend `tsc && vite build`)
- [ ] Ran it against the live server (`npm start`) on at least one instance
- [ ] If it touches the loop / sandbox / SP-I: confirmed behaviour still matches
      the original semantics

## Out of scope for this PR

<!-- What you deliberately didn't do, even though it's adjacent. -->
