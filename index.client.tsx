import type { PluginClientContext, PluginSurfaceProps } from "@getpaseo/plugin/client";
import { createBoardNamingJobStore } from "./client/naming-job-store";
import { ThreadBoardSurface } from "./client/thread-board";

export default function contribute(client: PluginClientContext) {
  const namingJobStore = createBoardNamingJobStore();
  const PersistentThreadBoardSurface = (props: PluginSurfaceProps) => (
    <ThreadBoardSurface {...props} namingJobStore={namingJobStore} />
  );
  const removeSurface = client.addSurface("thread-board", PersistentThreadBoardSurface);
  const removeSidebarItem = client.addSidebarItem({
    id: "thread-board",
    title: "Thread Board",
    icon: "Columns3",
    surface: "thread-board",
  });
  const removeCommand = client.addCommandCenterItem({
    id: "open-thread-board",
    title: "Open Thread Board",
    icon: "Columns3",
    keywords: ["agents", "threads", "kanban", "list", "filter", "status", "triage"],
    context: "global",
    onSelect({ openSurface }) {
      openSurface("thread-board");
    },
  });

  return () => {
    namingJobStore.dispose();
    removeCommand();
    removeSidebarItem();
    removeSurface();
  };
}
