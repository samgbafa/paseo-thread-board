import { describe, expect, it } from "vitest";
import {
  type BoardThread,
  countChildren,
  laneOf,
  relativeAge,
  stateLabel,
  visibleThreads,
} from "./board";

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
    lastActivityAt: "2026-09-14T11:00:00.000Z",
    ...overrides,
  };
}

describe("laneOf", () => {
  it("puts permission, error, and finished attention ahead of runtime status", () => {
    expect(laneOf(thread({ status: "running", pendingPermissionCount: 1 }))).toBe("attention");
    expect(laneOf(thread({ status: "error" }))).toBe("attention");
    expect(laneOf(thread({ requiresAttention: true, attentionReason: "finished" }))).toBe(
      "attention",
    );
  });

  it("maps active and terminal states to their lanes", () => {
    expect(laneOf(thread({ status: "initializing" }))).toBe("running");
    expect(laneOf(thread({ status: "running" }))).toBe("running");
    expect(laneOf(thread({ status: "idle" }))).toBe("idle");
    expect(laneOf(thread({ status: "closed", requiresAttention: true }))).toBe("closed");
  });
});

describe("board visibility", () => {
  const threads = [
    thread({ id: "root", lastActivityAt: "2026-09-14T10:00:00.000Z" }),
    thread({
      id: "child",
      parentAgentId: "root",
      status: "running",
      lastActivityAt: "2026-09-14T12:00:00.000Z",
    }),
    thread({ id: "closed", status: "closed", lastActivityAt: "2026-09-14T13:00:00.000Z" }),
  ];

  it("defaults to active top-level threads", () => {
    expect(
      visibleThreads(threads, { includeSubagents: false, showClosed: false }).map(({ id }) => id),
    ).toEqual(["root"]);
  });

  it("can include subagents and closed threads in activity order", () => {
    expect(
      visibleThreads(threads, { includeSubagents: true, showClosed: true }).map(({ id }) => id),
    ).toEqual(["closed", "child", "root"]);
    expect(countChildren(threads).get("root")).toBe(1);
  });
});

describe("labels", () => {
  it("describes the attention reason without relying on color", () => {
    expect(stateLabel(thread({ pendingPermissionCount: 2 }))).toBe("2 permissions requested");
    expect(stateLabel(thread({ attentionReason: "finished", requiresAttention: true }))).toBe(
      "Finished",
    );
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
