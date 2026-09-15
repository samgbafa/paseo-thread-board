import { describe, expect, it, vi } from "vitest";
import contribute from "./index.server";
import { threadBoardViewOptions } from "./shared/view-options";

describe("Thread Board server contribution", () => {
  it("registers the host-backed view options document", () => {
    const registerSettings = vi.fn();
    const cleanup = contribute({ registerSettings } as never);

    expect(registerSettings).toHaveBeenCalledWith(threadBoardViewOptions);
    expect(cleanup()).toBeUndefined();
  });
});
