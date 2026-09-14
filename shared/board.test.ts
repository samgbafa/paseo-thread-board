import { describe, expect, it } from "vitest";
import {
  type BoardThread,
  countChildren,
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
    projectName: "Paseo",
    workspaceName: "thread-board",
    provider: "openai",
    model: "gpt-5",
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
