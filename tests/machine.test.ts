import { describe, expect, it, vi } from "vitest";
import { createMachine } from "../src/state/index.js";
import type { EffectContext } from "../src/state/index.js";
import { createApproval } from "../examples/purchases/approval.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function work() {
  const gate = deferred();
  let context!: EffectContext<string>;
  const execute = vi.fn(
    async (_effect: string, value: EffectContext<string>) => {
      context = value;
      await gate.promise;
      await value.send("done");
    },
  );
  const machine = createMachine<string, string, string>({
    initial: "idle",
    transition(current, event) {
      if (current === "idle" && event === "start") {
        return { accepted: true, state: "pending", effect: "work" };
      }
      if (current === "pending" && event === "done") {
        return { accepted: true, state: "done" };
      }
      if (current === "done" && event === "restart") {
        return { accepted: true, state: "idle" };
      }
      return { accepted: false, state: current };
    },
    execute,
  });
  return { gate, machine, execute, context: () => context };
}

describe("controller", () => {
  it("commits before effects and blocks duplicate submission", async () => {
    const { machine, execute, gate } = work();
    const listener = vi.fn();
    const unsubscribe = machine.subscribe(listener);
    expect(execute).not.toHaveBeenCalled();
    const pending = machine.send("start");
    expect(machine.getSnapshot()).toBe("pending");
    expect(listener).toHaveBeenCalledOnce();
    expect(await machine.send("start")).toBe(false);
    expect(execute).toHaveBeenCalledOnce();
    gate.resolve();
    expect(await pending).toBe(true);
    expect(machine.getSnapshot()).toBe("done");
    unsubscribe();
    machine.reset();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("fences reset completions even when execution ignores abort", async () => {
    const { machine, gate, context } = work();
    const pending = machine.send("start");
    const previous = context();
    machine.reset();
    expect(previous.signal.aborted).toBe(true);
    const next = machine.send("start");
    expect(await previous.send("done")).toBe(false);
    expect(machine.getSnapshot()).toBe("pending");
    gate.resolve();
    await pending;
    await next;
    expect(machine.getSnapshot()).toBe("done");
    expect(await previous.send("done")).toBe(false);
  });

  it("disposal is permanent and aborts outstanding work", async () => {
    const { machine, gate, context } = work();
    const pending = machine.send("start");
    machine.dispose();
    expect(context().signal.aborted).toBe(true);
    expect(await machine.send("done")).toBe(false);
    machine.reset();
    gate.resolve();
    await pending;
    expect(machine.getSnapshot()).toBe("pending");
    expect(await context().send("done")).toBe(false);
  });

  it("expires effect callbacks after completion", async () => {
    const { machine, gate, context } = work();
    const pending = machine.send("start");
    gate.resolve();
    await pending;
    expect(await context().send("restart")).toBe(false);
    expect(machine.getSnapshot()).toBe("done");
  });

  it("reset during notification prevents obsolete effect execution", async () => {
    const { machine, execute } = work();
    machine.subscribe(() => {
      if (machine.getSnapshot() === "pending") machine.reset();
    });
    await machine.send("start");
    expect(machine.getSnapshot()).toBe("idle");
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejected decisions cannot replace snapshots or run effects", async () => {
    const initial = { value: 1 };
    const execute = vi.fn();
    const machine = createMachine({
      initial,
      execute,
      transition: () => ({ accepted: false, state: { value: 2 } }),
    });
    const changed = vi.fn();
    machine.subscribe(changed);
    expect(await machine.send("invalid")).toBe(false);
    expect(machine.getSnapshot()).toBe(initial);
    expect(changed).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns executor errors to the sending caller", async () => {
    const failure = new Error("unexpected executor failure");
    const machine = createMachine({
      initial: "idle",
      transition: () => ({ accepted: true, state: "pending", effect: "work" }),
      execute: () => {
        throw failure;
      },
    });
    await expect(machine.send("start")).rejects.toBe(failure);
    expect(machine.getSnapshot()).toBe("pending");
  });

  it("rejects missing executors and transition errors before commit", async () => {
    const machine = createMachine<string, string, string>({
      initial: "idle",
      transition: () => ({ accepted: true, state: "pending", effect: "work" }),
    });
    await expect(machine.send("start")).rejects.toThrow("executor");
    expect(machine.getSnapshot()).toBe("idle");
  });

  it("fences purchase identity changes", async () => {
    const gate = deferred();
    const approve = vi.fn((_id: string, _signal: AbortSignal) => gate.promise);
    const flow = createApproval("purchase-1", { approvePurchase: approve });
    await flow.send({ type: "open" });
    const pending = flow.send({ type: "confirm", requestId: "request-1" });
    expect(approve.mock.calls[0]?.[0]).toBe("purchase-1");
    flow.dispose();
    gate.resolve();
    await pending;
    expect(flow.getSnapshot().status).toBe("submitting");
  });
});

it("transition exceptions leave the controller usable and unchanged", async () => {
  const failure = new Error("invalid rule");
  const machine = createMachine({
    initial: "idle",
    transition(current: string, event: string) {
      if (event === "bad") throw failure;
      return { accepted: true, state: current + "!" };
    },
  });
  await expect(machine.send("bad")).rejects.toBe(failure);
  expect(machine.getSnapshot()).toBe("idle");
  expect(await machine.send("good")).toBe(true);
  expect(machine.getSnapshot()).toBe("idle!");
});

it("fences synchronous abort handlers before reset notification", async () => {
  const { machine, context, gate } = work();
  const pending = machine.send("start");
  let response: Promise<boolean> | undefined;
  context().signal.addEventListener("abort", () => {
    response = context().send("done");
  });
  machine.reset();
  expect(await response).toBe(false);
  expect(machine.getSnapshot()).toBe("idle");
  gate.resolve();
  await pending;
});
