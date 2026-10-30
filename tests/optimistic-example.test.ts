import { expect, it } from "vitest";
import { runScenario } from "../examples/actions/optimistic.js";

it("the runnable example preserves independent changes and reconciles uncertainty", async () => {
  const output: string[] = [];
  const result = await runScenario((line) => output.push(line));
  expect(output).toEqual([
    "pending: three",
    "after rejection: one, three, four",
    "uncertain: one, four",
    "blind retry accepted: false",
    "after reconciliation: one, three, four",
  ]);
  expect(result.rows).toEqual(["one", "three", "four"]);
  expect(result.visible).toEqual(result.rows);
  expect(result.entries.find((entry) => entry.key === "two")?.status).toBe(
    "succeeded",
  );
});
