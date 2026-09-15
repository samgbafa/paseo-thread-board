import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_VIEW_OPTIONS,
  type ThreadBoardViewOptions,
  threadBoardViewOptions,
  threadBoardViewOptionsRpc,
} from "../shared/view-options";

interface PersistedViewOptions {
  options: ThreadBoardViewOptions;
  ready: boolean;
  saving: boolean;
  error: string | null;
  errorKind: "load" | "save" | null;
  update(next: ThreadBoardViewOptions): void;
  reload(): Promise<void>;
}

function sameOptions(left: ThreadBoardViewOptions, right: ThreadBoardViewOptions): boolean {
  return (
    left.viewMode === right.viewMode &&
    left.includeSubagents === right.includeSubagents &&
    left.showStale === right.showStale
  );
}

export function usePersistedViewOptions(): PersistedViewOptions {
  const read = useRpc(threadBoardViewOptionsRpc.read);
  const write = useRpc(threadBoardViewOptionsRpc.write);
  const [options, setOptions] = useState(DEFAULT_VIEW_OPTIONS);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"load" | "save" | null>(null);
  const revisionRef = useRef<string | null>(null);
  const savedRef = useRef(DEFAULT_VIEW_OPTIONS);
  const desiredRef = useRef(DEFAULT_VIEW_OPTIONS);
  const writingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const flush = useCallback(async () => {
    if (writingRef.current || revisionRef.current === null) return;
    writingRef.current = true;
    if (mountedRef.current) setSaving(true);

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const target = desiredRef.current;
        if (sameOptions(target, savedRef.current)) break;
        const result = await write({
          revision: revisionRef.current,
          values: {
            viewMode: target.viewMode,
            includeSubagents: target.includeSubagents,
            showStale: target.showStale,
          },
        });
        if (!mountedRef.current) return;

        if (result.status === "saved") {
          const parsed = threadBoardViewOptions.schema.safeParse(result.values);
          revisionRef.current = result.revision;
          savedRef.current = parsed.success ? parsed.data : target;
          if (sameOptions(desiredRef.current, target)) setOptions(savedRef.current);
          continue;
        }

        if (result.status === "conflict") {
          const latest = await read({});
          if (latest.status !== "ready") throw new Error(latest.error);
          const parsed = threadBoardViewOptions.schema.safeParse(latest.values);
          if (!parsed.success) throw new Error("Saved view options are invalid.");
          revisionRef.current = latest.revision;
          savedRef.current = parsed.data;
          continue;
        }

        throw new Error(result.error);
      }

      if (!sameOptions(desiredRef.current, savedRef.current)) {
        throw new Error("Could not save view options after retrying.");
      }
      setError(null);
      setErrorKind(null);
    } catch (cause) {
      if (mountedRef.current) {
        setError(cause instanceof Error ? cause.message : "Could not save view options.");
        setErrorKind("save");
      }
    } finally {
      writingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }, [read, write]);

  const reload = useCallback(async () => {
    if (mountedRef.current) {
      setReady(false);
      setError(null);
      setErrorKind(null);
    }
    try {
      const result = await read({});
      if (!mountedRef.current) return;
      if (result.status !== "ready") throw new Error(result.error);
      const parsed = threadBoardViewOptions.schema.safeParse(result.values);
      if (!parsed.success) throw new Error("Saved view options are invalid.");
      revisionRef.current = result.revision;
      savedRef.current = parsed.data;
      desiredRef.current = parsed.data;
      setOptions(parsed.data);
      setReady(true);
    } catch (cause) {
      if (!mountedRef.current) return;
      setReady(false);
      setError(cause instanceof Error ? cause.message : "Could not load view options.");
      setErrorKind("load");
    }
  }, [read]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback(
    (next: ThreadBoardViewOptions) => {
      desiredRef.current = next;
      setOptions(next);
      setError(null);
      setErrorKind(null);
      void flush();
    },
    [flush],
  );

  return { options, ready, saving, error, errorKind, update, reload };
}
