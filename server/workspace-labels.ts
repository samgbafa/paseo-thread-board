import { URL } from "node:url";
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { RpcInput } from "@getpaseo/plugin";
import {
  type syncWorkspaceLabelsRpc,
  threadBoardWorkspaceLabelDefinitions,
  type WorkspaceLaneAssignment,
} from "../shared/workspace-labels";

type WorkspaceLabelColor =
  | "violet"
  | "sky"
  | "emerald"
  | "orange"
  | "pink"
  | "indigo"
  | "teal"
  | "red"
  | "amber"
  | "blue";

export interface WorkspaceLabelDriver {
  setWorkspaceLabel(options: {
    workspaceId: string;
    label: { name: string; color: WorkspaceLabelColor };
    assigned: boolean;
  }): Promise<unknown>;
}

function websocketUrl(value: string): string {
  const withProtocol = /^wss?:\/\//i.test(value) ? value : `ws://${value}`;
  const parsed = new URL(withProtocol);
  if (parsed.hostname === "0.0.0.0" || parsed.hostname === "::") {
    parsed.hostname = "127.0.0.1";
  }
  if (parsed.pathname === "/") parsed.pathname = "/ws";
  return parsed.toString();
}

export function resolveDaemonWebSocketUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.THREAD_BOARD_PASEO_URL?.trim();
  if (explicit) return websocketUrl(explicit);
  const listen = env.PASEO_LISTEN?.trim();
  if (listen) return websocketUrl(listen);
  const port = env.PORT?.trim();
  return websocketUrl(`127.0.0.1:${port || "6767"}`);
}

export async function applyWorkspaceLabelAssignments(
  driver: WorkspaceLabelDriver,
  assignments: readonly WorkspaceLaneAssignment[],
): Promise<number> {
  const unique = new Map(assignments.map((assignment) => [assignment.workspaceId, assignment]));
  for (const { workspaceId, lane } of unique.values()) {
    for (const [candidateLane, definition] of Object.entries(
      threadBoardWorkspaceLabelDefinitions,
    )) {
      await driver.setWorkspaceLabel({
        workspaceId,
        label: definition,
        assigned: candidateLane === lane,
      });
    }
  }
  return unique.size;
}

export class WorkspaceLabelSync {
  private client: DaemonClient | null = null;
  private connecting: Promise<DaemonClient> | null = null;

  private connect(): Promise<DaemonClient> {
    if (this.client) return Promise.resolve(this.client);
    if (this.connecting) return this.connecting;
    const client = new DaemonClient({
      url: resolveDaemonWebSocketUrl(),
      clientId: `thread-board-workspace-labels-${process.pid}`,
      clientType: "cli",
      password: process.env.PASEO_PASSWORD,
      reconnect: { enabled: false },
    });
    this.connecting = client
      .connect()
      .then(() => {
        this.client = client;
        return client;
      })
      .catch(async (cause) => {
        await client.close().catch(() => undefined);
        throw cause;
      })
      .finally(() => {
        this.connecting = null;
      });
    return this.connecting;
  }

  async sync({ assignments }: RpcInput<typeof syncWorkspaceLabelsRpc>) {
    const client = await this.connect();
    const synced = await applyWorkspaceLabelAssignments(client, assignments);
    return { synced };
  }

  async dispose(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.connecting = null;
    if (client) await client.close();
  }
}
