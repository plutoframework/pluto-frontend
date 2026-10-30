"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createActions } from "../actions/index.js";
import type {
  ActionEntry,
  ActionOptions,
  Actions,
  Feedback,
} from "../actions/index.js";

export interface ScopedActionOptions<Input, Output> extends ActionOptions<
  Input,
  Output
> {
  readonly scope: string;
}

const useCommittedEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const empty: readonly never[] = [];
const subscribeEmpty = () => () => {};

const getEmpty = () => empty;

/** Owns one action store per committed identity/tenant scope, including StrictMode. */
export function useActions<Input, Output>(
  options: ScopedActionOptions<Input, Output>,
) {
  const current = useRef(options);
  const [owned, setOwned] = useState<{
    scope: string;
    store: Actions<Input, Output>;
  } | null>(null);

  useCommittedEffect(() => {
    current.current = options;
  });

  useCommittedEffect(() => {
    const store = createActions<Input, Output>({
      execute: (input, context) => current.current.execute(input, context),
      classifyError: (error) =>
        current.current.classifyError?.(error) ?? "uncertain",
      confirm: (output, input) => current.current.confirm?.(output, input),
      reconcile: (input) => current.current.reconcile?.(input),
      ...(options.capacity === undefined ? {} : { capacity: options.capacity }),
    });

    setOwned({
      scope: options.scope,
      store,
    });

    return () => store.dispose();
  }, [options.scope, options.capacity]);

  const store = owned?.scope === options.scope ? owned.store : null;
  const entries: readonly ActionEntry<Input, Output>[] = useSyncExternalStore(
    store?.subscribe ?? subscribeEmpty,
    store?.getSnapshot ?? getEmpty,
    store?.getInitialSnapshot ?? getEmpty,
  );

  return {
    ready: store !== null,
    entries,
    get: (key: string) =>
      store?.getSnapshot().find((entry) => entry.key === key),
    run: (key: string, input: Input) =>
      store?.run(key, input) ?? Promise.resolve(false),
    resolve: (key: string, status: "succeeded" | "rejected") =>
      store?.resolve(key, status) ?? Promise.resolve(false),
    forget: (key: string) => store?.forget(key) ?? Promise.resolve(false),
    project<View>(value: View, feedback: Feedback<Input, View>) {
      return store?.project(value, feedback) ?? value;
    },
  };
}
