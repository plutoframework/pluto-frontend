# Pluto Frontend

Typed frontend primitives for Pluto applications. Start with explicit UI state
transitions and effects; subscribe from React when needed.

```sh
npm install @plutoframework/frontend
```

```ts
import { createMachine } from "@plutoframework/frontend/state";
import type { Decision } from "@plutoframework/frontend/state";
import { useMachine } from "@plutoframework/frontend/react";
```

The state entrypoint has **zero runtime dependencies**. React is an optional peer;
install React 18.3.1 or 19 separately when using the React entrypoint. This package
is ESM-only and includes TypeScript declarations. The root import is intentionally
absent: choose a specific primitive. No CSS, component library or Go runtime is
required. Future frontend primitives can use additional entrypoints here.

## Define a flow

```ts
import { createMachine } from "@plutoframework/frontend/state";
import type { Decision } from "@plutoframework/frontend/state";

type State = { readonly status: "idle" | "pending" | "done" };
type Event = { readonly type: "start" | "done" };
type Effect = { readonly type: "load" };

function transition(current: State, event: Event): Decision<State, Effect> {
  if (current.status === "idle" && event.type === "start") {
    return {
      accepted: true,
      state: { status: "pending" },
      effect: { type: "load" },
    };
  }

  if (current.status === "pending" && event.type === "done") {
    return { accepted: true, state: { status: "done" } };
  }

  return { accepted: false, state: current };
}

const flow = createMachine<State, Event, Effect>({
  initial: { status: "idle" },
  transition,
  async execute(_effect, { signal, send }) {
    const response = await fetch("/api/summary", { signal });
    if (!response.ok) throw new Error("Summary request failed");
    await send({ type: "done" });
  },
});

// Commits pending synchronously, then awaits its effect. Handle errors explicitly.
await flow.send({ type: "start" });
```

Use your feature's existing query/mutation adapter for real applications. The
small fetch example demonstrates the boundary; it is not a new HTTP client.

## Transition rules

Transitions are pure application functions. They must neither perform I/O nor
mutate state/events or call the controller. Return a new immutable snapshot for
accepted changes. Rejected decisions preserve the controller's existing snapshot,
even if the returned decision supplies a different state. TypeScript readonly
fields are compile-time guidance; this library does not clone or freeze objects.

An accepted decision may describe one effect. Missing executors are rejected
before committing an effect-bearing decision. Effects execute outside rendering,
reducers and subscription setup. States, events and guards remain ordinary typed
application code, with no global registration, reflection, DSL or automatic I/O.

## Controller lifecycle

| Method                 | Behavior                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `getSnapshot()`        | Returns the current stable snapshot                                                            |
| `getInitialSnapshot()` | Returns the immutable initial snapshot for SSR                                                 |
| `subscribe(listener)`  | Subscribes until the returned cleanup is called                                                |
| `send(event)`          | Commits an accepted transition synchronously; resolves to acceptance after its effect finishes |
| `reset()`              | Aborts executions, fences their callbacks and restores the initial snapshot                    |
| `dispose()`            | Permanently aborts executions, removes subscribers and rejects further events                  |

Always await or catch `send()` promises. Transition/executor/subscriber exceptions
reject the sending promise. Transition errors do not commit; executor or subscriber
errors after commit do not roll state back. Subscription callbacks must be small,
synchronous and nonthrowing. Model expected request failures as typed events, as
shown in [the purchase flow](https://github.com/plutoframework/pluto-frontend/blob/main/examples/purchases/approval.ts).

Each effect receives an AbortSignal and a scoped `send`. That callback returns
false after reset, disposal or executor completion, so late responses cannot
update a replacement interaction. Cancellation is cooperative: an executor that
ignores its signal can keep running, and its original sending promise can remain
pending. There are no automatic retries, execution timeouts or concurrency limits.
The transition function defines which events may start additional work.

## React

Pass an existing controller into your component:

```tsx
import type { Machine } from "@plutoframework/frontend/state";

function Summary({
  flow,
  onError,
}: {
  flow: Machine<State, Event>;
  onError: (error: unknown) => void;
}) {
  const { state, send } = useMachine(flow);

  return (
    <button
      disabled={state.status !== "idle"}
      onClick={() => void send({ type: "start" }).catch(onError)}
    >
      {state.status}
    </button>
  );
}
```

The hook uses `useSyncExternalStore`. Rendering, resubscription and Strict Mode
checks do not execute effects. The hook subscribes only: unmounting a subscriber
**does not dispose a shared controller**. The owning application/route/session
lifecycle must dispose it when its resource or identity scope ends. Create a fresh
controller for the new scope; do not reuse one across tenants or users. Do not
create a module-global controller for server requests. SSR needs equivalent
request-local initial data on server and client for hydration. Do not send events
from render or pure reducers. Strict Mode can replay caller-owned React Effects;
an imperative call placed in such an Effect is still the caller's responsibility.

See the fully typed [React purchase component](https://github.com/plutoframework/pluto-frontend/blob/main/examples/purchases/ApprovalButton.tsx)
and the [flow/executor](https://github.com/plutoframework/pluto-frontend/blob/main/examples/purchases/approval.ts). These original examples
are type-checked in CI and are independent of HeroUI/shadcn styling.

## Backend authority

A frontend interaction state such as `submitting` is distinct from the purchase's
persisted business status. The backend verifies identity, RBAC, tenant scope,
resource policy and state transitions on every write. Refresh authoritative query
data after a mutation or uncertain failure. An aborted request can still commit
on the server. UI request IDs correlate responses; they are not backend
idempotency keys, authorization or an exactly-once guarantee. Preserve your
feature mutation adapter's existing stable idempotency key for retries.

## Develop

Use Node 24.22.1:

```sh
npm ci
npm run check
npm run test:mutation
npm pack
```

Tests cover transition rejection, duplicate actions, stale callbacks, reset,
disposal, executor failures, React Strict Mode/SSR and 1,500 deterministic property
runs over arbitrary event sequences. Mutation smoke is a bounded set of seeded
mutations, not a comprehensive mutation engine. CI tests React 18.3.1 and 19.3.1.
Releases publish through GitHub Actions using npm trusted publishing (OIDC);
no npm credentials are stored in this repository or in GitHub Actions.

## Publish a release

The `publish.yml` workflow publishes stable `vMAJOR.MINOR.PATCH` tags using npm
trusted publishing and provenance. It checks tag/version agreement and main-branch
ancestry, runs tests and mutation checks, and verifies packed consumers before
publishing. Prereleases are rejected. Manual dispatch accepts an existing tag for
retrying a failed publish; npm never overwrites an already published version.

After merging the intended changes into main:

```sh
npm version patch
git push origin main --follow-tags
```

The one-time npm trusted publisher is scoped to:

| Setting        | Value            |
| -------------- | ---------------- |
| Organization   | `plutoframework` |
| Repository     | `pluto-frontend` |
| Workflow       | `publish.yml`    |
| Environment    | None             |
| Allowed action | `npm publish`    |

The workflow uses GitHub-hosted runners with `id-token: write`; npm exchanges the
workflow identity for a short-lived publish credential. No `NPM_TOKEN` secret is
needed. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## Source readability

Development tooling uses ESLint Stylistic with an 80-column expanded convention.
Run `npm run fmt` to apply the canonical Prettier + ESLint result. `npm run check`
checks formatting without writing, then lint, types, behavior tests and builds.
Braces, multiline blocks, separated object/type fields and logical blank lines
are enforced; nested ternaries require explicit branches or named mappings.
The policy is visible in `scripts/readability.mjs`. These are dev-only tools and
add no runtime dependencies to state or React entrypoints.

Standalone comment blocks have one blank line above them, except at line 1.
Consecutive comment lines stay together, and the comment remains attached to the
code below. JavaScript and TypeScript lint/format checks enforce this convention,
including the start of a function or branch. Inline trailing comments are kept
in place, and next-line compiler/linter directives retain their target. The
cross-language convention is also recorded in AGENTS.md for future changes.
