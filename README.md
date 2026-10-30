<p align="center">
  <img src="https://raw.githubusercontent.com/plutoframework/pluto/main/assets/readme/banner.svg" alt="Pluto — a small framework, wide open possibilities" width="100%" />
</p>

# Pluto Frontend

Responsive interfaces. Explicit state. Predictable effects.

[Website](https://plutoframework.github.io/pluto-site/) · [Documentation](https://plutoframework.github.io/pluto-site/docs/frontend/state/) · [CLI demo](https://github.com/plutoframework/pluto/blob/main/docs/DEMO.md) · [First issues](https://github.com/plutoframework/pluto/blob/main/CONTRIBUTING.md#starter-tasks)

## What you get

- Dependency-free state machines and headless action controllers.
- Optional React subscriptions and scoped action ownership.
- Optional TanStack Query integration with explicit optimistic projections.

## Get started

### 1. Install

For an ESM project (the Pluto scaffold uses Node **24.22.1**):

```sh
npm install @plutoframework/frontend@0.2.1
```

React is optional; `/query` also needs the TanStack Query v5 peer. Pure `/state`
and `/actions` consumers acquire neither dependency.

### 2. Try an action

Save this as `action.mjs`, then run `node action.mjs`:

```js
import { createActions } from "@plutoframework/frontend/actions";

const actions = createActions({
  execute: async (id) => ({ id, saved: true }),
});

await actions.run("purchase-42", "purchase-42");
console.log(actions.getSnapshot()[0].status);
actions.dispose();
```

This local demonstration prints `succeeded`; replace the executor with a feature
adapter when connecting an API. Choose explicit entrypoints; there is no root import.

### 3. Connect the UI

Use `useActions` from `/react` or `useActionMutation` from `/query`. Every action
acknowledges immediately; pending confirmation is the default. Keep authority on
the server and scope callbacks/cache keys by actor, session and tenant.

## Responsive actions

Select optimistic projections only for predictable, recoverable interactions.
Apply confirmed data before background refresh, preserve failed input and
reconcile uncertain outcomes before retrying. Read the [complete action API](https://github.com/plutoframework/pluto-frontend/blob/main/docs/REFERENCE.md#responsive-actions)
and [responsive UI guide](https://plutoframework.github.io/pluto-site/docs/frontend/actions/).

## Read further

- [API and integration reference](https://github.com/plutoframework/pluto-frontend/blob/main/docs/REFERENCE.md)
- [Field guide](https://plutoframework.github.io/pluto-site/docs/frontend/state/)
- [Pluto ecosystem](https://github.com/plutoframework/pluto#the-ecosystem)

## Boundaries

No durable recovery, offline queue or cross-component lock is implied. Cancellation is cooperative; frontend state never provides backend authorization or idempotency.

## Contribute

Start with [CONTRIBUTING.md](https://github.com/plutoframework/pluto-frontend/blob/main/CONTRIBUTING.md), then choose a [good first issue](https://github.com/plutoframework/pluto/blob/main/CONTRIBUTING.md#starter-tasks).

MIT licensed. See [LICENSE](https://github.com/plutoframework/pluto-frontend/blob/main/LICENSE).
