import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { type BoardThread, groupThreads, type LaneId } from "./board";

export const threadBoardWorkspaceLabelDefinitions = {
  attention: { name: "Needs You", color: "amber" },
  running: { name: "Running", color: "emerald" },
  paused: { name: "Paused", color: "sky" },
} as const satisfies Record<LaneId, { name: string; color: string }>;

const workspaceLaneAssignmentSchema = z.object({
  workspaceId: z.string().min(1),
  lane: z.enum(["attention", "running", "paused"]),
});

export type WorkspaceLaneAssignment = z.infer<typeof workspaceLaneAssignmentSchema>;

export const syncWorkspaceLabelsRpc = defineRpc({
  name: "thread-board.workspace-labels.sync",
  input: z.object({
    assignments: z.array(workspaceLaneAssignmentSchema).max(500),
  }),
  output: z.object({ synced: z.number().int().nonnegative() }),
});

/** Mirrors the board's workspace roll-up lane, excluding standalone subagent groups. */
export function workspaceLaneAssignments(
  threads: readonly BoardThread[],
): WorkspaceLaneAssignment[] {
  return groupThreads(threads)
    .filter((group) => group.id.startsWith("workspace:"))
    .flatMap((group) => {
      const workspaceId = group.primaryTab.workspaceId;
      return workspaceId ? [{ workspaceId, lane: group.lane }] : [];
    })
    .sort((left, right) => left.workspaceId.localeCompare(right.workspaceId));
}
