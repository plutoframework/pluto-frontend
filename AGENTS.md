# Working on Pluto Frontend

Keep state primitives dependency-free; React is an optional peer imported only
through the react entrypoint. Prefer explicit typed transitions and immutable
snapshots. Effects never run in constructors, render, reducers or subscriptions.
Never interpret UI state as backend authorization, durability or idempotency.
Keep source below 1,000 lines per file and format at 80 columns. Lockfiles are
machine-generated exceptions. Keep credentials and .npmrc out of Git/packages.
Run npm run check, npm run test:mutation and test the packed package before release.
Use deterministic property tests and deferred promises for concurrency boundaries.
