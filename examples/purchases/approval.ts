import { createMachine } from "../../src/state/index.js";
import type { Decision } from "../../src/state/index.js";

export type State =
  | { readonly status: "viewing" }
  | { readonly status: "confirming" }
  | {
      readonly status: "submitting";
      readonly requestId: string;
    }
  | { readonly status: "succeeded" }
  | {
      readonly status: "failed";
      readonly message: string;
    };

export type Event =
  | { readonly type: "open" }
  | { readonly type: "cancel" }
  | {
      readonly type: "confirm";
      readonly requestId: string;
    }
  | {
      readonly type: "resolved";
      readonly requestId: string;
    }
  | {
      readonly type: "rejected";
      readonly requestId: string;
    }
  | { readonly type: "dismiss-error" };

export type Effect = {
  readonly type: "approve";
  readonly requestId: string;
};

export function transition(
  current: State,
  event: Event,
): Decision<State, Effect> {
  switch (current.status) {
    case "viewing":
      if (event.type === "open") {
        return {
          accepted: true,
          state: { status: "confirming" },
        };
      }

      break;
    case "confirming":
      if (event.type === "cancel") {
        return {
          accepted: true,
          state: { status: "viewing" },
        };
      }

      if (event.type === "confirm" && event.requestId !== "") {
        return {
          accepted: true,
          state: {
            status: "submitting",
            requestId: event.requestId,
          },
          effect: {
            type: "approve",
            requestId: event.requestId,
          },
        };
      }

      break;
    case "submitting":
      if (event.type === "resolved" && event.requestId === current.requestId) {
        return {
          accepted: true,
          state: { status: "succeeded" },
        };
      }

      if (event.type === "rejected" && event.requestId === current.requestId) {
        return {
          accepted: true,
          state: {
            status: "failed",
            message: "Refresh to confirm purchase status.",
          },
        };
      }

      break;
    case "failed":
      if (event.type === "dismiss-error") {
        return {
          accepted: true,
          state: { status: "viewing" },
        };
      }

      break;
    case "succeeded":
      break;
  }

  return {
    accepted: false,
    state: current,
  };
}

export interface Dependencies {

  // Implement in the feature's mutation layer; preserve backend idempotency keys.
  readonly approvePurchase: (
    purchaseId: string,
    signal: AbortSignal,
  ) => Promise<void>;
}

export function createApproval(purchaseId: string, dependencies: Dependencies) {
  return createMachine<State, Event, Effect>({
    initial: { status: "viewing" },
    transition,
    async execute(effect, { signal, send }) {
      try {
        await dependencies.approvePurchase(purchaseId, signal);
      } catch {
        await send({
          type: "rejected",
          requestId: effect.requestId,
        });

        return;
      }

      await send({
        type: "resolved",
        requestId: effect.requestId,
      });
    },
  });
}
