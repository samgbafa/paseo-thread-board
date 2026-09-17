import { describe, expect, it } from "vitest";
import type { BoardThread } from "./board";
import { DEFAULT_NAME_ALIASES } from "./name-aliases";
import {
  applyNameAliases,
  collectNameTargets,
  mergeNameSuggestions,
  namingPrompt,
  parseNameSuggestions,
} from "./naming";

function thread(overrides: Partial<BoardThread> = {}): BoardThread {
  return {
    id: "root",
    title: "Please inspect all release automation failures",
    status: "idle",
    requiresAttention: true,
    attentionReason: "finished",
    attentionTimestamp: "2026-09-17T10:00:00.000Z",
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: "release",
    projectName: "Paseo",
    workspaceName: "Release work",
    provider: "codex",
    model: "gpt-5.6-sol",
    createdAt: "2026-09-17T10:00:00.000Z",
    updatedAt: "2026-09-17T10:00:00.000Z",
    lastMessageAt: "2026-09-17T10:00:00.000Z",
    workflowState: null,
    workflowAttentionReason: "finished",
    ...overrides,
  };
}

describe("Luna board naming", () => {
  it("targets every top-level tab and one parent for a grouped workspace", () => {
    const threads = [
      thread(),
      thread({
        id: "notes",
        title: "Could you write notes for the release",
        createdAt: "2026-09-17T11:00:00.000Z",
      }),
      thread({ id: "child", title: "Check CI", parentAgentId: "root" }),
      thread({
        id: "solo",
        title: "Investigate auth timeout",
        workspaceId: null,
        createdAt: "2026-09-17T12:00:00.000Z",
      }),
    ];
    const targets = collectNameTargets(threads, {
      agentNames: { root: "Audit release automation failures" },
      workspaceNames: { release: "Prepare reliable Paseo release" },
    });

    expect(targets.map((target) => target.key)).toEqual([
      "workspace:release",
      "agent:root",
      "agent:notes",
      "agent:solo",
    ]);
    expect(targets[0]).toMatchObject({
      kind: "workspace",
      currentName: "Prepare reliable Paseo release",
      siblingNames: [
        "Please inspect all release automation failures",
        "Could you write notes for the release",
      ],
    });
    expect(targets[1]).toMatchObject({
      kind: "thread",
      currentName: "Audit release automation failures",
      siblingNames: ["Could you write notes for the release"],
    });
  });

  it("parses exactly one clean name per requested key", () => {
    const targets = collectNameTargets([thread()], DEFAULT_NAME_ALIASES);
    expect(
      parseNameSuggestions(
        '```json\n{"names":[{"key":"agent:root","name":"  Audit release automation failures  "}]}\n```',
        targets,
      ),
    ).toEqual([{ key: "agent:root", name: "Audit release automation failures" }]);
    expect(() => parseNameSuggestions('{"names":[]}', targets)).toThrow("Luna missed 1 item");
  });

  it("accepts Luna's complete key-to-name response shape", () => {
    const targets = collectNameTargets([thread()], DEFAULT_NAME_ALIASES);
    expect(
      parseNameSuggestions('{"agent:root":"Audit release automation failures"}', targets),
    ).toEqual([{ key: "agent:root", name: "Audit release automation failures" }]);
  });

  it("applies and persists agent and grouped-parent aliases independently", () => {
    const threads = [thread(), thread({ id: "notes", title: "Write the notes" })];
    const targets = collectNameTargets(threads, DEFAULT_NAME_ALIASES);
    const aliases = mergeNameSuggestions(DEFAULT_NAME_ALIASES, targets, [
      { key: "workspace:release", name: "Prepare reliable Paseo release" },
      { key: "agent:root", name: "Audit release automation failures" },
      { key: "agent:notes", name: "Draft concise release notes" },
    ]);

    expect(applyNameAliases(threads, aliases)).toEqual([
      expect.objectContaining({
        id: "root",
        title: "Audit release automation failures",
        workspaceName: "Prepare reliable Paseo release",
      }),
      expect.objectContaining({
        id: "notes",
        title: "Draft concise release notes",
        workspaceName: "Prepare reliable Paseo release",
      }),
    ]);
    expect(namingPrompt(targets)).toContain("grouped thread parent");
    expect(namingPrompt(targets)).toContain("Keep sibling tabs distinct");
  });
});
