import { defineSettings, settingsRpc } from "@getpaseo/plugin";
import { z } from "zod";

export interface ThreadBoardNameAliases {
  agentNames: Record<string, string>;
  workspaceNames: Record<string, string>;
}

export const DEFAULT_NAME_ALIASES: ThreadBoardNameAliases = {
  agentNames: {},
  workspaceNames: {},
};

const savedName = z.string().trim().min(1).max(80);

export const threadBoardNameAliases = defineSettings({
  id: "thread-board-name-aliases",
  scope: "host",
  version: 1,
  schema: z.object({
    agentNames: z.record(z.string(), savedName).default(DEFAULT_NAME_ALIASES.agentNames),
    workspaceNames: z.record(z.string(), savedName).default(DEFAULT_NAME_ALIASES.workspaceNames),
  }),
});

export const threadBoardNameAliasesRpc = settingsRpc(threadBoardNameAliases.id);
