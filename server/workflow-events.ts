import type { PluginHookContext, PluginServerContext } from "@getpaseo/plugin/server";
import {
  acknowledgeWorkflowEvents,
  listWorkflowEvents,
  type WorkflowEvent,
} from "../shared/workflow";

/** Retains turn outcomes while the plugin client is closed so opening a thread cannot erase them. */
export function registerWorkflowEvents(server: PluginServerContext): () => void {
  const events = new Map<string, WorkflowEvent>();
  let removeAgentUpdates: (() => void) | null = null;
  let agentUpdatesReady: Promise<void> | null = null;

  const captureAgent = (agent: {
    id: string;
    status: string;
    archivedAt?: string | null;
    requiresAttention?: boolean;
    attentionReason?: string | null;
    attentionTimestamp?: string | null;
  }) => {
    if (agent.archivedAt || agent.status === "running" || agent.status === "initializing") {
      events.delete(agent.id);
      return;
    }
    if (
      !agent.requiresAttention ||
      !agent.attentionTimestamp ||
      (agent.attentionReason !== "finished" && agent.attentionReason !== "error")
    ) {
      return;
    }
    events.set(agent.id, {
      agentId: agent.id,
      reason: agent.attentionReason,
      marker: `${agent.attentionReason}:${agent.attentionTimestamp}`,
    });
  };

  const observeAgentUpdates = (paseo: PluginHookContext["paseo"]): Promise<void> => {
    if (agentUpdatesReady) return agentUpdatesReady;
    removeAgentUpdates = paseo.agents.subscribe((update) => {
      if (update.kind === "remove") {
        events.delete(update.agentId);
        return;
      }
      captureAgent(update.agent);
    });
    agentUpdatesReady = paseo.agents
      .list({
        filter: { includeArchived: false },
        sort: [{ key: "updated_at", direction: "desc" }],
        page: { limit: 200 },
        subscribe: {},
      })
      .then((result) => {
        for (const entry of result.entries) captureAgent(entry.agent);
      })
      .catch((cause) => {
        removeAgentUpdates?.();
        removeAgentUpdates = null;
        agentUpdatesReady = null;
        throw cause;
      });
    return agentUpdatesReady;
  };

  const removers = [
    server.on("agent.turn_started", async ({ agent }, { paseo }) => {
      await observeAgentUpdates(paseo);
      events.delete(agent.id);
    }),
    server.on("agent.archived", ({ agent }) => {
      events.delete(agent.id);
    }),
  ];

  server.handle(listWorkflowEvents, async (_input, { paseo }) => {
    await observeAgentUpdates(paseo);
    return { events: [...events.values()] };
  });
  server.handle(acknowledgeWorkflowEvents, ({ agentIds }) => {
    for (const agentId of agentIds) events.delete(agentId);
    return {};
  });

  return () => {
    for (const remove of removers) remove();
    removeAgentUpdates?.();
    agentUpdatesReady = null;
    events.clear();
  };
}
