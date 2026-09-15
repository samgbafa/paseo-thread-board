import type { PluginClientContext } from "@getpaseo/plugin/client";
import { ThreadBoardSurface } from "./client/thread-board";

export default function contribute(client: PluginClientContext) {
  const removeSurface = client.addSurface("thread-board", ThreadBoardSurface);
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
    removeCommand();
    removeSidebarItem();
    removeSurface();
  };
}
