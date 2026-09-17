import type { BoardThread } from "./board";
import type { ThreadBoardNameAliases } from "./name-aliases";

export const LUNA_NAMING_PROVIDER = "codex/gpt-5.6-luna";
export const MAX_GENERATED_NAME_LENGTH = 80;

export interface BoardNameTarget {
  key: string;
  kind: "thread" | "workspace";
  entityId: string;
  currentName: string;
  sourceName: string;
  projectName: string;
  workspaceName: string | null;
  siblingNames: readonly string[];
  seedAgentId: string;
}

export interface BoardNameSuggestion {
  key: string;
  name: string;
}

export const BOARD_NAMES_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["names"],
  properties: {
    names: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "name"],
        properties: {
          key: { type: "string" },
          name: { type: "string", minLength: 1, maxLength: MAX_GENERATED_NAME_LENGTH },
        },
      },
    },
  },
} as const;

function compareThreads(left: BoardThread, right: BoardThread): number {
  return (
    Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id)
  );
}

export function collectNameTargets(
  threads: readonly BoardThread[],
  aliases: ThreadBoardNameAliases,
): BoardNameTarget[] {
  const topLevel = threads.filter((thread) => thread.parentAgentId === null).sort(compareThreads);
  const workspaceTabs = new Map<string, BoardThread[]>();
  for (const thread of topLevel) {
    if (!thread.workspaceId) continue;
    const tabs = workspaceTabs.get(thread.workspaceId);
    if (tabs) tabs.push(thread);
    else workspaceTabs.set(thread.workspaceId, [thread]);
  }

  const targets: BoardNameTarget[] = [];
  const emittedWorkspaces = new Set<string>();
  for (const thread of topLevel) {
    const workspaceId = thread.workspaceId;
    const siblings = workspaceId ? (workspaceTabs.get(workspaceId) ?? []) : [];
    if (workspaceId && siblings.length > 1 && !emittedWorkspaces.has(workspaceId)) {
      emittedWorkspaces.add(workspaceId);
      const sourceName = thread.workspaceName?.trim() || thread.projectName;
      targets.push({
        key: `workspace:${workspaceId}`,
        kind: "workspace",
        entityId: workspaceId,
        currentName: aliases.workspaceNames[workspaceId] ?? sourceName,
        sourceName,
        projectName: thread.projectName,
        workspaceName: thread.workspaceName,
        siblingNames: siblings.map((sibling) => sibling.title),
        seedAgentId: thread.id,
      });
    }

    targets.push({
      key: `agent:${thread.id}`,
      kind: "thread",
      entityId: thread.id,
      currentName: aliases.agentNames[thread.id] ?? thread.title,
      sourceName: thread.title,
      projectName: thread.projectName,
      workspaceName: thread.workspaceName,
      siblingNames: siblings
        .filter((sibling) => sibling.id !== thread.id)
        .map((sibling) => sibling.title),
      seedAgentId: thread.id,
    });
  }
  return targets;
}

export function applyNameAliases(
  threads: readonly BoardThread[],
  aliases: ThreadBoardNameAliases,
): BoardThread[] {
  return threads.map((thread) => ({
    ...thread,
    title: aliases.agentNames[thread.id] ?? thread.title,
    workspaceName:
      thread.workspaceId && aliases.workspaceNames[thread.workspaceId]
        ? aliases.workspaceNames[thread.workspaceId]
        : thread.workspaceName,
  }));
}

export function mergeNameSuggestions(
  aliases: ThreadBoardNameAliases,
  targets: readonly BoardNameTarget[],
  suggestions: readonly BoardNameSuggestion[],
): ThreadBoardNameAliases {
  const targetByKey = new Map(targets.map((target) => [target.key, target]));
  const agentNames = { ...aliases.agentNames };
  const workspaceNames = { ...aliases.workspaceNames };
  for (const suggestion of suggestions) {
    const target = targetByKey.get(suggestion.key);
    if (!target) continue;
    if (target.kind === "workspace") workspaceNames[target.entityId] = suggestion.name;
    else agentNames[target.entityId] = suggestion.name;
  }
  return { agentNames, workspaceNames };
}

export function namingPrompt(targets: readonly BoardNameTarget[]): string {
  const entries = targets.map((target) => ({
    key: target.key,
    type: target.kind === "workspace" ? "grouped thread parent" : "thread tab",
    currentName: target.currentName,
    originalName: target.sourceName,
    project: target.projectName,
    workspace: target.workspaceName,
    siblingTabs: target.siblingNames,
  }));
  return [
    "Rename every Thread Board item below.",
    "Return exactly one name for every key and no extra keys.",
    "Use a concise, specific, sentence-case name of 4–8 words that clearly says what is happening.",
    "Keep sibling tabs distinct. Name grouped parents for their shared outcome, not for one tab.",
    "Do not prefix names with a provider, model, project, the words thread/tab/parent, or a status.",
    "Do not use quotation marks or terminal punctuation.",
    JSON.stringify(entries),
  ].join("\n");
}

function cleanJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ?? trimmed;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "")
    .replace(/\s+/g, " ");
  if (!name || name.length > MAX_GENERATED_NAME_LENGTH) return null;
  return name;
}

export function parseNameSuggestions(
  raw: string,
  targets: readonly BoardNameTarget[],
): BoardNameSuggestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch {
    throw new Error("Luna returned an unreadable naming response. Try again.");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { names?: unknown }).names)
  ) {
    throw new Error("Luna returned an incomplete naming response. Try again.");
  }

  const expected = new Set(targets.map((target) => target.key));
  const byKey = new Map<string, string>();
  for (const item of (parsed as { names: unknown[] }).names) {
    if (!item || typeof item !== "object") continue;
    const { key, name: rawName } = item as { key?: unknown; name?: unknown };
    if (typeof key !== "string" || !expected.has(key) || byKey.has(key)) continue;
    const name = cleanName(rawName);
    if (name) byKey.set(key, name);
  }

  const missing = targets.filter((target) => !byKey.has(target.key));
  if (missing.length > 0) {
    throw new Error(
      `Luna missed ${missing.length} ${missing.length === 1 ? "item" : "items"}. Try again.`,
    );
  }
  return targets.map((target) => ({ key: target.key, name: byKey.get(target.key) as string }));
}
