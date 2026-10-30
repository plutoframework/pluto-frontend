// @vitest-environment jsdom
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useMachine } from "../src/react/index.js";
import { createMachine } from "../src/state/index.js";
import type { Machine } from "../src/state/index.js";

afterEach(cleanup);

function View({ machine }: { machine: Machine<string, string> }) {
  const { state, send } = useMachine(machine);

  return (
    <button
      onClick={() => {
        void send("start");
      }}
    >
      {state}
    </button>
  );
}

it("StrictMode subscriptions never trigger effects or duplicate user actions", async () => {
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });

  const execute = vi.fn(() => gate);
  const machine = createMachine<string, string, string>({
    initial: "idle",
    transition: (state) =>
      state === "idle"
        ? {
          accepted: true,
          state: "pending",
          effect: "work",
        }
        : {
          accepted: false,
          state,
        },
    execute,
  });

  const first = render(
    <StrictMode>
      <View machine={machine} />
    </StrictMode>,
  );

  expect(execute).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button"));
  fireEvent.click(screen.getByRole("button"));
  expect(execute).toHaveBeenCalledOnce();
  expect(screen.getByRole("button").textContent).toBe("pending");
  first.unmount();
  render(
    <StrictMode>
      <View machine={machine} />
    </StrictMode>,
  );
  expect(screen.getByRole("button").textContent).toBe("pending");
  expect(execute).toHaveBeenCalledOnce();
  await act(async () => {
    finish();
    await gate;
    machine.reset();
  });
  expect(screen.getByRole("button").textContent).toBe("idle");
  machine.dispose();
});

it("server renders fresh request-local initial data without effects", () => {
  const execute = vi.fn();
  const machine = createMachine({
    initial: "idle",
    execute,
    transition: (state: string) => ({
      accepted: false,
      state,
    }),
  });

  expect(renderToString(<View machine={machine} />)).toContain("idle");
  expect(execute).not.toHaveBeenCalled();
});
