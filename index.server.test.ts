import { describe, expect, it, vi } from "vitest";
import contribute from "./index.server";
import { threadBoardNameAliases } from "./shared/name-aliases";
import { threadBoardViewOptions } from "./shared/view-options";
import { threadBoardWorkflow } from "./shared/workflow";

describe("Thread Board server contribution", () => {
  it("registers settings, workflow events, and workspace-label synchronization", async () => {
    const registerSettings = vi.fn(() => ({ read: vi.fn() }));
    const removeHook = vi.fn();
    const on = vi.fn(() => removeHook);
    const handle = vi.fn();
    const cleanup = contribute({ registerSettings, on, handle } as never);

    expect(registerSettings.mock.calls).toEqual([
      [threadBoardNameAliases],
      [threadBoardViewOptions],
      [threadBoardWorkflow],
    ]);
    expect(on).toHaveBeenCalledTimes(8);
    expect(handle).toHaveBeenCalledTimes(3);
    await cleanup();
    expect(removeHook).toHaveBeenCalledTimes(8);
  });
});
