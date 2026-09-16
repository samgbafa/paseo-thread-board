import { defineRpc, defineSettings, settingsRpc } from "@getpaseo/plugin";
import { z } from "zod";
import type { BoardThread } from "./board";

const attentionRecordSchema = z.object({
  state: z.literal("attention"),
  reason: z.enum(["finished", "error"]),
  attentionMarkers: z.array(z.string()),
  lastMessageAt: z.string(),
});

const pausedRecordSchema = z.object({
  state: z.literal("paused"),
  pausedAt: z.string(),
  lastMessageAt: z.string(),
  attentionMarkers: z.array(z.string()),
  pendingPermissionCount: z.number().int().nonnegative(),
  status: z.enum(["initializing", "idle", "running", "error", "closed"]),
});

export const threadWorkflowRecordSchema = z.discriminatedUnion("state", [
  attentionRecordSchema,
  pausedRecordSchema,
]);

export type ThreadWorkflowRecord = z.infer<typeof threadWorkflowRecordSchema>;

export interface ThreadWorkflowDocument {
  records: Record<string, ThreadWorkflowRecord>;
}

export const DEFAULT_THREAD_WORKFLOW: ThreadWorkflowDocument = { records: {} };

export const threadBoardWorkflow = defineSettings({
  id: "thread-board-workflow",
  scope: "host",
  version: 1,
  schema: z.object({
    records: z.record(z.string(), threadWorkflowRecordSchema).default({}),
  }),
});

export const threadBoardWorkflowRpc = settingsRpc(threadBoardWorkflow.id);

export const workflowEventSchema = z.object({
  agentId: z.string(),
  reason: z.enum(["finished", "error"]),
  marker: z.string(),
});

export type WorkflowEvent = z.infer<typeof workflowEventSchema>;

export const listWorkflowEvents = defineRpc({
  name: "thread-board.workflow-events.list",
  input: z.object({}),
  output: z.object({ events: z.array(workflowEventSchema) }),
});

export const acknowledgeWorkflowEvents = defineRpc({
  name: "thread-board.workflow-events.acknowledge",
  input: z.object({ agentIds: z.array(z.string()) }),
  output: z.object({}),
});

interface AttentionSignal {
  reason: "finished" | "error";
  marker: string;
}

function liveAttentionMarker(thread: BoardThread): string | null {
  if (!thread.requiresAttention || !thread.attentionTimestamp || !thread.attentionReason) {
    return null;
  }
  return `${thread.attentionReason}:${thread.attentionTimestamp}`;
}

function durableAttentionSignal(thread: BoardThread): AttentionSignal | null {
  if (
    isRunning(thread) ||
    !thread.requiresAttention ||
    !thread.attentionTimestamp ||
    (thread.attentionReason !== "finished" && thread.attentionReason !== "error")
  ) {
    return null;
  }
  return {
    reason: thread.attentionReason,
    marker: `${thread.attentionReason}:${thread.attentionTimestamp}`,
  };
}

function isRunning(thread: BoardThread): boolean {
  return thread.status === "running" || thread.status === "initializing";
}

function pausedRecordIsCurrent(
  thread: BoardThread,
  record: Extract<ThreadWorkflowRecord, { state: "paused" }>,
): boolean {
  if (isRunning(thread) || thread.lastMessageAt !== record.lastMessageAt) return false;
  const marker = liveAttentionMarker(thread);
  if (marker && !record.attentionMarkers.includes(marker)) return false;
  if (thread.pendingPermissionCount > record.pendingPermissionCount) return false;
  if (thread.status === "error" && record.status !== "error") return false;
  return true;
}

function attentionRecordIsCurrent(
  thread: BoardThread,
  record: Extract<ThreadWorkflowRecord, { state: "attention" }>,
): boolean {
  return !isRunning(thread) && thread.lastMessageAt === record.lastMessageAt;
}

export function recordsEqual(
  left: Readonly<Record<string, ThreadWorkflowRecord>>,
  right: Readonly<Record<string, ThreadWorkflowRecord>>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => JSON.stringify(left[key]) === JSON.stringify(right[key]));
}

/** Projects durable workflow state over Paseo's live runtime state. */
export function applyThreadWorkflow(
  threads: readonly BoardThread[],
  document: ThreadWorkflowDocument,
): BoardThread[] {
  return threads.map((thread) => {
    const record = document.records[thread.id];
    if (record?.state === "paused" && pausedRecordIsCurrent(thread, record)) {
      return { ...thread, workflowState: "paused", workflowAttentionReason: null };
    }
    if (record?.state === "attention" && attentionRecordIsCurrent(thread, record)) {
      return {
        ...thread,
        workflowState: "attention",
        workflowAttentionReason: record.reason,
      };
    }
    return { ...thread, workflowState: null, workflowAttentionReason: null };
  });
}

/** Latches completions/errors and clears saved state when later activity addresses it. */
export function reconcileThreadWorkflow(
  document: ThreadWorkflowDocument,
  threads: readonly BoardThread[],
  events: readonly WorkflowEvent[] = [],
): ThreadWorkflowDocument {
  const records = { ...document.records };
  for (const thread of threads) {
    const record = records[thread.id];
    const signal = durableAttentionSignal(thread);

    if (record?.state === "paused") {
      if (pausedRecordIsCurrent(thread, record)) continue;
      if (signal) {
        records[thread.id] = {
          state: "attention",
          reason: signal.reason,
          attentionMarkers: [...new Set([...record.attentionMarkers, signal.marker])],
          lastMessageAt: thread.lastMessageAt,
        };
      } else {
        delete records[thread.id];
      }
      continue;
    }

    if (record?.state === "attention" && !attentionRecordIsCurrent(thread, record)) {
      delete records[thread.id];
    }

    if (signal) {
      const markers =
        records[thread.id]?.state === "attention"
          ? records[thread.id].attentionMarkers
          : ([] as string[]);
      records[thread.id] = {
        state: "attention",
        reason: signal.reason,
        attentionMarkers: [...new Set([...markers, signal.marker])],
        lastMessageAt: thread.lastMessageAt,
      };
    }
  }

  const threadsById = new Map(threads.map((thread) => [thread.id, thread]));
  for (const event of events) {
    const thread = threadsById.get(event.agentId);
    if (!thread || isRunning(thread)) continue;
    const record = records[event.agentId];
    if (record?.state === "paused" && record.attentionMarkers.includes(event.marker)) continue;
    const markers = record?.state === "attention" ? record.attentionMarkers : [];
    records[event.agentId] = {
      state: "attention",
      reason: event.reason,
      attentionMarkers: [...new Set([...markers, event.marker])],
      lastMessageAt: thread.lastMessageAt,
    };
  }

  return recordsEqual(document.records, records) ? document : { records };
}

export function pauseThreads(
  document: ThreadWorkflowDocument,
  threads: readonly BoardThread[],
  pausedAt = new Date().toISOString(),
): ThreadWorkflowDocument {
  const records = { ...document.records };
  for (const thread of threads) {
    const current = records[thread.id];
    const markers =
      current?.state === "attention" || current?.state === "paused" ? current.attentionMarkers : [];
    const liveMarker = liveAttentionMarker(thread);
    records[thread.id] = {
      state: "paused",
      pausedAt,
      lastMessageAt: thread.lastMessageAt,
      attentionMarkers: [...new Set([...markers, ...(liveMarker ? [liveMarker] : [])])],
      pendingPermissionCount: thread.pendingPermissionCount,
      status: thread.status,
    };
  }
  return { records };
}
