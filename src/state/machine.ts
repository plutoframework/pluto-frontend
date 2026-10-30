import type { Machine, MachineOptions } from "./types.js";

/** One controller owns one interaction. Constructors perform no effects. */
export function createMachine<State, Event, Effect = never>(
  options: MachineOptions<State, Event, Effect>,
): Machine<State, Event> {
  const { initial, transition, execute } = options;
  let current = initial;
  let epoch = 0;
  let disposed = false;
  let evaluating = false;
  const listeners = new Set<() => void>();
  const executions = new Set<AbortController>();

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  function cancel(): void {
    // Fence callbacks BEFORE synchronous abort handlers can send events.
    epoch++;
    for (const controller of executions) controller.abort();
    executions.clear();
  }

  async function send(event: Event): Promise<boolean> {
    if (disposed) return false;
    if (evaluating) throw new Error("Transitions must not send events");
    const generation = epoch;
    evaluating = true;
    let decision;
    try {
      decision = transition(current, event);
    } finally {
      evaluating = false;
    }
    if (!decision.accepted) return false;
    if (decision.effect !== undefined && !execute) {
      throw new Error("An effect requires an executor");
    }

    const controller = new AbortController();
    let active = true;
    executions.add(controller);
    current = decision.state;
    try {
      notify();
      // Subscribers may reset/dispose the flow during notification.
      if (generation !== epoch || disposed) return true;
      if (decision.effect !== undefined && execute) {
        await execute(decision.effect, {
          signal: controller.signal,
          send: (next) => {
            if (!active || generation !== epoch || disposed) {
              return Promise.resolve(false);
            }
            return send(next);
          },
        });
      }
      return true;
    } finally {
      active = false;
      executions.delete(controller);
    }
  }

  return {
    getSnapshot: () => current,
    getInitialSnapshot: () => initial,
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    send,
    reset() {
      if (disposed) return;
      cancel();
      current = initial;
      notify();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      listeners.clear();
    },
  };
}
