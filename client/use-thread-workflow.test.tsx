import { useRpc } from "@getpaseo/plugin/client";
import type { ReactTestRenderer } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardThread } from "../shared/board";
import { useThreadWorkflow } from "./use-thread-workflow";

vi.mock("@getpaseo/plugin/client", () => ({ useRpc: vi.fn() }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function thread(overrides: Partial<BoardThread> = {}): BoardThread {
  return {
    id: "agent-1",
    title: "Review the release",
    status: "idle",
    requiresAttention: true,
    attentionReason: "finished",
    attentionTimestamp: "2026-09-16T10:00:00.000Z",
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: "workspace-1",
    projectName: "Paseo",
    workspaceName: "Release 0.8",
    provider: "openai",
    model: "gpt-6",
    createdAt: "2026-09-16T08:00:00.000Z",
    updatedAt: "2026-09-16T10:00:00.000Z",
    lastMessageAt: "2026-09-16T09:00:00.000Z",
    workflowState: null,
    workflowAttentionReason: null,
    ...overrides,
  };
}

describe("persisted thread workflow", () => {
  const read = vi.fn();
  const write = vi.fn();
  const listEvents = vi.fn();
  const acknowledgeEvents = vi.fn();

  beforeEach(() => {
    read.mockReset();
    write.mockReset();
    listEvents.mockReset();
    acknowledgeEvents.mockReset();
    vi.mocked(useRpc).mockImplementation((contract) => {
      const name = (contract as { name: string }).name;
      if (name.endsWith(".read")) return read as never;
      if (name.endsWith("workflow-events.list")) return listEvents as never;
      if (name.endsWith("workflow-events.acknowledge")) return acknowledgeEvents as never;
      return write as never;
    });
  });

  it("persists attention before view clears it, pauses it, and releases it on a new prompt", async () => {
    let revision = 1;
    read.mockResolvedValue({ status: "ready", revision: `revision-${revision}`, values: {} });
    listEvents.mockResolvedValue({ events: [] });
    acknowledgeEvents.mockResolvedValue({});
    write.mockImplementation(async ({ values }) => {
      revision += 1;
      return { status: "saved", revision: `revision-${revision}`, values };
    });

    let latest: ReturnType<typeof useThreadWorkflow> | undefined;
    function Harness({ threads }: { threads: readonly BoardThread[] }) {
      latest = useThreadWorkflow(threads);
      return null;
    }

    const finished = thread();
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<Harness threads={[finished]} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(write).toHaveBeenCalledWith({
      revision: "revision-1",
      values: {
        records: {
          "agent-1": expect.objectContaining({ state: "attention", reason: "finished" }),
        },
      },
    });

    const viewed = thread({
      requiresAttention: false,
      attentionReason: null,
      attentionTimestamp: null,
      updatedAt: "2026-09-16T10:05:00.000Z",
    });
    await act(async () => {
      renderer?.update(<Harness threads={[viewed]} />);
      await Promise.resolve();
    });
    expect(latest?.threads[0].workflowState).toBe("attention");

    await act(async () => {
      latest?.pause(latest.threads);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest?.threads[0].workflowState).toBe("paused");

    const running = thread({
      status: "running",
      requiresAttention: false,
      attentionReason: null,
      attentionTimestamp: null,
      lastMessageAt: "2026-09-16T10:10:00.000Z",
    });
    await act(async () => {
      renderer?.update(<Harness threads={[running]} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest?.threads[0]).toMatchObject({ status: "running", workflowState: null });

    act(() => renderer?.unmount());
  });

  it("restores a missed completion captured while the board was closed", async () => {
    read.mockResolvedValue({ status: "ready", revision: "revision-1", values: {} });
    listEvents.mockResolvedValue({
      events: [{ agentId: "agent-1", reason: "finished", marker: "turn-1:finished:event" }],
    });
    acknowledgeEvents.mockResolvedValue({});
    write.mockImplementation(async ({ values }) => ({
      status: "saved",
      revision: "revision-2",
      values,
    }));

    let latest: ReturnType<typeof useThreadWorkflow> | undefined;
    function Harness() {
      latest = useThreadWorkflow([
        thread({ requiresAttention: false, attentionReason: null, attentionTimestamp: null }),
      ]);
      return null;
    }

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest?.threads[0]).toMatchObject({
      workflowState: "attention",
      workflowAttentionReason: "finished",
    });
    expect(write).toHaveBeenCalledWith({
      revision: "revision-1",
      values: {
        records: {
          "agent-1": expect.objectContaining({
            state: "attention",
            attentionMarkers: ["turn-1:finished:event"],
          }),
        },
      },
    });

    act(() => renderer?.unmount());
  });
});
