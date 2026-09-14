import { describe, expect, it, vi } from "vitest";
import { createSubscriptionKeeper } from "./directory-subscription";

describe("directory subscription lifetime", () => {
  it("releases every owned stream exactly once", async () => {
    const first = { release: vi.fn(async () => undefined) };
    const second = { release: vi.fn(async () => undefined) };
    const keeper = createSubscriptionKeeper();

    keeper.keep({ subscription: first });
    keeper.keep({ subscription: second });
    keeper.release();
    keeper.release();
    await Promise.resolve();

    expect(first.release).toHaveBeenCalledOnce();
    expect(second.release).toHaveBeenCalledOnce();
  });

  it("immediately releases a stream that resolves after cleanup", async () => {
    const late = { release: vi.fn(async () => undefined) };
    const keeper = createSubscriptionKeeper();

    keeper.release();
    keeper.keep({ subscription: late });
    await Promise.resolve();

    expect(late.release).toHaveBeenCalledOnce();
  });

  it("accepts the legacy result shape without inventing an unsubscribe", () => {
    const keeper = createSubscriptionKeeper();
    expect(() => {
      keeper.keep({ subscriptionId: "legacy-stream" });
      keeper.release();
    }).not.toThrow();
  });
});
