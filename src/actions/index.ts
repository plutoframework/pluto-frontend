import { createMachine } from "../state/index.js";
import type {
  ActionEntry,
  ActionOptions,
  FailureKind,
  Feedback,
} from "./types.js";

export type {
  ActionEntry,
  ActionOptions,
  FailureKind,
  Feedback,
} from "./types.js";

type Event<Input, Output> =
  | {
      readonly type: "start";
      readonly entry: ActionEntry<Input, Output>;
    }
  | {
      readonly type: "finish";
      readonly entry: ActionEntry<Input, Output>;
    }
  | {
      readonly type: "forget";
      readonly key: string;
    };

/** One store belongs to one actor/tenant scope; projections never mutate cache. */
export function createActions<Input, Output>(
  options: ActionOptions<Input, Output>,
) {
  type Entry = ActionEntry<Input, Output>;

  const capacity = options.capacity ?? 1000;

  if (!Number.isSafeInteger(capacity) || capacity < 1) {
    throw new Error("Action capacity must be a positive integer");
  }

  let attempt = 0;
  let disposed = false;
  const initial: readonly Entry[] = [];
  const store = createMachine<readonly Entry[], Event<Input, Output>, Entry>({
    initial,
    transition(current, event) {
      const key = event.type === "forget" ? event.key : event.entry.key;
      const previous = current.find((entry) => entry.key === key);
      const locked =
        previous?.status === "pending" || previous?.status === "uncertain";

      if (event.type === "start") {
        if (locked || (!previous && current.length >= capacity)) {
          return {
            accepted: false,
            state: current,
          };
        }

        return {
          accepted: true,
          state: [...current.filter((entry) => entry.key !== key), event.entry],
          effect: event.entry,
        };
      }

      if (event.type === "forget") {
        if (!previous || locked) {
          return {
            accepted: false,
            state: current,
          };
        }

        return {
          accepted: true,
          state: current.filter((entry) => entry.key !== key),
        };
      }

      if (!previous || previous.attempt !== event.entry.attempt) {
        return {
          accepted: false,
          state: current,
        };
      }

      return {
        accepted: true,
        state: current.map((entry) =>
          entry.key === key ? event.entry : entry,
        ),
      };
    },
    async execute(entry, { signal, send }) {
      let completed: Entry;

      try {
        const output = await options.execute(entry.input, { signal });

        if (signal.aborted) {
          return;
        }

        let refreshError: unknown;

        try {
          options.confirm?.(output, entry.input);
        } catch (error) {
          refreshError = error;
        }

        completed = {
          ...entry,
          status: "succeeded",
          output,
          ...(refreshError === undefined ? {} : { refreshError }),
        };
      } catch (error) {
        if (signal.aborted) {
          return;
        }

        let status: FailureKind = "uncertain";

        try {
          status = options.classifyError?.(error) ?? "uncertain";
        } catch {

          // Classification failure must not turn uncertainty into rejection.
        }

        completed = {
          ...entry,
          status,
          error,
        };
      }

      if (
        signal.aborted ||
        !(await send({
          type: "finish",
          entry: completed,
        }))
      ) {
        return;
      }

      // Do not keep an acknowledged action pending while canonical reads refresh.
      void Promise.resolve().then(async () => {
        if (signal.aborted || disposed) {
          return;
        }

        try {
          await options.reconcile?.(entry.input);
        } catch (refreshError) {
          if (!signal.aborted && !disposed) {
            const latest = store
              .getSnapshot()
              .find((item) => item.key === entry.key);

            if (latest?.attempt === entry.attempt) {
              await store.send({
                type: "finish",
                entry: {
                  ...latest,
                  refreshError,
                },
              });
            }
          }
        }
      });
    },
  });

  return {
    getSnapshot: store.getSnapshot,
    getInitialSnapshot: store.getInitialSnapshot,
    subscribe: store.subscribe,
    run(key: string, input: Input) {
      if (!key) {
        return Promise.reject(new Error("An action key is required"));
      }

      return store.send({
        type: "start",
        entry: {
          key,
          input,
          attempt: ++attempt,
          status: "pending",
        },
      });
    },
    forget: (key: string) =>
      store.send({
        type: "forget",
        key,
      }),

    /** Host must establish the outcome through authoritative reconciliation. */
    resolve(key: string, status: "succeeded" | "rejected") {
      const entry = store.getSnapshot().find((item) => item.key === key);

      if (entry?.status !== "uncertain") {
        return Promise.resolve(false);
      }

      return store.send({
        type: "finish",
        entry: {
          ...entry,
          status,
        },
      });
    },
    project<View>(current: View, feedback: Feedback<Input, View>): View {
      if (feedback.mode === "pending") {
        return current;
      }

      return store.getSnapshot().reduce((view, entry) => {
        if (entry.status !== "pending" && entry.status !== "uncertain") {
          return view;
        }

        return feedback.project(view, entry.input);
      }, current);
    },
    dispose() {
      disposed = true;
      store.dispose();
    },
  };
}

export type Actions<Input, Output> = ReturnType<
  typeof createActions<Input, Output>
>;
