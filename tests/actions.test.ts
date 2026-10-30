import { expect, it, vi } from "vitest";
import { createActions } from "../src/actions/index.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

it("acknowledges synchronously, prevents duplicate writes and confirms before refresh", async () => {
  const request = deferred<string>();
  const refresh = deferred<void>();
  const confirm = vi.fn();
  const execute = vi.fn(() => request.promise);
  const actions = createActions({
    execute,
    confirm,
    reconcile: () => refresh.promise,
  });

  const running = actions.run("one", "input");
  expect(actions.getSnapshot()[0]?.status).toBe("pending");
  expect(await actions.run("one", "duplicate")).toBe(false);
  expect(execute).toHaveBeenCalledOnce();
  request.resolve("saved");
  expect(await running).toBe(true);
  expect(confirm).toHaveBeenCalledWith("saved", "input");
  expect(actions.getSnapshot()[0]?.status).toBe("succeeded");
  refresh.resolve();
  actions.dispose();
});

it("projects pending removals over current data without reverting other changes", async () => {
  const one = deferred<void>();
  const two = deferred<void>();
  const actions = createActions<string, void>({
    execute: (id) => (id === "one" ? one.promise : two.promise),
    classifyError: () => "rejected",
  });

  const feedback = {
    mode: "optimistic" as const,
    project: (rows: string[], id: string) => rows.filter((row) => row !== id),
  };

  const first = actions.run("one", "one");
  const second = actions.run("two", "two");
  expect(actions.project(["one", "two", "three"], feedback)).toEqual(["three"]);
  two.resolve();
  await second;

  // The authoritative cache has now removed two and acquired a new row.
  const latest = ["one", "three", "four"];
  one.reject(new Error("Denied"));
  await first;
  expect(actions.project(latest, feedback)).toEqual(latest);
  expect(actions.project(latest, { mode: "pending" })).toBe(latest);
  actions.dispose();
});

it("keeps uncertain writes locked until the host establishes their outcome", async () => {
  const actions = createActions({
    execute: async () => {
      throw new Error("Timeout");
    },
  });

  await actions.run("record", "input");
  expect(actions.getSnapshot()[0]?.status).toBe("uncertain");
  expect(await actions.run("record", "retry")).toBe(false);
  expect(await actions.forget("record")).toBe(false);
  expect(await actions.resolve("record", "succeeded")).toBe(true);
  expect(await actions.forget("record")).toBe(true);
  actions.dispose();
});

it("fences noncooperative completion after disposal and aborts its signal", async () => {
  const request = deferred<string>();
  const confirm = vi.fn();
  let signal!: AbortSignal;
  const actions = createActions({
    execute: async (_input: string, context) => {
      signal = context.signal;

      return request.promise;
    },
    confirm,
  });

  const running = actions.run("one", "input");
  actions.dispose();
  expect(signal.aborted).toBe(true);
  request.resolve("late");
  await running;
  expect(confirm).not.toHaveBeenCalled();
  expect(await actions.run("two", "input")).toBe(false);
});

it("never turns a confirmed write into rejection when cache synchronization fails", async () => {
  const actions = createActions({
    execute: async () => "saved",
    confirm: () => {
      throw new Error("Cache update failed");
    },
    reconcile: async () => {
      throw new Error("Refresh failed");
    },
  });

  await actions.run("one", "input");
  await vi.waitFor(() =>
    expect(actions.getSnapshot()[0]?.refreshError).toBeDefined(),
  );
  expect(actions.getSnapshot()[0]?.status).toBe("succeeded");
  expect(actions.getSnapshot()[0]?.output).toBe("saved");
  actions.dispose();
});

it("bounds retained entries and permits forgetting only terminal outcomes", async () => {
  expect(() =>
    createActions({
      capacity: 0,
      execute: async () => "x",
    }),
  ).toThrow();
  const actions = createActions({
    capacity: 1,
    execute: async () => "saved",
  });

  await actions.run("one", "input");
  expect(await actions.run("two", "input")).toBe(false);
  await actions.forget("one");
  expect(await actions.run("two", "input")).toBe(true);
  await expect(actions.run("", "input")).rejects.toThrow();
  actions.dispose();
});

it("does not let an old background refresh failure overwrite a newer action", async () => {
  const refresh = deferred<void>();
  let count = 0;
  const actions = createActions({
    execute: async () => ++count,
    reconcile: () => (count === 1 ? refresh.promise : undefined),
  });

  await actions.run("one", "first");
  await actions.run("one", "second");
  refresh.reject(new Error("Old refresh failed"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(actions.getSnapshot()[0]?.output).toBe(2);
  expect(actions.getSnapshot()[0]?.refreshError).toBeUndefined();
  actions.dispose();
});

it("keeps an optimistic projection and avoids retry when commit status is unknown", async () => {
  const actions = createActions<string, void>({
    execute: async () => {
      throw new Error("Network lost");
    },
  });

  await actions.run("one", "one");
  const latest = ["one", "two"];
  expect(
    actions.project(latest, {
      mode: "optimistic",
      project: (rows, id) => rows.filter((row) => row !== id),
    }),
  ).toEqual(["two"]);
  expect(await actions.run("one", "one")).toBe(false);
  await actions.resolve("one", "rejected");
  expect(
    actions.project(latest, {
      mode: "optimistic",
      project: (rows, id) => rows.filter((row) => row !== id),
    }),
  ).toEqual(latest);
  actions.dispose();
});
