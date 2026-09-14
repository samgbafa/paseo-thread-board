import { describe, expect, it } from "vitest";
import { toBoardThread } from "./use-thread-directory";

function agent(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-1",
    title: "Review the release",
    status: "idle",
    provider: "openai",
    model: "gpt-5",
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
  });

  it("uses creation time when a thread has no sent messages", () => {
    const thread = toBoardThread(agent({ lastUserMessageAt: null }) as never, null);

    expect(thread.lastMessageAt).toBe("2026-09-01T12:00:00.000Z");
  });

  it("uses the provider-native handle to identify tabs of the same underlying thread", () => {
    const thread = toBoardThread(
      agent({
        persistence: {
          provider: "codex",
          sessionId: "paseo-session-1",
          nativeHandle: "codex-thread-1",
        },
      }) as never,
      null,
    );

    expect(thread.providerThreadKey).toBe('["codex","codex-thread-1"]');
  });

  it("falls back to the persistence session id when no native handle is available", () => {
    const thread = toBoardThread(
      agent({ persistence: { provider: "claude", sessionId: "claude-session-1" } }) as never,
      null,
    );

    expect(thread.providerThreadKey).toBe('["claude","claude-session-1"]');
  });
});
