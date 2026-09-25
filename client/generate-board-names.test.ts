import { describe, expect, it, vi } from "vitest";
import { PARENT_AGENT_ID_LABEL } from "../shared/board";
import type { BoardNameTarget } from "../shared/naming";
import { LUNA_NAMING_PROVIDER } from "../shared/naming";
import { generateBoardNames } from "./generate-board-names";

const target: BoardNameTarget = {
  key: "agent:root",
  kind: "thread",
  entityId: "root",
  currentName: "Please inspect all release automation failures",
  sourceName: "Please inspect all release automation failures",
  projectName: "Paseo",
  workspaceName: "Release work",
  siblingNames: [],
  seedAgentId: "root",
};

describe("Luna naming agent", () => {
  it("runs as a temporary child agent and archives it after returning names", async () => {
    const archive = vi.fn(async () => ({ archivedAt: "2026-09-17T12:00:00.000Z" }));
    const run = vi.fn(async () => ({
      status: "idle" as const,
      final: null,
      error: null,
      lastMessage: '{"names":[{"key":"agent:root","name":"Audit release automation failures"}]}',
    }));
    const helper = { run, archive };
    const seed = {
      refresh: vi.fn(async () => ({ agent: { cwd: "/workspace/paseo" }, project: null })),
    };
    const paseo = {
      agents: {
        ref: vi.fn(() => seed),
        create: vi.fn(async () => helper),
      },
    };

    await expect(generateBoardNames(paseo as never, [target])).resolves.toEqual([
      { key: "agent:root", name: "Audit release automation failures" },
    ]);
    expect(paseo.agents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: "/workspace/paseo",
        title: "Name Thread Board threads",
        config: { provider: LUNA_NAMING_PROVIDER, thinkingOptionId: "low" },
        labels: {
          "thread-board.role": "naming-helper",
          [PARENT_AGENT_ID_LABEL]: "root",
        },
      }),
    );
    // The daemon rejects `parent` unless the seed agent is loaded, and board
    // threads are often dormant, so the helper links through its label only.
    expect(paseo.agents.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ parent: expect.anything() }),
    );
    expect(run).toHaveBeenCalledWith(expect.stringContaining("Rename every Thread Board item"), {
      timeoutMs: 180_000,
    });
    expect(archive).toHaveBeenCalledOnce();
  });

  it("archives the helper when Luna fails", async () => {
    const archive = vi.fn(async () => ({ archivedAt: "2026-09-17T12:00:00.000Z" }));
    const paseo = {
      agents: {
        ref: vi.fn(() => ({
          refresh: vi.fn(async () => ({ agent: { cwd: "/workspace/paseo" }, project: null })),
        })),
        create: vi.fn(async () => ({
          run: vi.fn(async () => ({
            status: "error" as const,
            final: null,
            error: "Provider unavailable.",
            lastMessage: null,
          })),
          archive,
        })),
      },
    };

    await expect(generateBoardNames(paseo as never, [target])).rejects.toThrow(
      "Luna could not finish naming the board. Provider unavailable.",
    );
    expect(archive).toHaveBeenCalledOnce();
  });
});
