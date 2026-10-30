"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useActions } from "../react/actions.js";
import type { ScopedActionOptions } from "../react/actions.js";

export interface ActionMutationOptions<Input, Output> extends Omit<
  ScopedActionOptions<Input, Output>,
  "confirm" | "reconcile"
> {
  readonly confirm?: (
    output: Output,
    input: Input,
    client: QueryClient,
  ) => void;
  readonly reconcile?: (
    input: Input,
    client: QueryClient,
  ) => void | Promise<void>;
}

/** Query integration is optional; use existing feature transport functions. */
export function useActionMutation<Input, Output>(
  options: ActionMutationOptions<Input, Output>,
) {
  const client = useQueryClient();

  return useActions({
    ...options,
    confirm: (output, input) => options.confirm?.(output, input, client),
    reconcile: (input) => options.reconcile?.(input, client),
  });
}
