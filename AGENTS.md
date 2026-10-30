# Working on Pluto Frontend

Keep state primitives dependency-free; React is an optional peer imported only
through the react entrypoint. Prefer explicit typed transitions and immutable
snapshots. Effects never run in constructors, render, reducers or subscriptions.
Never interpret UI state as backend authorization, durability or idempotency.
Keep source below 1,000 lines per file and format at 80 columns. Lockfiles are
machine-generated exceptions. Keep credentials and .npmrc out of Git/packages.
Run npm run check, npm run test:mutation and test the packed package before release.
Use deterministic property tests and deferred promises for concurrency boundaries.

Across languages, put one blank line before a standalone comment block unless
it starts on line 1. Keep consecutive comment lines together and keep the comment
attached to the code below it. Preserve trailing inline comments and any placement
required by compiler/tool directives; never separate a next-line directive from
its target. This preference also applies at the beginning of a code block.
