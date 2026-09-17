import type { BoardNameSuggestion, BoardNameTarget } from "../shared/naming";

export interface BoardNamingJobState {
  status: "idle" | "generating" | "ready" | "error";
  targets: readonly BoardNameTarget[];
  suggestions: readonly BoardNameSuggestion[] | null;
  error: string | null;
}

export interface BoardNamingJobStore {
  getSnapshot(): BoardNamingJobState;
  subscribe(listener: () => void): () => void;
  start(
    targets: readonly BoardNameTarget[],
    generate: () => Promise<readonly BoardNameSuggestion[]>,
  ): void;
  clear(): void;
  dispose(): void;
}

const EMPTY_JOB: BoardNamingJobState = {
  status: "idle",
  targets: [],
  suggestions: null,
  error: null,
};

export function createBoardNamingJobStore(): BoardNamingJobStore {
  let state = EMPTY_JOB;
  let requestId = 0;
  let disposed = false;
  const listeners = new Set<() => void>();

  const update = (next: BoardNamingJobState) => {
    if (disposed) return;
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start(targets, generate) {
      if (disposed || state.status === "generating" || targets.length === 0) return;
      const currentRequestId = requestId + 1;
      requestId = currentRequestId;
      const jobTargets = [...targets];
      update({ status: "generating", targets: jobTargets, suggestions: null, error: null });

      void (async () => {
        try {
          const suggestions = await generate();
          if (requestId !== currentRequestId) return;
          update({
            status: "ready",
            targets: jobTargets,
            suggestions: [...suggestions],
            error: null,
          });
        } catch (cause) {
          if (requestId !== currentRequestId) return;
          update({
            status: "error",
            targets: jobTargets,
            suggestions: null,
            error: cause instanceof Error ? cause.message : "Luna could not name this board.",
          });
        }
      })();
    },
    clear() {
      if (state.status === "generating") return;
      requestId += 1;
      update(EMPTY_JOB);
    },
    dispose() {
      disposed = true;
      requestId += 1;
      listeners.clear();
    },
  };
}
