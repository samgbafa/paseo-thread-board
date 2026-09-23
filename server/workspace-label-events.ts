import type { PaseoAgentListResult, PaseoApi } from "@getpaseo/client";
import type { PluginServerContext, PluginSettingsState } from "@getpaseo/plugin/server";
import { type BoardThread, PARENT_AGENT_ID_LABEL } from "../shared/board";
import {
  applyThreadWorkflow,
  DEFAULT_THREAD_WORKFLOW,
  type ThreadWorkflowDocument,
} from "../shared/workflow";
import { workspaceLaneAssignments } from "../shared/workspace-labels";
import type { WorkspaceLabelSync } from "./workspace-labels";

const PAGE_LIMIT = 200;
const MAX_PAGES = 10;

type AgentEntry = PaseoAgentListResult["entries"][number];

function parentAgentId(agent: AgentEntry["agent"]): string | null {
  const value = agent.labels[PARENT_AGENT_ID_LABEL];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function toServerBoardThread({ agent, project }: AgentEntry): BoardThread {
  return {
    id: agent.id,
    title: agent.title?.trim() || agent.id.slice(0, 7),
    status: agent.status,
    requiresAttention: agent.requiresAttention ?? false,
    attentionReason: agent.attentionReason ?? null,
    attentionTimestamp: agent.attentionTimestamp ?? null,
    pendingPermissionCount: agent.pendingPermissions.length,
    parentAgentId: parentAgentId(agent),
    workspaceId: agent.workspaceId ?? null,
    projectName: project?.projectName ?? "Unassigned project",
    workspaceName: project?.workspaceName ?? null,
    provider: agent.provider,
    model: agent.model,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    lastMessageAt: agent.lastUserMessageAt ?? agent.createdAt,
    workflowState: null,
    workflowAttentionReason: null,
  };
}

async function listThreads(paseo: PaseoApi): Promise<BoardThread[]> {
  const threads: BoardThread[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await paseo.agents.list({
      filter: { includeArchived: false },
      sort: [{ key: "updated_at", direction: "desc" }],
      page: { limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
    });
    threads.push(...result.entries.map(toServerBoardThread));
    cursor = result.pageInfo.hasMore ? (result.pageInfo.nextCursor ?? undefined) : undefined;
    if (!cursor) break;
  }
  return threads;
}

type WorkflowState = PluginSettingsState<
  typeof import("../shared/workflow").threadBoardWorkflow.schema
>;

export async function syncWorkspaceLabelsFromState(
  paseo: PaseoApi,
  readWorkflow: () => Promise<WorkflowState>,
  workspaceLabelSync: Pick<WorkspaceLabelSync, "sync">,
): Promise<void> {
  const [threads, workflow] = await Promise.all([listThreads(paseo), readWorkflow()]);
  const document: ThreadWorkflowDocument =
    workflow.status === "ready" ? workflow.values : DEFAULT_THREAD_WORKFLOW;
  await workspaceLabelSync.sync({
    assignments: workspaceLaneAssignments(applyThreadWorkflow(threads, document)),
  });
}

export function registerWorkspaceLabelEvents(
  server: PluginServerContext,
  readWorkflow: () => Promise<WorkflowState>,
  workspaceLabelSync: Pick<WorkspaceLabelSync, "sync">,
): () => void {
  let queue = Promise.resolve();
  const reconcile = (paseo: PaseoApi) => {
    queue = queue
      .catch(() => undefined)
      .then(() => syncWorkspaceLabelsFromState(paseo, readWorkflow, workspaceLabelSync));
    return queue;
  };
  const callback = (_event: unknown, { paseo }: { paseo: PaseoApi }) => reconcile(paseo);
  const removers = [
    server.on("agent.created", callback),
    server.on("agent.turn_started", callback),
    server.on("agent.turn_ended", callback),
    server.on("agent.permission_requested", callback),
    server.on("agent.permission_resolved", callback),
    server.on("agent.archived", callback),
  ];
  return () => {
    for (const remove of removers) remove();
  };
}
