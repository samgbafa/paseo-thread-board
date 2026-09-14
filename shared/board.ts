export const PARENT_AGENT_ID_LABEL = "paseo.parent-agent-id";

export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1_000;

export type LaneId = "attention" | "running" | "idle" | "stale";

export const LANES: readonly LaneId[] = ["attention", "running", "idle", "stale"];

export const LANE_TITLES: Record<LaneId, string> = {
  attention: "Needs You",
  running: "Running",
  idle: "Idle",
  stale: "Stale",
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
  providerThreadKey: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export interface BoardThreadGroup {
  id: string;
  title: string;
  tabs: readonly BoardThread[];
  primaryTab: BoardThread;
  lane: LaneId;
}

export interface BoardItem {
  id: string;
  kind: "thread" | "group" | "tab";
  lane: LaneId;
  thread: BoardThread;
  group: BoardThreadGroup | null;
}

export function isStale(thread: BoardThread, now = Date.now()): boolean {
  const lastMessageAt = Date.parse(thread.lastMessageAt);
  return Number.isFinite(lastMessageAt) && now - lastMessageAt >= STALE_AFTER_MS;
}

export function laneOf(thread: BoardThread, now = Date.now()): LaneId {
  if (isStale(thread, now)) return "stale";
  if (thread.requiresAttention || thread.status === "error" || thread.pendingPermissionCount > 0) {
    return "attention";
  }
  if (thread.status === "running" || thread.status === "initializing") return "running";
  return "idle";
}

export function stateLabel(thread: BoardThread, now = Date.now()): string {
  if (isStale(thread, now)) return "Stale";
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
  if (thread.status === "closed") return "Stopped";
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

const LANE_PRIORITY: Record<LaneId, number> = {
  attention: 0,
  running: 1,
  idle: 2,
  stale: 3,
};

function timeValue(iso: string): number {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

function compareActivity(left: BoardThread, right: BoardThread): number {
  return (
    timeValue(right.lastMessageAt) - timeValue(left.lastMessageAt) ||
    left.id.localeCompare(right.id)
  );
}

/** Groups separate Paseo agent tabs that resume the same provider-native thread. */
export function groupThreads(
  threads: readonly BoardThread[],
  now = Date.now(),
): BoardThreadGroup[] {
  const groups = new Map<string, BoardThread[]>();
  for (const thread of threads) {
    const id = thread.providerThreadKey
      ? `provider-thread:${thread.providerThreadKey}`
      : `agent:${thread.id}`;
    const tabs = groups.get(id);
    if (tabs) tabs.push(thread);
    else groups.set(id, [thread]);
  }

  return [...groups.entries()]
    .map(([id, unsortedTabs]) => {
      const tabs = [...unsortedTabs].sort(compareActivity);
      const primaryTab = [...tabs].sort((left, right) => {
        const urgency = LANE_PRIORITY[laneOf(left, now)] - LANE_PRIORITY[laneOf(right, now)];
        return urgency || compareActivity(left, right);
      })[0];
      const canonicalTab = [...tabs].sort(
        (left, right) =>
          timeValue(left.createdAt) - timeValue(right.createdAt) || left.id.localeCompare(right.id),
      )[0];
      return {
        id,
        title: canonicalTab.title,
        tabs,
        primaryTab,
        lane: laneOf(primaryTab, now),
      } satisfies BoardThreadGroup;
    })
    .sort((left, right) => compareActivity(left.primaryTab, right.primaryTab));
}

/** Expands multi-tab threads into one roll-up parent plus independently placed tab items. */
export function boardItems(
  groups: readonly BoardThreadGroup[],
  options: { showStale: boolean; now?: number },
): BoardItem[] {
  const items: BoardItem[] = [];
  for (const group of groups) {
    if (group.tabs.length === 1) {
      const thread = group.tabs[0];
      const lane = laneOf(thread, options.now);
      if (options.showStale || lane !== "stale") {
        items.push({ id: `thread:${thread.id}`, kind: "thread", lane, thread, group: null });
      }
      continue;
    }

    if (options.showStale || group.lane !== "stale") {
      items.push({
        id: `group:${group.id}`,
        kind: "group",
        lane: group.lane,
        thread: group.primaryTab,
        group,
      });
    }
    for (const tab of group.tabs) {
      const lane = laneOf(tab, options.now);
      if (options.showStale || lane !== "stale") {
        items.push({ id: `tab:${tab.id}`, kind: "tab", lane, thread: tab, group });
      }
    }
  }
  return items;
}

export function visibleThreads(
  threads: readonly BoardThread[],
  options: { includeSubagents: boolean; showStale: boolean; now?: number },
): BoardThread[] {
  return threads
    .filter((thread) => options.includeSubagents || thread.parentAgentId === null)
    .filter((thread) => options.showStale || laneOf(thread, options.now) !== "stale")
    .sort((left, right) => {
      return compareActivity(left, right);
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
