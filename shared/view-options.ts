import { defineSettings, settingsRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const VIEW_MODES = ["kanban", "list"] as const;

export type ViewMode = (typeof VIEW_MODES)[number];

export interface ThreadBoardViewOptions {
  viewMode: ViewMode;
  includeSubagents: boolean;
  showStale: boolean;
}

export const DEFAULT_VIEW_OPTIONS: ThreadBoardViewOptions = {
  viewMode: "kanban",
  includeSubagents: false,
  showStale: false,
};

export const threadBoardViewOptions = defineSettings({
  id: "thread-board-view-options",
  scope: "host",
  version: 1,
  schema: z.object({
    viewMode: z.enum(VIEW_MODES).default(DEFAULT_VIEW_OPTIONS.viewMode),
    includeSubagents: z.boolean().default(DEFAULT_VIEW_OPTIONS.includeSubagents),
    showStale: z.boolean().default(DEFAULT_VIEW_OPTIONS.showStale),
  }),
});

export const threadBoardViewOptionsRpc = settingsRpc(threadBoardViewOptions.id);
