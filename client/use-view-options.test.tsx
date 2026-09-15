import { useRpc } from "@getpaseo/plugin/client";
import type { ReactTestRenderer } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_VIEW_OPTIONS, threadBoardViewOptions } from "../shared/view-options";
import { usePersistedViewOptions } from "./use-view-options";

vi.mock("@getpaseo/plugin/client", () => ({ useRpc: vi.fn() }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("persisted view options", () => {
  const read = vi.fn();
  const write = vi.fn();

  beforeEach(() => {
    read.mockReset();
    write.mockReset();
    vi.mocked(useRpc).mockImplementation((contract) => {
      const name = (contract as { name: string }).name;
      return (name.endsWith(".read") ? read : write) as never;
    });
  });

  it("provides stable defaults for a host with no saved preferences", () => {
    expect(threadBoardViewOptions.schema.parse({})).toEqual(DEFAULT_VIEW_OPTIONS);
  });

  it("loads saved options and writes the next complete preference document", async () => {
    read.mockResolvedValue({
      status: "ready",
      revision: "revision-1",
      values: { viewMode: "list", includeSubagents: true, showStale: true },
    });
    write.mockResolvedValue({
      status: "saved",
      revision: "revision-2",
      values: { viewMode: "kanban", includeSubagents: false, showStale: true },
    });

    let latest: ReturnType<typeof usePersistedViewOptions> | undefined;
    function Harness() {
      latest = usePersistedViewOptions();
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest).toMatchObject({
      ready: true,
      options: { viewMode: "list", includeSubagents: true, showStale: true },
    });

    await act(async () => {
      latest?.update({ viewMode: "kanban", includeSubagents: false, showStale: true });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(write).toHaveBeenCalledWith({
      revision: "revision-1",
      values: { viewMode: "kanban", includeSubagents: false, showStale: true },
    });
    expect(latest?.saving).toBe(false);
    expect(latest?.error).toBeNull();

    act(() => renderer?.unmount());
  });

  it("surfaces a load failure and recovers when the user retries", async () => {
    read.mockRejectedValueOnce(new Error("Host unavailable.")).mockResolvedValueOnce({
      status: "ready",
      revision: "revision-1",
      values: DEFAULT_VIEW_OPTIONS,
    });

    let latest: ReturnType<typeof usePersistedViewOptions> | undefined;
    function Harness() {
      latest = usePersistedViewOptions();
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest).toMatchObject({ ready: false, errorKind: "load", error: "Host unavailable." });

    await act(async () => {
      await latest?.reload();
    });

    expect(latest).toMatchObject({ ready: true, errorKind: null, error: null });
    expect(read).toHaveBeenCalledTimes(2);

    act(() => renderer?.unmount());
  });
});
