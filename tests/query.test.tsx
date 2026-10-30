// @vitest-environment jsdom
import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useActionMutation } from "../src/query/index.js";

afterEach(cleanup);

it("shows immediate scoped feedback and prevents old-scope cache writes under StrictMode", async () => {
  const client = new QueryClient();
  const finish: Array<(value: string) => void> = [];
  const confirm = vi.fn();
  const execute = vi.fn(
    () => new Promise<string>((resolve) => finish.push(resolve)),
  );

  function View({ scope }: { scope: string }) {
    const action = useActionMutation({
      scope,
      execute,
      confirm,
    });

    const entry = action.entries[0];

    return (
      <>
        <button
          disabled={!action.ready || entry?.status === "pending"}
          onClick={() => {
            void action.run("one", "input");
          }}
        >
          Save
        </button>
        <span role="status">{entry?.status ?? "idle"}</span>
      </>
    );
  }

  function App({ scope }: { scope: string }) {
    return (
      <StrictMode>
        <QueryClientProvider client={client}>
          <View scope={scope} />
        </QueryClientProvider>
      </StrictMode>
    );
  }

  const view = render(<App scope="tenant-one" />);
  expect(execute).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("status").textContent).toBe("pending");
  fireEvent.click(screen.getByRole("button"));
  expect(execute).toHaveBeenCalledOnce();
  view.rerender(<App scope="tenant-two" />);
  expect(screen.getByRole("status").textContent).toBe("idle");
  await act(async () => {
    finish[0]!("old result");
  });
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button"));
  await act(async () => {
    finish[1]!("new result");
  });
  expect(confirm).toHaveBeenCalledWith("new result", "input", client);
  expect(screen.getByRole("status").textContent).toBe("succeeded");
  client.clear();
});

it("keeps command identities stable across same-scope renders", async () => {
  const { renderHook } = await import("@testing-library/react");
  const client = new QueryClient();
  const wrapper = ({ children }: { children: import("react").ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  const { result, rerender, unmount } = renderHook(
    () =>
      useActionMutation({
        scope: "one",
        execute: async (input: string) => input,
      }),
    { wrapper },
  );

  const run = result.current.run;
  const get = result.current.get;
  rerender();
  expect(result.current.run).toBe(run);
  expect(result.current.get).toBe(get);
  await act(async () => {
    await run("record", "saved");
  });
  expect(result.current.run).toBe(run);
  expect(get("record")?.output).toBe("saved");
  unmount();
  client.clear();
});
