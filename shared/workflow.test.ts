import { describe, expect, it } from "vitest";
import type { BoardThread } from "./board";
import {
  applyThreadWorkflow,
  DEFAULT_THREAD_WORKFLOW,
  pauseThreads,
  reconcileThreadWorkflow,
} from "./workflow";

function thread(overrides: Partial<BoardThread> = {}): BoardThread {
  return {
    id: "agent-1",
    title: "Review the release",
    status: "idle",
    requiresAttention: false,
    attentionReason: null,
    attentionTimestamp: null,
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

describe("thread workflow", () => {
  it("keeps a completed turn in Needs You after Paseo clears attention on view", () => {
    const finished = thread({
      requiresAttention: true,
      attentionReason: "finished",
      attentionTimestamp: "2026-09-16T10:00:00.000Z",
    });
    const latched = reconcileThreadWorkflow(DEFAULT_THREAD_WORKFLOW, [finished]);
    const viewed = thread({ updatedAt: "2026-09-16T10:05:00.000Z" });

    expect(applyThreadWorkflow([viewed], latched)[0]).toMatchObject({
      workflowState: "attention",
      workflowAttentionReason: "finished",
    });
  });

  it("keeps the current result paused until later activity occurs", () => {
    const finished = thread({
      requiresAttention: true,
      attentionReason: "finished",
      attentionTimestamp: "2026-09-16T10:00:00.000Z",
    });
    const paused = pauseThreads(DEFAULT_THREAD_WORKFLOW, [finished], "2026-09-16T10:01:00.000Z");

    expect(applyThreadWorkflow([finished], paused)[0].workflowState).toBe("paused");

    const running = thread({
      status: "running",
      lastMessageAt: "2026-09-16T10:10:00.000Z",
    });
    const afterPrompt = reconcileThreadWorkflow(paused, [running]);
    expect(afterPrompt.records[finished.id]).toBeUndefined();
    expect(applyThreadWorkflow([running], afterPrompt)[0].workflowState).toBeNull();
  });

  it("releases Pause when a new completion arrives even if no prompt timestamp changed", () => {
    const original = thread({
      requiresAttention: true,
      attentionReason: "finished",
      attentionTimestamp: "2026-09-16T10:00:00.000Z",
    });
    const paused = pauseThreads(DEFAULT_THREAD_WORKFLOW, [original], "2026-09-16T10:01:00.000Z");
    const nextCompletion = thread({
      requiresAttention: true,
      attentionReason: "error",
      attentionTimestamp: "2026-09-16T10:30:00.000Z",
    });
    const reconciled = reconcileThreadWorkflow(paused, [nextCompletion]);

    expect(reconciled.records[original.id]).toMatchObject({ state: "attention", reason: "error" });
    expect(applyThreadWorkflow([nextCompletion], reconciled)[0]).toMatchObject({
      workflowState: "attention",
      workflowAttentionReason: "error",
    });
  });

  it("recognizes a completion captured while the board was closed without reopening a paused event", () => {
    const cleared = thread();
    const event = { agentId: cleared.id, reason: "finished" as const, marker: "turn-1:event" };
    const restored = reconcileThreadWorkflow(DEFAULT_THREAD_WORKFLOW, [cleared], [event]);
    expect(applyThreadWorkflow([cleared], restored)[0].workflowState).toBe("attention");

    const paused = pauseThreads(restored, [cleared], "2026-09-16T10:01:00.000Z");
    const reconciled = reconcileThreadWorkflow(paused, [cleared], [event]);
    expect(applyThreadWorkflow([cleared], reconciled)[0].workflowState).toBe("paused");
  });
});
