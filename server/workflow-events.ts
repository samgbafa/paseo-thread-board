import type { PluginServerContext } from "@getpaseo/plugin/server";
import {
  acknowledgeWorkflowEvents,
  listWorkflowEvents,
  type WorkflowEvent,
} from "../shared/workflow";

/** Retains turn outcomes while the plugin client is closed so opening a thread cannot erase them. */
export function registerWorkflowEvents(server: PluginServerContext): () => void {
  const events = new Map<string, WorkflowEvent>();
  const removers = [
    server.on("agent.turn_started", ({ agent }) => {
      events.delete(agent.id);
    }),
    server.on("agent.turn_ended", ({ agent, outcome, turnId }) => {
      if (outcome.kind === "canceled") return;
      const reason = outcome.kind === "failed" ? "error" : "finished";
      events.set(agent.id, {
        agentId: agent.id,
        reason,
        marker: `${turnId ?? "turn"}:${reason}:${new Date().toISOString()}`,
      });
    }),
    server.on("agent.archived", ({ agent }) => {
      events.delete(agent.id);
    }),
  ];

  server.handle(listWorkflowEvents, () => ({ events: [...events.values()] }));
  server.handle(acknowledgeWorkflowEvents, ({ agentIds }) => {
    for (const agentId of agentIds) events.delete(agentId);
    return {};
  });

  return () => {
    for (const remove of removers) remove();
    events.clear();
  };
}
