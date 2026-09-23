import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardThread } from "../shared/board";
import {
  acknowledgeWorkflowEvents,
  applyThreadWorkflow,
  DEFAULT_THREAD_WORKFLOW,
  listWorkflowEvents,
  pauseThreads,
  reconcileThreadWorkflow,
  recordsEqual,
  type ThreadWorkflowDocument,
  threadBoardWorkflow,
  threadBoardWorkflowRpc,
  type WorkflowEvent,
} from "../shared/workflow";
import { syncWorkspaceLabelsRpc, workspaceLaneAssignments } from "../shared/workspace-labels";

export interface ThreadWorkflowController {
  threads: readonly BoardThread[];
  ready: boolean;
  saving: boolean;
  error: string | null;
  errorKind: "load" | "save" | null;
  workspaceLabelError: string | null;
  pause(threads: readonly BoardThread[]): void;
  observe(threads: readonly BoardThread[]): void;
  reload(): Promise<void>;
}

function sameDocument(left: ThreadWorkflowDocument, right: ThreadWorkflowDocument): boolean {
  return recordsEqual(left.records, right.records);
}

export function useThreadWorkflow(threads: readonly BoardThread[]): ThreadWorkflowController {
  const read = useRpc(threadBoardWorkflowRpc.read);
  const write = useRpc(threadBoardWorkflowRpc.write);
  const listEvents = useRpc(listWorkflowEvents);
  const acknowledgeEvents = useRpc(acknowledgeWorkflowEvents);
  const syncWorkspaceLabels = useRpc(syncWorkspaceLabelsRpc);
  const [document, setDocument] = useState(DEFAULT_THREAD_WORKFLOW);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"load" | "save" | null>(null);
  const [workspaceLabelError, setWorkspaceLabelError] = useState<string | null>(null);
  const [eventRevision, setEventRevision] = useState(0);
  const revisionRef = useRef<string | null>(null);
  const savedRef = useRef(DEFAULT_THREAD_WORKFLOW);
  const desiredRef = useRef(DEFAULT_THREAD_WORKFLOW);
  const writingRef = useRef(false);
  const mountedRef = useRef(true);
  const pendingEventsRef = useRef<readonly WorkflowEvent[]>([]);
  const workspaceLabelSignatureRef = useRef("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const flush = useCallback(async () => {
    if (writingRef.current || revisionRef.current === null) return;
    writingRef.current = true;
    if (mountedRef.current) setSaving(true);

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const target = desiredRef.current;
        if (sameDocument(target, savedRef.current)) break;
        const result = await write({
          revision: revisionRef.current,
          values: { records: target.records },
        });
        if (!mountedRef.current) return;

        if (result.status === "saved") {
          const parsed = threadBoardWorkflow.schema.safeParse(result.values);
          revisionRef.current = result.revision;
          savedRef.current = parsed.success ? parsed.data : target;
          if (sameDocument(desiredRef.current, target)) setDocument(savedRef.current);
          continue;
        }

        if (result.status === "conflict") {
          const latest = await read({});
          if (latest.status !== "ready") throw new Error(latest.error);
          const parsed = threadBoardWorkflow.schema.safeParse(latest.values);
          if (!parsed.success) throw new Error("Saved thread workflow is invalid.");
          revisionRef.current = latest.revision;
          savedRef.current = parsed.data;
          continue;
        }

        throw new Error(result.error);
      }

      if (!sameDocument(desiredRef.current, savedRef.current)) {
        throw new Error("Could not save thread workflow after retrying.");
      }
      setError(null);
      setErrorKind(null);
    } catch (cause) {
      if (mountedRef.current) {
        setError(cause instanceof Error ? cause.message : "Could not save thread workflow.");
        setErrorKind("save");
      }
    } finally {
      writingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }, [read, write]);

  const commit = useCallback(
    (next: ThreadWorkflowDocument) => {
      if (sameDocument(next, desiredRef.current)) return;
      desiredRef.current = next;
      setDocument(next);
      setError(null);
      setErrorKind(null);
      void flush();
    },
    [flush],
  );

  const reload = useCallback(async () => {
    if (mountedRef.current) {
      setReady(false);
      setError(null);
      setErrorKind(null);
    }
    try {
      const result = await read({});
      if (!mountedRef.current) return;
      if (result.status !== "ready") throw new Error(result.error);
      const parsed = threadBoardWorkflow.schema.safeParse(result.values);
      if (!parsed.success) throw new Error("Saved thread workflow is invalid.");
      revisionRef.current = result.revision;
      savedRef.current = parsed.data;
      desiredRef.current = parsed.data;
      setDocument(parsed.data);
      setReady(true);
    } catch (cause) {
      if (!mountedRef.current) return;
      setReady(false);
      setError(cause instanceof Error ? cause.message : "Could not load thread workflow.");
      setErrorKind("load");
    }
  }, [read]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!ready) return;
    void eventRevision;
    const threadIds = new Set(threads.map((thread) => thread.id));
    const matchingEvents = pendingEventsRef.current.filter((event) => threadIds.has(event.agentId));
    if (matchingEvents.length > 0) {
      const matchedIds = new Set(matchingEvents.map((event) => event.agentId));
      pendingEventsRef.current = pendingEventsRef.current.filter(
        (event) => !matchedIds.has(event.agentId),
      );
    }
    commit(reconcileThreadWorkflow(desiredRef.current, threads, matchingEvents));
  }, [commit, eventRevision, ready, threads]);

  useEffect(() => {
    if (!ready) return;
    let canceled = false;
    void listEvents({})
      .then((result) => {
        if (canceled || !mountedRef.current) return;
        pendingEventsRef.current = result.events;
        setEventRevision((current) => current + 1);
      })
      .catch((cause) => {
        if (canceled || !mountedRef.current) return;
        setError(cause instanceof Error ? cause.message : "Could not load recent thread activity.");
        setErrorKind("load");
      });
    return () => {
      canceled = true;
    };
  }, [listEvents, ready]);

  const pause = useCallback(
    (targets: readonly BoardThread[]) => {
      if (!ready || targets.length === 0) return;
      commit(pauseThreads(desiredRef.current, targets));
      const agentIds = targets.map((thread) => thread.id);
      const pausedIds = new Set(agentIds);
      pendingEventsRef.current = pendingEventsRef.current.filter(
        (event) => !pausedIds.has(event.agentId),
      );
      void acknowledgeEvents({ agentIds }).catch(() => undefined);
    },
    [acknowledgeEvents, commit, ready],
  );

  const observe = useCallback(
    (targets: readonly BoardThread[]) => {
      if (!ready || targets.length === 0) return;
      commit(reconcileThreadWorkflow(desiredRef.current, targets));
    },
    [commit, ready],
  );

  const projectedThreads = useMemo(
    () => applyThreadWorkflow(threads, document),
    [document, threads],
  );
  const workspaceLabels = useMemo(
    () => workspaceLaneAssignments(projectedThreads),
    [projectedThreads],
  );

  useEffect(() => {
    if (!ready || workspaceLabels.length === 0) return;
    const signature = JSON.stringify(workspaceLabels);
    if (workspaceLabelSignatureRef.current === signature) return;
    workspaceLabelSignatureRef.current = signature;
    let canceled = false;
    void syncWorkspaceLabels({ assignments: workspaceLabels })
      .then(() => {
        if (!canceled && mountedRef.current) setWorkspaceLabelError(null);
      })
      .catch((cause) => {
        workspaceLabelSignatureRef.current = "";
        if (!canceled && mountedRef.current) {
          setWorkspaceLabelError(
            cause instanceof Error ? cause.message : "Could not update workspace labels.",
          );
        }
      });
    return () => {
      canceled = true;
    };
  }, [ready, syncWorkspaceLabels, workspaceLabels]);

  return {
    threads: projectedThreads,
    ready,
    saving,
    error,
    errorKind,
    workspaceLabelError,
    pause,
    observe,
    reload,
  };
}
