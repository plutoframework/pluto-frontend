/** Domain facts belong in immutable state/events supplied by the host. */
export type Decision<State, Effect = never> =
  | {
      readonly accepted: true;
      readonly state: State;
      readonly effect?: Effect;
    }
  | {
      readonly accepted: false;
      readonly state: State;
    };

export type Transition<State, Event, Effect = never> = (
  current: State,
  event: Event,
) => Decision<State, Effect>;

export interface EffectContext<Event> {
  readonly signal: AbortSignal;

  /** Scoped to this execution; returns false after reset/disposal/completion. */
  readonly send: (event: Event) => Promise<boolean>;
}

export interface MachineOptions<State, Event, Effect = never> {
  readonly initial: State;
  readonly transition: Transition<State, Event, Effect>;
  readonly execute?: (
    effect: Effect,
    context: EffectContext<Event>,
  ) => void | Promise<void>;
}

export interface Machine<State, Event> {
  readonly getSnapshot: () => State;

  /** Stable initial snapshot for SSR; host must hydrate equivalent initial data. */
  readonly getInitialSnapshot: () => State;
  readonly subscribe: (listener: () => void) => () => void;

  /** Commits synchronously, resolves after its effect. Unexpected errors reject. */
  readonly send: (event: Event) => Promise<boolean>;

  /** Cancel outstanding executions, fence their callbacks, restore initial state. */
  readonly reset: () => void;

  /** Permanent teardown. Further events are rejected. */
  readonly dispose: () => void;
}
