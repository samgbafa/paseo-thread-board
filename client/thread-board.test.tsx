import type { ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import contribute from "../index.client";
import type { BoardThread } from "../shared/board";
import { ThreadBoardView } from "./thread-board";

vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  return {
    ActivityIndicator: "ActivityIndicator",
    FlatList: ({
      data,
      renderItem,
      ListEmptyComponent,
      ...props
    }: {
      data: BoardThread[];
      renderItem(input: { item: BoardThread; index: number }): ReactNode;
      ListEmptyComponent?: ReactNode;
    }) =>
      createElement(
        "FlatList",
        props,
        data.length > 0
          ? data.map((item, index) => renderItem({ item, index }))
          : ListEmptyComponent,
      ),
    Pressable: "Pressable",
    ScrollView: "ScrollView",
    Text: "Text",
    View: "View",
  };
});

vi.mock("@getpaseo/plugin/client", () => ({
  usePaseo: vi.fn(),
}));

vi.mock("@getpaseo/plugin/client/react-native", () => ({
  Icon: "Icon",
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const theme = {
  colors: {
    surface0: "#101114",
    surface1: "#17191d",
    surface2: "#20232a",
    border: "#343842",
    foreground: "#f4f5f7",
    foregroundMuted: "#9ca3af",
    accent: "#5b8def",
    accentForeground: "#ffffff",
    statusSuccess: "#34a853",
    statusWarning: "#f4b400",
    statusDanger: "#ea4335",
  },
};

function thread(overrides: Partial<BoardThread> = {}): BoardThread {
  const freshTimestamp = new Date().toISOString();
  return {
    id: "root",
    title: "Review the release",
    status: "idle",
    requiresAttention: true,
    attentionReason: "finished",
    pendingPermissionCount: 0,
    parentAgentId: null,
    projectName: "Paseo",
    workspaceName: "thread-board",
    provider: "openai",
    model: "gpt-5",
    updatedAt: freshTimestamp,
    lastActivityAt: freshTimestamp,
    ...overrides,
  };
}

function renderBoard(
  threads: readonly BoardThread[],
  openAgent = vi.fn(),
  onArchive: (threadId: string) => Promise<void> = vi.fn(async () => undefined),
): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(
      <ThreadBoardView
        theme={theme}
        layout={{ compact: false, platform: "web" }}
        host={{ id: "host-1", label: "Studio" }}
        navigation={{ openAgent, openWorkspace: vi.fn() }}
        threads={threads}
        status="ready"
        error={null}
        refreshing={false}
        onRefresh={vi.fn()}
        onArchive={onArchive}
      />,
    );
  });
  return renderer as ReactTestRenderer;
}

function findCard(renderer: ReactTestRenderer, title: string) {
  return renderer.root.find(
    (node) =>
      typeof node.props.accessibilityLabel === "string" &&
      node.props.accessibilityLabel.startsWith(`${title},`),
  );
}

describe("Thread Board happy path", () => {
  it("shows top-level active work and opens the selected Paseo thread", () => {
    const openAgent = vi.fn();
    const renderer = renderBoard(
      [
        thread(),
        thread({
          id: "child",
          title: "Run verification",
          parentAgentId: "root",
          status: "running",
          requiresAttention: false,
          attentionReason: null,
        }),
        thread({
          id: "stale",
          title: "Old migration",
          status: "closed",
          requiresAttention: false,
          attentionReason: null,
          updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString(),
          lastActivityAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString(),
        }),
      ],
      openAgent,
    );

    expect(findCard(renderer, "Review the release").props.accessibilityLabel).toContain(
      "1 subagent",
    );
    expect(() => findCard(renderer, "Run verification")).toThrow();
    expect(() => findCard(renderer, "Old migration")).toThrow();

    act(() => {
      findCard(renderer, "Review the release").props.onPress();
    });
    expect(openAgent).toHaveBeenCalledWith({ agentId: "root" });

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Include subagent threads" }).props.onPress();
    });
    expect(findCard(renderer, "Run verification")).toBeTruthy();

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Show stale threads" }).props.onPress();
    });
    expect(findCard(renderer, "Old migration").props.accessibilityLabel).toContain("Stale");

    act(() => {
      findCard(renderer, "Old migration").props.onPress();
    });
    expect(openAgent).toHaveBeenCalledWith({ agentId: "stale" });

    act(() => renderer.unmount());
  });

  it("confirms before archiving a stale thread and removes it only after success", async () => {
    const onArchive = vi.fn(async (_threadId: string) => undefined);
    const staleThread = thread({
      id: "stale",
      title: "Old migration",
      status: "closed",
      requiresAttention: false,
      attentionReason: null,
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString(),
      lastActivityAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString(),
    });
    const renderer = renderBoard([staleThread], vi.fn(), onArchive);

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Show stale threads" }).props.onPress();
    });
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Archive Old migration" }).props.onPress();
    });
    expect(onArchive).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ children: "Archive this thread?" })).toBeTruthy();

    act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: "Cancel archiving Old migration" })
        .props.onPress();
    });
    expect(findCard(renderer, "Old migration")).toBeTruthy();

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Archive Old migration" }).props.onPress();
    });
    await act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: "Confirm archive Old migration" })
        .props.onPress();
    });

    expect(onArchive).toHaveBeenCalledWith("stale");
    expect(() => findCard(renderer, "Old migration")).toThrow();
    expect(renderer.root.findByProps({ children: "Archived Old migration." })).toBeTruthy();

    act(() => renderer.unmount());
  });

  it("keeps a stale thread visible when archiving fails", async () => {
    const onArchive = vi.fn(async () => {
      throw new Error("Host unavailable.");
    });
    const staleTimestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString();
    const renderer = renderBoard(
      [
        thread({
          id: "stale",
          title: "Old migration",
          requiresAttention: false,
          attentionReason: null,
          updatedAt: staleTimestamp,
          lastActivityAt: staleTimestamp,
        }),
      ],
      vi.fn(),
      onArchive,
    );

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Show stale threads" }).props.onPress();
    });
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Archive Old migration" }).props.onPress();
    });
    await act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: "Confirm archive Old migration" })
        .props.onPress();
    });

    expect(findCard(renderer, "Old migration")).toBeTruthy();
    expect(renderer.root.findByProps({ accessibilityRole: "alert" }).props.children).toContain(
      "Could not archive Old migration. Host unavailable.",
    );

    act(() => renderer.unmount());
  });

  it("blocks competing archive requests until the pending archive settles", async () => {
    let resolveArchive: (() => void) | undefined;
    const onArchive = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          resolveArchive = resolve;
        }),
    );
    const staleTimestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString();
    const renderer = renderBoard(
      [
        thread({
          id: "first",
          title: "First stale thread",
          requiresAttention: false,
          attentionReason: null,
          updatedAt: staleTimestamp,
          lastActivityAt: staleTimestamp,
        }),
        thread({
          id: "second",
          title: "Second stale thread",
          requiresAttention: false,
          attentionReason: null,
          updatedAt: staleTimestamp,
          lastActivityAt: staleTimestamp,
        }),
      ],
      vi.fn(),
      onArchive,
    );

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Show stale threads" }).props.onPress();
    });
    act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: "Archive First stale thread" })
        .props.onPress();
    });
    await act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: "Confirm archive First stale thread" })
        .props.onPress();
      await Promise.resolve();
    });

    const competingArchive = renderer.root.findByProps({
      accessibilityLabel: "Archive Second stale thread",
    });
    expect(competingArchive.props.disabled).toBe(true);
    act(() => competingArchive.props.onPress());
    expect(onArchive).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveArchive?.();
      await Promise.resolve();
    });

    expect(() => findCard(renderer, "First stale thread")).toThrow();
    expect(findCard(renderer, "Second stale thread")).toBeTruthy();
    expect(
      renderer.root.findByProps({ accessibilityLabel: "Archive Second stale thread" }).props
        .disabled,
    ).toBe(false);

    act(() => renderer.unmount());
  });

  it("exposes switch and compact tab state to assistive technology", () => {
    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = create(
        <ThreadBoardView
          theme={theme}
          layout={{ compact: true, platform: "web" }}
          host={{ id: "host-1", label: "Studio" }}
          navigation={{ openAgent: vi.fn(), openWorkspace: vi.fn() }}
          threads={[thread()]}
          status="ready"
          error={null}
          refreshing={false}
          onRefresh={vi.fn()}
          onArchive={vi.fn(async () => undefined)}
        />,
      );
    });

    const subagents = renderer?.root.findByProps({
      accessibilityLabel: "Include subagent threads",
    });
    expect(subagents?.props.accessibilityState).toEqual({ checked: false });
    expect(subagents?.props["aria-checked"]).toBe(false);

    const selectedTab = renderer?.root.findByProps({ accessibilityLabel: "Needs You, 1 thread" });
    expect(selectedTab?.props.accessibilityState).toEqual({ selected: true });
    expect(selectedTab?.props["aria-selected"]).toBe(true);
    expect(selectedTab?.props["aria-controls"]).toBe("thread-board-panel-attention");
    expect(renderer?.root.findByProps({ role: "tabpanel" }).props.nativeID).toBe(
      "thread-board-panel-attention",
    );

    act(() => renderer?.unmount());
  });

  it("renders loading, recoverable error, and empty-lane states", () => {
    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = create(
        <ThreadBoardView
          theme={theme}
          layout={{ compact: false, platform: "android" }}
          host={{ id: "host-1", label: "Studio" }}
          threads={[]}
          status="loading"
          error={null}
          refreshing={false}
          onRefresh={vi.fn()}
          onArchive={vi.fn(async () => undefined)}
        />,
      );
    });
    expect(renderer?.root.findByProps({ children: "Loading threads…" })).toBeTruthy();

    act(() => {
      renderer?.update(
        <ThreadBoardView
          theme={theme}
          layout={{ compact: false, platform: "android" }}
          host={{ id: "host-1", label: "Studio" }}
          threads={[]}
          status="error"
          error="Host unavailable."
          refreshing={false}
          onRefresh={vi.fn()}
          onArchive={vi.fn(async () => undefined)}
        />,
      );
    });
    expect(renderer?.root.findByProps({ accessibilityRole: "alert" })).toBeTruthy();
    expect(renderer?.root.findAllByProps({ children: "No threads here" })).toHaveLength(3);

    act(() => renderer?.unmount());
  });

  it("registers the board through Paseo's public plugin contribution API", () => {
    const cleanups = [vi.fn(), vi.fn(), vi.fn()];
    const client = {
      addSurface: vi.fn(() => cleanups[0]),
      addSidebarItem: vi.fn(() => cleanups[1]),
      addCommandCenterItem: vi.fn(() => cleanups[2]),
    };

    const cleanup = contribute(client as never);

    expect(client.addSurface).toHaveBeenCalledWith("thread-board", expect.any(Function));
    expect(client.addSidebarItem).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Thread Board", surface: "thread-board" }),
    );
    expect(client.addCommandCenterItem).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Open Thread Board", context: "global" }),
    );

    cleanup();
    expect(cleanups.every((fn) => fn.mock.calls.length === 1)).toBe(true);
  });
});
