import type { Decision, Machine } from "../src/state/index.js";
import type { Event, State } from "../examples/purchases/approval.js";

// Compiled with the examples: invalid events and mutable snapshots must fail.
export function typeBoundaries(machine: Machine<State, Event>) {
  // @ts-expect-error event names belong to the application's union
  void machine.send({ type: "grant-admin" });
  // @ts-expect-error confirm needs its correlation ID
  void machine.send({ type: "confirm" });
  // @ts-expect-error snapshots are application-owned readonly values
  machine.getSnapshot().status = "viewing";
  const rejected: Decision<State, string> = {
    accepted: false,
    state: { status: "viewing" },
    // @ts-expect-error rejected decisions cannot schedule work
    effect: "work",
  };
  return rejected;
}
