import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_NAME_ALIASES,
  type ThreadBoardNameAliases,
  threadBoardNameAliases,
  threadBoardNameAliasesRpc,
} from "../shared/name-aliases";

interface PersistedNameAliases {
  aliases: ThreadBoardNameAliases;
  ready: boolean;
  saving: boolean;
  error: string | null;
  errorKind: "load" | "save" | null;
  update(next: ThreadBoardNameAliases): Promise<void>;
  reload(): Promise<void>;
}

export function usePersistedNameAliases(): PersistedNameAliases {
  const read = useRpc(threadBoardNameAliasesRpc.read);
  const write = useRpc(threadBoardNameAliasesRpc.write);
  const [aliases, setAliases] = useState(DEFAULT_NAME_ALIASES);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"load" | "save" | null>(null);
  const revisionRef = useRef<string | null>(null);
  const aliasesRef = useRef(DEFAULT_NAME_ALIASES);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
      const parsed = threadBoardNameAliases.schema.safeParse(result.values);
      if (!parsed.success) throw new Error("Saved board names are invalid.");
      revisionRef.current = result.revision;
      aliasesRef.current = parsed.data;
      setAliases(parsed.data);
      setReady(true);
    } catch (cause) {
      if (!mountedRef.current) return;
      setReady(false);
      setError(cause instanceof Error ? cause.message : "Could not load saved board names.");
      setErrorKind("load");
    }
  }, [read]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback(
    async (next: ThreadBoardNameAliases) => {
      if (revisionRef.current === null) throw new Error("Saved board names are not ready yet.");
      const previous = aliasesRef.current;
      aliasesRef.current = next;
      if (mountedRef.current) {
        setAliases(next);
        setSaving(true);
        setError(null);
        setErrorKind(null);
      }
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const result = await write({
            revision: revisionRef.current,
            values: { agentNames: next.agentNames, workspaceNames: next.workspaceNames },
          });
          if (result.status === "saved") {
            const parsed = threadBoardNameAliases.schema.safeParse(result.values);
            revisionRef.current = result.revision;
            aliasesRef.current = parsed.success ? parsed.data : next;
            if (mountedRef.current) setAliases(aliasesRef.current);
            return;
          }
          if (result.status === "conflict") {
            const latest = await read({});
            if (latest.status !== "ready") throw new Error(latest.error);
            revisionRef.current = latest.revision;
            continue;
          }
          throw new Error(result.error);
        }
        throw new Error("Could not save board names after retrying.");
      } catch (cause) {
        aliasesRef.current = previous;
        if (mountedRef.current) {
          setAliases(previous);
          setError(cause instanceof Error ? cause.message : "Could not save board names.");
          setErrorKind("save");
        }
        throw cause;
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [read, write],
  );

  return { aliases, ready, saving, error, errorKind, update, reload };
}
