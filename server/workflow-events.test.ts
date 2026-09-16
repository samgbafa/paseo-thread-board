import { describe, expect, it, vi } from "vitest";
import { registerWorkflowEvents } from "./workflow-events";

describe("workflow lifecycle events", () => {
  it("retains lightweight attention updates until a new turn or explicit Pause acknowledges them", async () => {
    const hooks = new Map<string, (event: never, context: never) => void>();
    const handlers = new Map<string, (input: never, context: never) => unknown>();
    const removers = [vi.fn(), vi.fn()];
    const removeAgentUpdates = vi.fn();
    let onAgentUpdate: ((update: never) => void) | undefined;
    const paseo = {
      agents: {
        list: vi.fn(async () => ({ entries: [] })),
        subscribe: vi.fn((handler: (update: never) => void) => {
          onAgentUpdate = handler;
          return removeAgentUpdates;
        }),
      },
    };
    const context = { paseo } as never;
    let removeIndex = 0;
    const server = {
      on: vi.fn((name: string, handler: (event: never, context: never) => void) => {
        hooks.set(name, handler);
        const remove = removers[removeIndex];
        removeIndex += 1;
        return remove;
      }),
      handle: vi.fn(
        (contract: { name: string }, handler: (input: never, context: never) => unknown) => {
          handlers.set(contract.name, handler);
        },
      ),
    };
    const cleanup = registerWorkflowEvents(server as never);
    const agent = {
      id: "agent-1",
      workspaceId: "workspace-1",
      parentAgentId: null,
      provider: "codex",
      cwd: "/repo",
      title: "Review release",
    };

    await handlers.get("thread-board.workflow-events.list")?.({} as never, context);
    expect(paseo.agents.subscribe).toHaveBeenCalledOnce();
    expect(paseo.agents.list).toHaveBeenCalledWith(
      expect.objectContaining({ subscribe: {}, page: { limit: 200 } }),
    );

    onAgentUpdate?.({
      kind: "upsert",
      agent: {
        ...agent,
        status: "idle",
        archivedAt: null,
        requiresAttention: true,
        attentionReason: "finished",
        attentionTimestamp: "2026-09-16T14:30:00.000Z",
      },
    } as never);
    await expect(
      handlers.get("thread-board.workflow-events.list")?.({} as never, context),
    ).resolves.toMatchObject({
      events: [
        {
          agentId: "agent-1",
          reason: "finished",
          marker: "finished:2026-09-16T14:30:00.000Z",
        },
      ],
    });
    expect(paseo.agents.subscribe).toHaveBeenCalledOnce();

    onAgentUpdate?.({
      kind: "upsert",
      agent: {
        ...agent,
        status: "idle",
        archivedAt: null,
        requiresAttention: false,
        attentionReason: null,
        attentionTimestamp: null,
      },
    } as never);
    await expect(
      handlers.get("thread-board.workflow-events.list")?.({} as never, context),
    ).resolves.toMatchObject({ events: [{ agentId: "agent-1", reason: "finished" }] });

    handlers.get("thread-board.workflow-events.acknowledge")?.(
      { agentIds: ["agent-1"] } as never,
      context,
    );
    await expect(
      handlers.get("thread-board.workflow-events.list")?.({} as never, context),
    ).resolves.toEqual({ events: [] });

    onAgentUpdate?.({
      kind: "upsert",
      agent: {
        ...agent,
        status: "error",
        archivedAt: null,
        requiresAttention: true,
        attentionReason: "error",
        attentionTimestamp: "2026-09-16T14:31:00.000Z",
      },
    } as never);
    await hooks.get("agent.turn_started")?.({ agent, turnId: "turn-3" } as never, context);
    await expect(
      handlers.get("thread-board.workflow-events.list")?.({} as never, context),
    ).resolves.toEqual({ events: [] });

    cleanup();
    for (const remove of removers) expect(remove).toHaveBeenCalledOnce();
    expect(removeAgentUpdates).toHaveBeenCalledOnce();
  });
});
