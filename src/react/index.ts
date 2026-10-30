"use client";

import { useSyncExternalStore } from "react";
import type { Machine } from "../state/index.js";

/** Subscribe only. The host owns the controller's reset/disposal lifecycle. */
export function useMachine<State, Event>(machine: Machine<State, Event>) {
  const state = useSyncExternalStore(
    machine.subscribe,
    machine.getSnapshot,
    machine.getInitialSnapshot,
  );

  return {
    state,
    send: machine.send,
  };
}

export { useActions } from "./actions.js";

export type { ScopedActionOptions } from "./actions.js";
