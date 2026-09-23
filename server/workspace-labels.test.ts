import { describe, expect, it, vi } from "vitest";
import {
  applyWorkspaceLabelAssignments,
  resolveDaemonWebSocketUrl,
  type WorkspaceLabelDriver,
} from "./workspace-labels";

describe("workspace label synchronization", () => {
  it("assigns exactly one Thread Board state label per workspace", async () => {
    const setWorkspaceLabel = vi.fn(async () => undefined);
    const driver: WorkspaceLabelDriver = { setWorkspaceLabel };

    await expect(
      applyWorkspaceLabelAssignments(driver, [
        { workspaceId: "workspace-1", lane: "attention" },
        { workspaceId: "workspace-1", lane: "running" },
      ]),
    ).resolves.toBe(1);

    expect(setWorkspaceLabel).toHaveBeenCalledTimes(3);
    expect(setWorkspaceLabel).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      label: { name: "Running", color: "emerald" },
      assigned: true,
    });
    expect(setWorkspaceLabel).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      label: { name: "Needs You", color: "amber" },
      assigned: false,
    });
    expect(setWorkspaceLabel).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      label: { name: "Paused", color: "sky" },
      assigned: false,
    });
  });

  it("uses an explicit daemon URL and otherwise falls back to the local Paseo port", () => {
    expect(resolveDaemonWebSocketUrl({ THREAD_BOARD_PASEO_URL: "ws://paseo.test:7000/ws" })).toBe(
      "ws://paseo.test:7000/ws",
    );
    expect(resolveDaemonWebSocketUrl({})).toBe("ws://127.0.0.1:6767/ws");
  });
});
