import { describe, expect, it } from "vitest";
import {
  type BoardThread,
  boardItems,
  countChildren,
  groupThreads,
  isStale,
  laneOf,
  relativeAge,
  stateLabel,
  visibleThreads,
} from "./board";

const NOW = Date.parse("2026-09-14T12:00:00.000Z");

function thread(overrides: Partial<BoardThread> = {}): BoardThread {
  return {
    id: "agent-1",
    title: "Ship the thread board",
    status: "idle",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: null,
    projectName: "Paseo",
    workspaceName: "thread-board",
    provider: "openai",
    model: "gpt-5",
    createdAt: "2026-09-14T10:00:00.000Z",
    updatedAt: "2026-09-14T11:00:00.000Z",
    lastMessageAt: "2026-09-14T11:00:00.000Z",
    ...overrides,
  };
}

describe("laneOf", () => {
  it("puts permission, error, and finished attention ahead of runtime status", () => {
    expect(laneOf(thread({ status: "running", pendingPermissionCount: 1 }), NOW)).toBe("attention");
    expect(laneOf(thread({ status: "error" }), NOW)).toBe("attention");
    expect(laneOf(thread({ requiresAttention: true, attentionReason: "finished" }), NOW)).toBe(
      "attention",
    );
  });

  it("maps fresh runtime states to their lanes", () => {
    expect(laneOf(thread({ status: "initializing" }), NOW)).toBe("running");
    expect(laneOf(thread({ status: "running" }), NOW)).toBe("running");
    expect(laneOf(thread({ status: "idle" }), NOW)).toBe("idle");
    expect(laneOf(thread({ status: "closed" }), NOW)).toBe("idle");
  });

  it("puts every thread without an update for seven days in Stale", () => {
    const stale = thread({
      status: "running",
      requiresAttention: true,
      lastMessageAt: "2026-09-07T12:00:00.000Z",
    });
    expect(isStale(stale, NOW)).toBe(true);
    expect(laneOf(stale, NOW)).toBe("stale");
    expect(
      isStale(
        thread({ lastMessageAt: new Date(NOW - 7 * 24 * 60 * 60 * 1_000 + 1).toISOString() }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe("thread grouping", () => {
  const tabs = [
    thread({
      id: "original-tab",
      title: "Review the release",
      workspaceId: "release-workspace",
      workspaceName: "Release 0.8",
      createdAt: "2026-09-10T08:00:00.000Z",
      status: "idle",
      requiresAttention: false,
      attentionReason: null,
      lastMessageAt: "2026-09-14T09:00:00.000Z",
    }),
    thread({
      id: "urgent-tab",
      title: "Approve the release",
      workspaceId: "release-workspace",
      workspaceName: "Release 0.8",
      createdAt: "2026-09-12T08:00:00.000Z",
      pendingPermissionCount: 1,
      lastMessageAt: "2026-09-14T10:00:00.000Z",
    }),
    thread({
      id: "stale-tab",
      title: "Old release view",
      workspaceId: "release-workspace",
      workspaceName: "Release 0.8",
      createdAt: "2026-09-13T08:00:00.000Z",
      requiresAttention: false,
      attentionReason: null,
      lastMessageAt: "2026-09-01T10:00:00.000Z",
    }),
  ];

  it("rolls a parent thread up to its most urgent tab while retaining the workspace title", () => {
    const [group] = groupThreads(tabs, NOW);

    expect(group.title).toBe("Release 0.8");
    expect(group.lane).toBe("attention");
    expect(group.primaryTab.id).toBe("urgent-tab");
    expect(group.tabs.map(({ id }) => id)).toEqual(["urgent-tab", "original-tab", "stale-tab"]);
  });

  it("groups different provider sessions that are tabs of the same Paseo parent thread", () => {
    const groups = groupThreads(
      [
        thread({ id: "first-tab", workspaceId: "shared-workspace", provider: "claude" }),
        thread({ id: "second-tab", workspaceId: "shared-workspace", provider: "codex" }),
      ],
      NOW,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].tabs).toHaveLength(2);
  });

  it("keeps each tab in its own lane and hides only stale items by default", () => {
    const groups = groupThreads(tabs, NOW);
    const visible = boardItems(groups, { showStale: false, now: NOW });

    expect(visible.map(({ kind, lane, thread }) => [kind, lane, thread.id])).toEqual([
      ["group", "attention", "urgent-tab"],
      ["tab", "attention", "urgent-tab"],
      ["tab", "idle", "original-tab"],
    ]);
    expect(boardItems(groups, { showStale: true, now: NOW }).at(-1)).toMatchObject({
      kind: "tab",
      lane: "stale",
      thread: { id: "stale-tab" },
    });
  });

  it("does not manufacture a parent for tabs without a shared workspace identity", () => {
    const groups = groupThreads([
      thread({ id: "first", workspaceId: null }),
      thread({ id: "second", workspaceId: null }),
    ]);

    expect(groups).toHaveLength(2);
    expect(boardItems(groups, { showStale: true }).map(({ kind }) => kind)).toEqual([
      "thread",
      "thread",
    ]);
  });

  it("keeps subagents separate from their workspace's tab group", () => {
    const groups = groupThreads([
      thread({ id: "first-tab", workspaceId: "shared-workspace" }),
      thread({ id: "second-tab", workspaceId: "shared-workspace" }),
      thread({ id: "subagent", workspaceId: "shared-workspace", parentAgentId: "first-tab" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.find(({ id }) => id === "workspace:shared-workspace")?.tabs).toHaveLength(2);
    expect(groups.find(({ id }) => id === "agent:subagent")?.tabs).toHaveLength(1);
  });
});

describe("board visibility", () => {
  const threads = [
    thread({ id: "root", lastMessageAt: "2026-09-14T10:00:00.000Z" }),
    thread({
      id: "child",
      parentAgentId: "root",
      status: "running",
      lastMessageAt: "2026-09-14T12:00:00.000Z",
    }),
    thread({ id: "stale", status: "closed", lastMessageAt: "2026-09-01T13:00:00.000Z" }),
  ];

  it("defaults to active top-level threads", () => {
    expect(
      visibleThreads(threads, { includeSubagents: false, showStale: false, now: NOW }).map(
        ({ id }) => id,
      ),
    ).toEqual(["root"]);
  });

  it("can include subagents and stale threads in activity order", () => {
    expect(
      visibleThreads(threads, { includeSubagents: true, showStale: true, now: NOW }).map(
        ({ id }) => id,
      ),
    ).toEqual(["child", "root", "stale"]);
    expect(countChildren(threads).get("root")).toBe(1);
  });
});

describe("labels", () => {
  it("describes the attention reason without relying on color", () => {
    expect(stateLabel(thread({ pendingPermissionCount: 2 }), NOW)).toBe("2 permissions requested");
    expect(stateLabel(thread({ attentionReason: "finished", requiresAttention: true }), NOW)).toBe(
      "Finished",
    );
    expect(stateLabel(thread({ status: "closed" }), NOW)).toBe("Stopped");
  });

  it("formats compact relative age", () => {
    expect(relativeAge("2026-09-14T11:59:40.000Z", Date.parse("2026-09-14T12:00:00.000Z"))).toBe(
      "now",
    );
    expect(relativeAge("2026-09-14T10:00:00.000Z", Date.parse("2026-09-14T12:00:00.000Z"))).toBe(
      "2h",
    );
  });
});
