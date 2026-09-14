import { describe, expect, it } from "vitest";
import { toBoardThread } from "./use-thread-directory";

function agent(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-1",
    title: "Review the release",
    status: "idle",
    provider: "openai",
    model: "gpt-5",
    workspaceId: "workspace-1",
    labels: {},
    pendingPermissions: [],
    requiresAttention: false,
    attentionReason: null,
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-14T12:00:00.000Z",
    lastUserMessageAt: "2026-09-05T12:00:00.000Z",
    persistence: null,
    ...overrides,
  };
}

describe("thread directory projection", () => {
  it("uses the last sent message even when viewing changed the agent update time", () => {
    const thread = toBoardThread(agent() as never, null);

    expect(thread.updatedAt).toBe("2026-09-14T12:00:00.000Z");
    expect(thread.lastMessageAt).toBe("2026-09-05T12:00:00.000Z");
    expect(thread.workspaceId).toBe("workspace-1");
  });

  it("uses creation time when a thread has no sent messages", () => {
    const thread = toBoardThread(agent({ lastUserMessageAt: null }) as never, null);

    expect(thread.lastMessageAt).toBe("2026-09-01T12:00:00.000Z");
  });

  it("retains a known workspace identity when a partial live snapshot omits it", () => {
    const existing = toBoardThread(agent() as never, null);
    const thread = toBoardThread(agent({ workspaceId: undefined }) as never, null, existing);

    expect(thread.workspaceId).toBe("workspace-1");
  });
});
