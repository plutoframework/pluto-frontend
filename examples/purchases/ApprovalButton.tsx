import { useMachine } from "../../src/react/index.js";
import type { Machine } from "../../src/state/index.js";
import type { Event, State } from "./approval.js";

// Application composition creates one flow per purchase + identity scope and
// passes it in. The owning route/session lifecycle disposes it on scope exit.
export function ApprovalButton({
  flow,
  onUnexpectedError,
}: {
  flow: Machine<State, Event>;
  onUnexpectedError: (error: unknown) => void;
}) {
  const { state, send } = useMachine(flow);
  const dispatch = (event: Event) => {
    void send(event).catch(onUnexpectedError);
  };

  switch (state.status) {
    case "viewing":
      return (
        <button onClick={() => dispatch({ type: "open" })}>
          Approve purchase
        </button>
      );
    case "confirming":
      return (
        <section aria-label="Confirm approval">
          <p>Approve this purchase?</p>
          <button
            onClick={() =>
              dispatch({ type: "confirm", requestId: crypto.randomUUID() })
            }
          >
            Confirm
          </button>
          <button onClick={() => dispatch({ type: "cancel" })}>Cancel</button>
        </section>
      );
    case "submitting":
      return <button disabled>Submitting approval…</button>;
    case "succeeded":
      return <p role="status">Approved. Refresh the purchase details.</p>;
    case "failed":
      return (
        <section>
          <p role="alert">{state.message}</p>
          <button onClick={() => dispatch({ type: "dismiss-error" })}>
            Dismiss
          </button>
        </section>
      );
  }
}
