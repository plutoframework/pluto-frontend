export type FailureKind = "rejected" | "uncertain";

export interface ActionEntry<Input, Output> {
  readonly key: string;
  readonly attempt: number;
  readonly input: Input;
  readonly status: "pending" | "succeeded" | FailureKind;
  readonly output?: Output;
  readonly error?: unknown;
  readonly refreshError?: unknown;
}

export interface ActionOptions<Input, Output> {
  readonly execute: (
    input: Input,
    context: { readonly signal: AbortSignal },
  ) => Promise<Output>;

  /** Only classify as rejected when the server definitely refused the write. */
  readonly classifyError?: (error: unknown) => FailureKind;

  /** Apply authoritative response data synchronously before success is visible. */
  readonly confirm?: (output: Output, input: Input) => void;

  /** Refresh in the background. Failure never reclassifies a confirmed write. */
  readonly reconcile?: (input: Input) => void | Promise<void>;
  readonly capacity?: number;
}

export type Feedback<Input, View> =
  | { readonly mode: "pending" }
  | {
      readonly mode: "optimistic";
      readonly project: (current: View, input: Input) => View;
    };
