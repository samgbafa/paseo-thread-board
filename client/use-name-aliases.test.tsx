import { useRpc } from "@getpaseo/plugin/client";
import type { ReactTestRenderer } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_NAME_ALIASES, threadBoardNameAliases } from "../shared/name-aliases";
import { usePersistedNameAliases } from "./use-name-aliases";

vi.mock("@getpaseo/plugin/client", () => ({ useRpc: vi.fn() }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("persisted board names", () => {
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

  it("provides stable defaults", () => {
    expect(threadBoardNameAliases.schema.parse({})).toEqual(DEFAULT_NAME_ALIASES);
  });

  it("loads and atomically saves generated names", async () => {
    read.mockResolvedValue({ status: "ready", revision: "r1", values: DEFAULT_NAME_ALIASES });
    const next = {
      agentNames: { root: "Audit release automation failures" },
      workspaceNames: { release: "Prepare reliable Paseo release" },
    };
    write.mockResolvedValue({ status: "saved", revision: "r2", values: next });
    let latest: ReturnType<typeof usePersistedNameAliases> | undefined;
    function Harness() {
      latest = usePersistedNameAliases();
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest).toMatchObject({ ready: true, aliases: DEFAULT_NAME_ALIASES });

    await act(async () => {
      await latest?.update(next);
    });
    expect(write).toHaveBeenCalledWith({ revision: "r1", values: next });
    expect(latest).toMatchObject({ aliases: next, saving: false, error: null });

    act(() => renderer?.unmount());
  });
});
