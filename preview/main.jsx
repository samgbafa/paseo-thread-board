import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThreadBoardView } from "../client/thread-board";
import { DEFAULT_NAME_ALIASES } from "../shared/name-aliases";
import { applyNameAliases, collectNameTargets, mergeNameSuggestions } from "../shared/naming";

const now = new Date();
const ago = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString();

const initialThreads = [
  {
    id: "release-review",
    title: "Tell me about this TinyCloud update using celld",
    status: "idle",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: "workspace-release",
    projectName: "tinycloud-dev",
    workspaceName: "Design TinyCloud 2.0 with celld",
    provider: "openai",
    model: "gpt-6-astra",
    createdAt: ago(2 * 24 * 60),
    updatedAt: ago(26),
    lastMessageAt: ago(26),
  },
  {
    id: "release-context",
    title: "I am curious about a TinyCloud document sync",
    status: "idle",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: "workspace-release",
    projectName: "tinycloud-dev",
    workspaceName: "Design TinyCloud 2.0 with celld",
    provider: "anthropic",
    model: "claude-fable-5",
    createdAt: ago(23 * 24 * 60),
    updatedAt: ago(21 * 24 * 60),
    lastMessageAt: ago(21 * 24 * 60),
  },
  {
    id: "release-history",
    title: "https://celld.dev/",
    status: "idle",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: "workspace-release",
    projectName: "tinycloud-dev",
    workspaceName: "Design TinyCloud 2.0 with celld",
    provider: "anthropic",
    model: "claude-fable-5",
    createdAt: ago(24 * 24 * 60),
    updatedAt: ago(22 * 24 * 60),
    lastMessageAt: ago(22 * 24 * 60),
  },
  {
    id: "migration",
    title: "Resolve workspace migration test failure",
    status: "error",
    requiresAttention: true,
    attentionReason: "error",
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: "workspace-migration",
    projectName: "TinyCloud CLI",
    workspaceName: "migration-hardening",
    provider: "anthropic",
    model: "claude-opus-5",
    createdAt: ago(90),
    updatedAt: ago(18),
    lastMessageAt: ago(18),
  },
  {
    id: "thread-board",
    title: "Build a live Kanban for Paseo threads",
    status: "running",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: "workspace-thread-board",
    projectName: "Paseo Plugins",
    workspaceName: "thread-board",
    provider: "openai",
    model: "gpt-5.6-codex",
    createdAt: ago(45),
    updatedAt: ago(1),
    lastMessageAt: ago(1),
  },
  {
    id: "docs",
    title: "Refresh plugin API documentation examples",
    status: "running",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: "workspace-plugin-docs",
    projectName: "Paseo",
    workspaceName: "plugin-docs",
    provider: "anthropic",
    model: "claude-sonnet-4.5",
    createdAt: ago(60),
    updatedAt: ago(7),
    lastMessageAt: ago(7),
  },
  {
    id: "visual-check",
    title: "Check compact and expanded board layouts",
    status: "running",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: "thread-board",
    workspaceId: "workspace-thread-board",
    projectName: "Paseo Plugins",
    workspaceName: "thread-board",
    provider: "openai",
    model: "gpt-5.6-codex",
    createdAt: ago(30),
    updatedAt: ago(2),
    lastMessageAt: ago(2),
  },
  {
    id: "sdk-audit",
    title: "Audit SDK dependency update",
    status: "idle",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: "workspace-sdk-audit",
    projectName: "TinyCloud SDK",
    workspaceName: "dependency-audit",
    provider: "openai",
    model: "gpt-5.5",
    createdAt: ago(4 * 24 * 60),
    updatedAt: ago(74),
    lastMessageAt: ago(74),
  },
  {
    id: "observability",
    title: "Trace terminal reconnect metrics",
    status: "idle",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: "workspace-observability",
    projectName: "Paseo",
    workspaceName: "terminal-observability",
    provider: "anthropic",
    model: "claude-sonnet-4.5",
    createdAt: ago(5 * 24 * 60),
    updatedAt: ago(240),
    lastMessageAt: ago(240),
  },
  {
    id: "stale",
    title: "Archive completed prototype after review",
    status: "idle",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: "workspace-activity-prototype",
    projectName: "Paseo Plugins",
    workspaceName: "activity-prototype",
    provider: "openai",
    model: "gpt-5.5",
    createdAt: ago(9 * 24 * 60),
    updatedAt: ago(1),
    lastMessageAt: ago(8 * 24 * 60),
  },
].map((thread) => ({
  ...thread,
  attentionTimestamp: thread.requiresAttention ? thread.updatedAt : null,
  workflowState: null,
  workflowAttentionReason: null,
}));

const theme = {
  colors: {
    surface0: "#111317",
    surface1: "#171a20",
    surface2: "#242832",
    border: "#303641",
    foreground: "#f2f4f7",
    foregroundMuted: "#9ca4b3",
    accent: "#75a7ff",
    accentForeground: "#0b111d",
    statusSuccess: "#5cc98b",
    statusWarning: "#f0b85b",
    statusDanger: "#ef6b73",
  },
};

function Preview() {
  const [compact, setCompact] = useState(window.innerWidth < 720);
  const [threads, setThreads] = useState(initialThreads);
  const [aliases, setAliases] = useState(DEFAULT_NAME_ALIASES);
  const renameTargets = collectNameTargets(threads, aliases);
  const namedThreads = applyNameAliases(threads, aliases);

  useEffect(() => {
    const update = () => setCompact(window.innerWidth < 720);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <ThreadBoardView
      theme={theme}
      layout={{ compact, platform: "web" }}
      host={{ id: "preview", label: "Sam's host" }}
      navigation={{
        openAgent: ({ agentId }) => window.alert(`Open ${agentId}`),
        openWorkspace: () => undefined,
      }}
      threads={namedThreads}
      status="ready"
      error={null}
      refreshing={false}
      onRefresh={() => undefined}
      onArchive={async (threadId) => {
        setThreads((current) => current.filter((thread) => thread.id !== threadId));
      }}
      onPause={(pausedThreads) => {
        const pausedIds = new Set(pausedThreads.map((thread) => thread.id));
        setThreads((current) =>
          current.map((thread) =>
            pausedIds.has(thread.id)
              ? {
                  ...thread,
                  workflowState: "paused",
                  workflowAttentionReason: null,
                }
              : thread,
          ),
        );
      }}
      renameTargets={renameTargets}
      savedNameCount={
        Object.keys(aliases.agentNames).length + Object.keys(aliases.workspaceNames).length
      }
      onGenerateNames={async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        return renameTargets.map((target) => ({
          key: target.key,
          name:
            target.kind === "workspace"
              ? "Shape TinyCloud document synchronization"
              : target.sourceName
                  .replace(/^Tell me about this /i, "Explain ")
                  .replace(/^I am curious about a /i, "Explore ")
                  .replace(/^https:\/\//i, "Review ")
                  .slice(0, 80),
        }));
      }}
      onApplyNames={async (suggestions) => {
        setAliases((current) => mergeNameSuggestions(current, renameTargets, suggestions));
      }}
      onRestoreNames={async () => setAliases(DEFAULT_NAME_ALIASES)}
    />
  );
}

createRoot(document.getElementById("root")).render(<Preview />);
