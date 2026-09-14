export const PARENT_AGENT_ID_LABEL = "paseo.parent-agent-id";

export type LaneId = "attention" | "running" | "idle" | "closed";

export const LANES: readonly LaneId[] = ["attention", "running", "idle", "closed"];

export const LANE_TITLES: Record<LaneId, string> = {
  attention: "Needs You",
  running: "Running",
  idle: "Idle",
  closed: "Closed",
};

export interface BoardThread {
  id: string;
  title: string;
  status: "initializing" | "idle" | "running" | "error" | "closed";
  requiresAttention: boolean;
  attentionReason: "finished" | "error" | "permission" | null;
  pendingPermissionCount: number;
  parentAgentId: string | null;
  projectName: string;
  workspaceName: string | null;
  provider: string;
  model: string | null;
  updatedAt: string;
  lastActivityAt: string;
}

export function laneOf(thread: BoardThread): LaneId {
  if (thread.status === "closed") return "closed";
  if (thread.requiresAttention || thread.status === "error" || thread.pendingPermissionCount > 0) {
    return "attention";
  }
  if (thread.status === "running" || thread.status === "initializing") return "running";
  return "idle";
}

export function stateLabel(thread: BoardThread): string {
  if (thread.pendingPermissionCount > 0) {
    return thread.pendingPermissionCount === 1
      ? "Permission requested"
      : `${thread.pendingPermissionCount} permissions requested`;
  }
  if (thread.status === "error" || thread.attentionReason === "error") return "Error";
  if (thread.attentionReason === "finished") return "Finished";
  if (thread.attentionReason === "permission") return "Permission requested";
  if (thread.status === "initializing") return "Starting";
  if (thread.status === "running") return "Running";
  if (thread.status === "closed") return "Closed";
  return "Idle";
}

export function countChildren(threads: readonly BoardThread[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const thread of threads) {
    if (!thread.parentAgentId) continue;
    counts.set(thread.parentAgentId, (counts.get(thread.parentAgentId) ?? 0) + 1);
  }
  return counts;
}

export function visibleThreads(
  threads: readonly BoardThread[],
  options: { includeSubagents: boolean; showClosed: boolean },
): BoardThread[] {
  return threads
    .filter((thread) => options.includeSubagents || thread.parentAgentId === null)
    .filter((thread) => options.showClosed || laneOf(thread) !== "closed")
    .sort((left, right) => {
      const leftTime = Date.parse(left.lastActivityAt || left.updatedAt);
      const rightTime = Date.parse(right.lastActivityAt || right.updatedAt);
      return (
        (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0)
      );
    });
}

export function relativeAge(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((now - then) / 1_000));
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
