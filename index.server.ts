import type { PluginServerContext } from "@getpaseo/plugin/server";
import { registerWorkflowEvents } from "./server/workflow-events";
import { registerWorkspaceLabelEvents } from "./server/workspace-label-events";
import { WorkspaceLabelSync } from "./server/workspace-labels";
import { threadBoardNameAliases } from "./shared/name-aliases";
import { threadBoardViewOptions } from "./shared/view-options";
import { threadBoardWorkflow } from "./shared/workflow";
import { syncWorkspaceLabelsRpc } from "./shared/workspace-labels";

export default function contribute(server: PluginServerContext) {
  const workspaceLabelSync = new WorkspaceLabelSync();
  server.registerSettings(threadBoardNameAliases);
  server.registerSettings(threadBoardViewOptions);
  const workflowSettings = server.registerSettings(threadBoardWorkflow);
  server.handle(syncWorkspaceLabelsRpc, (input) => workspaceLabelSync.sync(input));
  const removeWorkflowEvents = registerWorkflowEvents(server);
  const removeWorkspaceLabelEvents = registerWorkspaceLabelEvents(
    server,
    () => workflowSettings.read(),
    workspaceLabelSync,
  );
  return async () => {
    removeWorkspaceLabelEvents();
    removeWorkflowEvents();
    await workspaceLabelSync.dispose();
  };
}
