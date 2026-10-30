# Testing optimistic actions with controlled promises

From this repository with Node 24.22.1:

```sh
npm ci
npm run example:actions
```

No API, database, model or credentials are involved. The script compiles the
example into a temporary directory, runs it, and removes its build artifacts.

[`optimistic.ts`](optimistic.ts) keeps canonical rows in the feature and projects
pending deletions over the latest rows. `two` succeeds while `one` is pending;
a new row arrives; then `one` is definitely rejected. Its visibility is restored
without undoing the confirmed removal or losing the new row.

A third request loses its response. Its projection remains, status is uncertain,
and another write to that resource is rejected until authoritative reconciliation.
The sample reconciliation establishes that the record still exists. A real app
must get that evidence from its server, not infer it from a timeout.

Expected output:

```text
pending: three
after rejection: one, three, four
uncertain: one, four
blind retry accepted: false
after reconciliation: one, three, four
```

[`tests/optimistic-example.test.ts`](../../tests/optimistic-example.test.ts) asserts
those independent outcomes with held promises. Pending-confirmation UI remains
the default; call `project(..., { mode: "optimistic", ... })` only when appropriate.
Use `/query` for scoped cache integration and `/react` for lifecycle ownership;
this headless example demonstrates their shared controller contract.
