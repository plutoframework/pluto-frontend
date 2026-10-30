import { createActions } from "../../src/actions/index.js";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

export class Rejected extends Error {}

/** Synthetic requests demonstrate the contract; no network or API is involved. */
export async function runScenario(report: (line: string) => void) {
  let rows = ["one", "two", "three"];
  const requests = new Map([
    ["one", deferred()],
    ["two", deferred()],
    ["three", deferred()],
  ]);

  const action = createActions<string, void>({
    execute: (id) => requests.get(id)!.promise,
    confirm: (_output, id) => {
      rows = rows.filter((row) => row !== id);
    },
    classifyError: (error) =>
      error instanceof Rejected ? "rejected" : "uncertain",
  });

  const view = () =>
    action.project(rows, {
      mode: "optimistic",
      project: (current, id) => current.filter((row) => row !== id),
    });

  try {
    const first = action.run("one", "one");
    const second = action.run("two", "two");
    report(`pending: ${view().join(", ")}`);
    requests.get("two")!.resolve();
    await second;

    // New canonical data arrives while one remains pending.
    rows = [...rows, "four"];
    requests.get("one")!.reject(new Rejected("Definite server refusal"));
    await first;
    report(`after rejection: ${view().join(", ")}`);

    const third = action.run("three", "three");
    requests
      .get("three")!
      .reject(new Error("Response lost after possible commit"));
    await third;
    report(`uncertain: ${view().join(", ")}`);
    report(`blind retry accepted: ${await action.run("three", "three")}`);

    // A trusted reconciliation establishes that three still exists.
    await action.resolve("three", "rejected");
    report(`after reconciliation: ${view().join(", ")}`);

    return {
      rows,
      visible: view(),
      entries: action.getSnapshot(),
    };
  } finally {
    action.dispose();
  }
}
