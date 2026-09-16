import { describe, expect, it, vi } from "vitest";
import { registerWorkflowEvents } from "./workflow-events";

describe("workflow lifecycle events", () => {
  it("retains completions until a new turn or explicit Pause acknowledges them", async () => {
    const hooks = new Map<string, (event: never) => void>();
    const handlers = new Map<string, (input: never) => unknown>();
    const removers = [vi.fn(), vi.fn(), vi.fn()];
    let removeIndex = 0;
    const server = {
      on: vi.fn((name: string, handler: (event: never) => void) => {
        hooks.set(name, handler);
        const remove = removers[removeIndex];
        removeIndex += 1;
        return remove;
      }),
      handle: vi.fn((contract: { name: string }, handler: (input: never) => unknown) => {
        handlers.set(contract.name, handler);
      }),
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

    hooks.get("agent.turn_ended")?.({
      agent,
      turnId: "turn-1",
      outcome: { kind: "completed" },
      timeline: [],
    } as never);
    expect(handlers.get("thread-board.workflow-events.list")?.({} as never)).toMatchObject({
      events: [
        { agentId: "agent-1", reason: "finished", marker: expect.stringContaining("turn-1") },
      ],
    });

    handlers.get("thread-board.workflow-events.acknowledge")?.({ agentIds: ["agent-1"] } as never);
    expect(handlers.get("thread-board.workflow-events.list")?.({} as never)).toEqual({
      events: [],
    });

    hooks.get("agent.turn_ended")?.({
      agent,
      turnId: "turn-2",
      outcome: { kind: "failed", error: { message: "Build failed" } },
      timeline: [],
    } as never);
    hooks.get("agent.turn_started")?.({ agent, turnId: "turn-3" } as never);
    expect(handlers.get("thread-board.workflow-events.list")?.({} as never)).toEqual({
      events: [],
    });

    cleanup();
    for (const remove of removers) expect(remove).toHaveBeenCalledOnce();
  });
});
