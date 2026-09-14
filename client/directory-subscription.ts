/**
 * Keeps the owned stream returned by `agents.list({ subscribe: {} })` alive until the
 * corresponding directory effect is replaced or unmounted.
 *
 * Paseo 0.8's published types omit `subscription`, while current plugin runtimes return it.
 * Reading the handle structurally keeps cleanup correct across both shapes. Legacy hosts replace
 * their single agent-directory subscription when a new one is opened.
 */

interface DirectorySubscription {
  release(): Promise<void>;
}

export interface SubscriptionKeeper {
  keep(result: object): void;
  release(): void;
}

function takeSubscription(result: object): DirectorySubscription | null {
  const candidate = (result as { subscription?: unknown }).subscription;
  if (
    candidate &&
    typeof candidate === "object" &&
    typeof (candidate as DirectorySubscription).release === "function"
  ) {
    return candidate as DirectorySubscription;
  }
  return null;
}

function releaseQuietly(subscription: DirectorySubscription): void {
  void subscription.release().catch(() => undefined);
}

export function createSubscriptionKeeper(): SubscriptionKeeper {
  const subscriptions: DirectorySubscription[] = [];
  let released = false;

  return {
    keep(result) {
      const subscription = takeSubscription(result);
      if (!subscription) return;
      if (released) releaseQuietly(subscription);
      else subscriptions.push(subscription);
    },
    release() {
      released = true;
      for (const subscription of subscriptions.splice(0)) releaseQuietly(subscription);
    },
  };
}
