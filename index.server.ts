import type { PluginServerContext } from "@getpaseo/plugin/server";
import { registerWorkflowEvents } from "./server/workflow-events";
import { threadBoardViewOptions } from "./shared/view-options";
import { threadBoardWorkflow } from "./shared/workflow";

export default function contribute(server: PluginServerContext) {
  server.registerSettings(threadBoardViewOptions);
  server.registerSettings(threadBoardWorkflow);
  const removeWorkflowEvents = registerWorkflowEvents(server);
  return () => removeWorkflowEvents();
}
