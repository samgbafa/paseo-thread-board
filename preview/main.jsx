import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThreadBoardView } from "../client/thread-board";

const now = new Date();
const ago = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString();

const threads = [
  {
    id: "release-review",
    title: "Review release notes and approve the final publish",
    status: "idle",
    requiresAttention: true,
    attentionReason: "permission",
    pendingPermissionCount: 1,
    parentAgentId: null,
    projectName: "Paseo",
    workspaceName: "release-0.8",
    provider: "openai",
    model: "gpt-5.6-codex",
    updatedAt: ago(3),
    lastActivityAt: ago(3),
  },
  {
    id: "migration",
    title: "Resolve workspace migration test failure",
    status: "error",
    requiresAttention: true,
    attentionReason: "error",
    pendingPermissionCount: 0,
    parentAgentId: null,
    projectName: "TinyCloud CLI",
    workspaceName: "migration-hardening",
    provider: "anthropic",
    model: "claude-opus-5",
    updatedAt: ago(18),
    lastActivityAt: ago(18),
  },
  {
    id: "thread-board",
    title: "Build a live Kanban for Paseo threads",
    status: "running",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    projectName: "Paseo Plugins",
    workspaceName: "thread-board",
    provider: "openai",
    model: "gpt-5.6-codex",
    updatedAt: ago(1),
    lastActivityAt: ago(1),
  },
  {
    id: "docs",
    title: "Refresh plugin API documentation examples",
    status: "running",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    projectName: "Paseo",
    workspaceName: "plugin-docs",
    provider: "anthropic",
    model: "claude-sonnet-4.5",
    updatedAt: ago(7),
    lastActivityAt: ago(7),
  },
  {
    id: "visual-check",
    title: "Check compact and expanded board layouts",
    status: "running",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: "thread-board",
    projectName: "Paseo Plugins",
    workspaceName: "thread-board",
    provider: "openai",
    model: "gpt-5.6-codex",
    updatedAt: ago(2),
    lastActivityAt: ago(2),
  },
  {
    id: "sdk-audit",
    title: "Audit SDK dependency update",
    status: "idle",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    projectName: "TinyCloud SDK",
    workspaceName: "dependency-audit",
    provider: "openai",
    model: "gpt-5.5",
    updatedAt: ago(74),
    lastActivityAt: ago(74),
  },
  {
    id: "observability",
    title: "Trace terminal reconnect metrics",
    status: "idle",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    projectName: "Paseo",
    workspaceName: "terminal-observability",
    provider: "anthropic",
    model: "claude-sonnet-4.5",
    updatedAt: ago(240),
    lastActivityAt: ago(240),
  },
  {
    id: "closed",
    title: "Prototype workspace activity view",
    status: "closed",
    requiresAttention: false,
    attentionReason: null,
    pendingPermissionCount: 0,
    parentAgentId: null,
    projectName: "Paseo Plugins",
    workspaceName: "activity-prototype",
    provider: "openai",
    model: "gpt-5.5",
    updatedAt: ago(1_440),
    lastActivityAt: ago(1_440),
  },
];

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
      threads={threads}
      status="ready"
      error={null}
      refreshing={false}
      onRefresh={() => undefined}
    />
  );
}

createRoot(document.getElementById("root")).render(<Preview />);
