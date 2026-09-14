import type { usePaseo } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useState } from "react";
import { type BoardThread, PARENT_AGENT_ID_LABEL } from "../shared/board";
import { createSubscriptionKeeper } from "./directory-subscription";

type PaseoApi = ReturnType<typeof usePaseo>;

const PAGE_LIMIT = 200;
const MAX_PAGES = 10;
const LIVE_UPDATE_DEBOUNCE_MS = 250;
const BACKSTOP_REFRESH_MS = 30_000;

type AgentEntry = Awaited<ReturnType<PaseoApi["agents"]["list"]>>["entries"][number];
type Agent = AgentEntry["agent"];
type Project = AgentEntry["project"];

export interface ThreadDirectory {
  threads: readonly BoardThread[];
  status: "loading" | "ready" | "error";
  error: string | null;
  refreshing: boolean;
  refresh(): void;
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message) return cause.message;
  return "Could not load threads from Paseo.";
}

function parentAgentId(agent: Agent): string | null {
  const value = agent.labels[PARENT_AGENT_ID_LABEL];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function toBoardThread(
  agent: Agent,
  project: Project | null | undefined,
  existing?: BoardThread,
): BoardThread {
  const projectName = project?.projectName ?? existing?.projectName ?? "Unassigned project";
  const workspaceName = project?.workspaceName ?? existing?.workspaceName ?? null;
  return {
    id: agent.id,
    title: agent.title?.trim() || agent.id.slice(0, 7),
    status: agent.status,
    requiresAttention: agent.requiresAttention ?? false,
    attentionReason: agent.attentionReason ?? null,
    pendingPermissionCount: agent.pendingPermissions.length,
    parentAgentId: parentAgentId(agent),
    workspaceId: agent.workspaceId ?? existing?.workspaceId ?? null,
    projectName,
    workspaceName,
    provider: agent.provider,
    model: agent.model,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    lastMessageAt: agent.lastUserMessageAt ?? agent.createdAt,
  };
}

/** Keeps a live, host-wide projection of Paseo's agent directory. */
export function useThreadDirectory(paseo: PaseoApi, hostId: string): ThreadDirectory {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<Omit<ThreadDirectory, "refresh">>({
    threads: [],
    status: "loading",
    error: null,
    refreshing: false,
  });

  const refresh = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, BACKSTOP_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const directoryGeneration = `${hostId}:${reloadToken}`;
    void directoryGeneration;
    let stopped = false;
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    const subscriptions = createSubscriptionKeeper();
    const threads = new Map<string, BoardThread>();

    setState((current) => ({
      ...current,
      status: current.threads.length > 0 ? "ready" : "loading",
      error: null,
      refreshing: current.threads.length > 0,
    }));

    const publish = () => {
      if (stopped) return;
      setState({
        threads: [...threads.values()],
        status: "ready",
        error: null,
        refreshing: false,
      });
    };

    const schedulePublish = () => {
      if (updateTimer) return;
      updateTimer = setTimeout(() => {
        updateTimer = undefined;
        publish();
      }, LIVE_UPDATE_DEBOUNCE_MS);
    };

    const unsubscribe = paseo.agents.subscribe((update) => {
      if (stopped) return;
      if (update.kind === "remove") {
        threads.delete(update.agentId);
        schedulePublish();
        return;
      }
      if (update.agent.archivedAt) {
        threads.delete(update.agent.id);
        schedulePublish();
        return;
      }
      const existing = threads.get(update.agent.id);
      const incomingTime = Date.parse(update.agent.updatedAt);
      const existingTime = Date.parse(existing?.updatedAt ?? "");
      if (existing && Number.isFinite(existingTime) && incomingTime < existingTime) return;
      threads.set(update.agent.id, toBoardThread(update.agent, update.project, existing));
      schedulePublish();
    });

    void (async () => {
      try {
        let cursor: string | undefined;
        for (let page = 0; page < MAX_PAGES; page += 1) {
          const result = await paseo.agents.list({
            filter: { includeArchived: false },
            sort: [{ key: "updated_at", direction: "desc" }],
            page: { limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
            ...(page === 0 ? { subscribe: {} } : {}),
          });
          if (page === 0) {
            subscriptions.keep(result);
          }
          if (stopped) return;
          for (const entry of result.entries) {
            const existing = threads.get(entry.agent.id);
            const incomingTime = Date.parse(entry.agent.updatedAt);
            const existingTime = Date.parse(existing?.updatedAt ?? "");
            if (existing && Number.isFinite(existingTime) && incomingTime < existingTime) continue;
            threads.set(entry.agent.id, toBoardThread(entry.agent, entry.project, existing));
          }
          publish();
          cursor = result.pageInfo.hasMore ? (result.pageInfo.nextCursor ?? undefined) : undefined;
          if (!cursor) break;
        }
      } catch (cause) {
        if (stopped) return;
        setState((current) => ({
          ...current,
          status: current.threads.length > 0 ? "ready" : "error",
          error: errorMessage(cause),
          refreshing: false,
        }));
      }
    })();

    return () => {
      stopped = true;
      if (updateTimer) clearTimeout(updateTimer);
      unsubscribe();
      subscriptions.release();
    };
  }, [hostId, paseo, reloadToken]);

  return { ...state, refresh };
}
