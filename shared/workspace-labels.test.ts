import { describe, expect, it } from "vitest";
import type { BoardThread } from "./board";
import { workspaceLaneAssignments } from "./workspace-labels";

function thread(overrides: Partial<BoardThread> = {}): BoardThread {
  return {
    id: "agent-1",
    title: "Agent",
    status: "running",
    requiresAttention: false,
    attentionReason: null,
    attentionTimestamp: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: "workspace-1",
    projectName: "Paseo",
    workspaceName: "Workspace",
    provider: "codex",
    model: "gpt",
    createdAt: "2026-09-23T00:00:00.000Z",
    updatedAt: "2026-09-23T00:00:00.000Z",
    lastMessageAt: "2026-09-23T00:00:00.000Z",
    workflowState: null,
    workflowAttentionReason: null,
    ...overrides,
  };
}

describe("workspaceLaneAssignments", () => {
  it("rolls multiple tabs up to their most urgent native workspace label", () => {
    expect(
      workspaceLaneAssignments([
        thread({ id: "running" }),
        thread({ id: "attention", requiresAttention: true }),
      ]),
    ).toEqual([{ workspaceId: "workspace-1", lane: "attention" }]);
  });

  it("does not let a subagent create a second assignment for its parent workspace", () => {
    expect(
      workspaceLaneAssignments([
        thread(),
        thread({ id: "child", parentAgentId: "agent-1", requiresAttention: true }),
      ]),
    ).toEqual([{ workspaceId: "workspace-1", lane: "running" }]);
  });
});
