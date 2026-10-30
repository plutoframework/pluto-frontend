import { expect, it } from "vitest";
import fc from "fast-check";
import { transition } from "../examples/purchases/approval.js";
import type { Event, State } from "../examples/purchases/approval.js";

it("requires confirmation, correlates responses and keeps success terminal", () => {
  const pending: State = {
    status: "submitting",
    requestId: "current",
  };

  expect(
    transition(
      { status: "viewing" },
      {
        type: "confirm",
        requestId: "current",
      },
    ).accepted,
  ).toBe(false);
  expect(
    transition(pending, {
      type: "resolved",
      requestId: "old",
    }).accepted,
  ).toBe(false);
  expect(
    transition(pending, {
      type: "rejected",
      requestId: "old",
    }).accepted,
  ).toBe(false);
  expect(
    transition(
      { status: "confirming" },
      {
        type: "confirm",
        requestId: "",
      },
    ).accepted,
  ).toBe(false);
  expect(
    transition(pending, {
      type: "confirm",
      requestId: "current",
    }).accepted,
  ).toBe(false);
  expect(
    transition(pending, {
      type: "resolved",
      requestId: "current",
    }).state.status,
  ).toBe("succeeded");
  expect(transition({ status: "succeeded" }, { type: "open" }).accepted).toBe(
    false,
  );
});

it("preserves lifecycle invariants across arbitrary event sequences", () => {
  const event = fc.oneof(
    fc.constantFrom<Event>(
      { type: "open" },
      { type: "cancel" },
      { type: "dismiss-error" },
    ),
    fc.record({
      type: fc.constantFrom("confirm", "resolved", "rejected"),
      requestId: fc.constantFrom("", "a", "b"),
    }) as fc.Arbitrary<Event>,
  );

  fc.assert(
    fc.property(fc.array(event, { maxLength: 150 }), (events) => {
      let current: State = { status: "viewing" };

      for (const event of events) {
        const before = current;
        const decision = transition(current, event);
        const allowed =
          (before.status === "viewing" && event.type === "open") ||
          (before.status === "confirming" &&
            (event.type === "cancel" ||
              (event.type === "confirm" && event.requestId !== ""))) ||
          (before.status === "submitting" &&
            (event.type === "resolved" || event.type === "rejected") &&
            event.requestId === before.requestId) ||
          (before.status === "failed" && event.type === "dismiss-error");

        expect(decision.accepted).toBe(allowed);

        if (!decision.accepted) {
          expect(decision.state).toBe(before);
        } else {
          const expected = {
            open: "confirming",
            cancel: "viewing",
            confirm: "submitting",
            resolved: "succeeded",
            rejected: "failed",
            "dismiss-error": "viewing",
          }[event.type];

          expect(decision.state.status).toBe(expected);
          expect(decision.effect?.type).toBe(
            event.type === "confirm" ? "approve" : undefined,
          );
        }

        current = decision.state;
      }
    }),
    {
      seed: 6101,
      numRuns: 1500,
    },
  );
});
