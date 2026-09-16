import type { ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import contribute from "../index.client";
import type { BoardItem, BoardThread } from "../shared/board";
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
      data: BoardItem[];
      renderItem(input: { item: BoardItem; index: number }): ReactNode;
      ListEmptyComponent?: ReactNode;
    }) =>
      createElement(
        "FlatList",
        props,
        data.length > 0
          ? data.map((item, index) => renderItem({ item, index }))
          : ListEmptyComponent,
      ),
    Platform: { OS: "web" },
    Pressable: "Pressable",
    ScrollView: "ScrollView",
    Text: "Text",
    TextInput: "TextInput",
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
    attentionTimestamp: freshTimestamp,
    pendingPermissionCount: 0,
    parentAgentId: null,
    workspaceId: null,
    projectName: "Paseo",
    workspaceName: "thread-board",
    provider: "openai",
    model: "gpt-5",
    createdAt: freshTimestamp,
    updatedAt: freshTimestamp,
    lastMessageAt: freshTimestamp,
    workflowState: null,
    workflowAttentionReason: null,
    ...overrides,
  };
}

function renderBoard(
  threads: readonly BoardThread[],
  openAgent = vi.fn(),
  onArchive: (threadId: string) => Promise<void> = vi.fn(async () => undefined),
  onPause: (threads: readonly BoardThread[]) => void = vi.fn(),
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
        onPause={onPause}
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

function openViewOptions(renderer: ReactTestRenderer) {
  act(() => {
    renderer.root.findByProps({ accessibilityLabel: "Open view options" }).props.onPress();
  });
}

describe("Thread Board happy path", () => {
  it("opens thread actions on right-click and moves eligible work to Paused", () => {
    const onPause = vi.fn();
    const openAgent = vi.fn();
    const finished = thread({ title: "Review the release" });
    const renderer = renderBoard(
      [finished],
      openAgent,
      vi.fn(async () => undefined),
      onPause,
    );
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    expect(() =>
      renderer.root.findByProps({ accessibilityLabel: "Pause Review the release" }),
    ).toThrow();

    act(() => {
      findCard(renderer, "Review the release").props.onContextMenu({
        preventDefault,
        stopPropagation,
      });
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(openAgent).not.toHaveBeenCalled();
    expect(
      renderer.root.findByProps({ accessibilityLabel: "Open Review the release" }),
    ).toBeTruthy();

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Pause Review the release" }).props.onPress();
    });

    expect(onPause).toHaveBeenCalledWith([finished]);
    expect(
      renderer.root.find(
        (node) =>
          String(node.type) === "Text" &&
          Array.isArray(node.props.children) &&
          node.props.children.join("") ===
            "Paused Review the release. New activity will return it to the active board.",
      ),
    ).toBeTruthy();
    expect(() =>
      renderer.root.findByProps({ accessibilityLabel: "Pause Review the release" }),
    ).toThrow();

    act(() => renderer.unmount());
  });

  it("opens the same thread actions on long-press without opening the thread", () => {
    const openAgent = vi.fn();
    const renderer = renderBoard([thread()], openAgent);

    act(() => {
      findCard(renderer, "Review the release").props.onLongPress();
    });

    expect(openAgent).not.toHaveBeenCalled();
    expect(
      renderer.root.findByProps({ accessibilityLabel: "Open Review the release" }),
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ accessibilityLabel: "Pause Review the release" }),
    ).toBeTruthy();

    act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: "Close actions for Review the release" })
        .props.onPress();
    });
    expect(() =>
      renderer.root.findByProps({ accessibilityLabel: "Open Review the release" }),
    ).toThrow();

    act(() => renderer.unmount());
  });

  it("keeps Pause out of a running thread's actions", () => {
    const renderer = renderBoard([
      thread({
        title: "Run release checks",
        status: "running",
        requiresAttention: false,
        attentionReason: null,
      }),
    ]);

    act(() => {
      findCard(renderer, "Run release checks").props.onContextMenu({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      });
    });

    expect(
      renderer.root.findByProps({ accessibilityLabel: "Open Run release checks" }),
    ).toBeTruthy();
    expect(() =>
      renderer.root.findByProps({ accessibilityLabel: "Pause Run release checks" }),
    ).toThrow();

    act(() => renderer.unmount());
  });

  it("opens view options and switches to a filterable list", () => {
    const renderer = renderBoard([
      thread({ id: "release", title: "Review the release" }),
      thread({
        id: "migration",
        title: "Resolve migration failure",
        status: "running",
        requiresAttention: false,
        attentionReason: null,
      }),
    ]);

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Open view options" }).props.onPress();
    });
    expect(renderer.root.findByProps({ accessibilityLabel: "Show subagents" })).toBeTruthy();
    expect(renderer.root.findByProps({ accessibilityLabel: "Show stale" })).toBeTruthy();

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "List view" }).props.onPress();
    });
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Filter running state" }).props.onPress();
    });
    expect(findCard(renderer, "Resolve migration failure")).toBeTruthy();
    expect(() => findCard(renderer, "Review the release")).toThrow();

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Filter all state" }).props.onPress();
    });
    act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: "Filter threads" })
        .props.onChangeText("migration");
    });

    expect(findCard(renderer, "Resolve migration failure")).toBeTruthy();
    expect(() => findCard(renderer, "Review the release")).toThrow();

    act(() => renderer.unmount());
  });

  it("keeps matching tabs with their parent context and clears list filters together", () => {
    const renderer = renderBoard([
      thread({
        id: "urgent-tab",
        title: "Approve the release",
        workspaceId: "release-workspace",
        workspaceName: "Release 0.8",
        createdAt: "2026-09-10T08:00:00.000Z",
        pendingPermissionCount: 1,
      }),
      thread({
        id: "running-tab",
        title: "Run release verification",
        workspaceId: "release-workspace",
        workspaceName: "Release 0.8",
        createdAt: "2026-09-11T08:00:00.000Z",
        status: "running",
        requiresAttention: false,
        attentionReason: null,
      }),
      thread({
        id: "idle-tab",
        title: "Write release notes",
        workspaceId: "release-workspace",
        workspaceName: "Release 0.8",
        createdAt: "2026-09-12T08:00:00.000Z",
        requiresAttention: false,
        attentionReason: null,
      }),
    ]);

    openViewOptions(renderer);
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "List view" }).props.onPress();
    });
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Filter running state" }).props.onPress();
    });
    act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: "Filter threads" })
        .props.onChangeText("verification");
    });

    expect(findCard(renderer, "Release 0.8")).toBeTruthy();
    expect(findCard(renderer, "Run release verification")).toBeTruthy();
    expect(() => findCard(renderer, "Approve the release")).toThrow();
    expect(() => findCard(renderer, "Write release notes")).toThrow();
    expect(
      renderer.root
        .findAll(
          (node) =>
            typeof node.props.accessibilityLabel === "string" &&
            typeof node.props.accessibilityHint === "string" &&
            node.props.accessibilityHint.startsWith("Opens"),
        )
        .map((node) => node.props.accessibilityLabel),
    ).toEqual([
      expect.stringMatching(/^Release 0\.8,/),
      expect.stringMatching(/^Run release verification,/),
    ]);
    expect(renderer.root.findByProps({ children: "1 result · 1 parent included" })).toBeTruthy();

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Clear list filters" }).props.onPress();
    });
    expect(renderer.root.findByProps({ accessibilityLabel: "Filter threads" }).props.value).toBe(
      "",
    );
    expect(
      renderer.root.findByProps({ accessibilityLabel: "Filter all state" }).props
        .accessibilityState,
    ).toEqual({ checked: true });
    expect(findCard(renderer, "Approve the release")).toBeTruthy();
    expect(findCard(renderer, "Write release notes")).toBeTruthy();

    act(() => renderer.unmount());
  });

  it("offers an accurate retry when persisted view options cannot load", () => {
    const retry = vi.fn();
    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = create(
        <ThreadBoardView
          theme={theme}
          layout={{ compact: false, platform: "web" }}
          host={{ id: "host-1", label: "Studio" }}
          threads={[thread()]}
          status="ready"
          error={null}
          refreshing={false}
          onRefresh={vi.fn()}
          onArchive={vi.fn(async () => undefined)}
          viewOptionsReady={false}
          viewOptionsError="Host unavailable."
          viewOptionsErrorKind="load"
          onReloadViewOptions={retry}
        />,
      );
    });

    openViewOptions(renderer as ReactTestRenderer);
    expect(renderer?.root.findByProps({ accessibilityLabel: "Kanban view" }).props.disabled).toBe(
      true,
    );
    expect(
      renderer?.root.findByProps({ accessibilityRole: "alert" }).props.children.join(""),
    ).toContain("View options could not be loaded. Host unavailable.");

    act(() => {
      renderer?.root
        .findByProps({ accessibilityLabel: "Retry loading view options" })
        .props.onPress();
    });
    expect(retry).toHaveBeenCalledOnce();

    act(() => renderer?.unmount());
  });

  it("rolls tabs up under one parent while each tab keeps its own lane and destination", () => {
    const openAgent = vi.fn();
    const staleTimestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString();
    const renderer = renderBoard(
      [
        thread({
          id: "idle-tab",
          title: "Release readiness",
          workspaceId: "release-workspace",
          workspaceName: "Release 0.8",
          createdAt: "2026-09-10T08:00:00.000Z",
          requiresAttention: false,
          attentionReason: null,
        }),
        thread({
          id: "urgent-tab",
          title: "Approve the publish",
          workspaceId: "release-workspace",
          workspaceName: "Release 0.8",
          createdAt: "2026-09-11T08:00:00.000Z",
          pendingPermissionCount: 1,
        }),
        thread({
          id: "stale-tab",
          title: "Old release view",
          workspaceId: "release-workspace",
          workspaceName: "Release 0.8",
          createdAt: "2026-09-12T08:00:00.000Z",
          requiresAttention: false,
          attentionReason: null,
          lastMessageAt: staleTimestamp,
        }),
      ],
      openAgent,
    );

    const parent = renderer.root.find(
      (node) =>
        typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Release 0.8, thread group with 3 tabs"),
    );
    expect(parent.props.accessibilityLabel).toContain("opens the Needs You tab");
    expect(findCard(renderer, "Approve the publish").props.accessibilityLabel).toContain(
      "tab of Release 0.8",
    );
    const idleTab = renderer.root.find(
      (node) =>
        typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Release readiness, tab of Release 0.8"),
    );
    expect(() => findCard(renderer, "Old release view")).toThrow();

    act(() => parent.props.onPress());
    expect(openAgent).toHaveBeenLastCalledWith({ agentId: "urgent-tab" });

    act(() => idleTab.props.onPress());
    expect(openAgent).toHaveBeenLastCalledWith({ agentId: "idle-tab" });

    openViewOptions(renderer);
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Show stale" }).props.onPress();
    });
    expect(findCard(renderer, "Old release view").props.accessibilityLabel).toContain(
      "tab of Release 0.8",
    );
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === "Text" &&
          Array.isArray(node.props.children) &&
          node.props.children.join("") === "Tab of Release 0.8",
      ),
    ).toHaveLength(3);

    act(() => renderer.unmount());
  });

  it("shows one Paused parent for one current and two stale tabs without counting subagents", () => {
    const staleTimestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString();
    const renderer = renderBoard([
      thread({
        id: "celld-idle",
        title: "Tell me about the TinyCloud update",
        workspaceId: "celld-workspace",
        workspaceName: "Design TinyCloud 2.0 with celld",
        requiresAttention: false,
        attentionReason: null,
      }),
      thread({
        id: "celld-stale-one",
        title: "TinyCloud document sync",
        workspaceId: "celld-workspace",
        workspaceName: "Design TinyCloud 2.0 with celld",
        requiresAttention: false,
        attentionReason: null,
        lastMessageAt: staleTimestamp,
      }),
      thread({
        id: "celld-stale-two",
        title: "https://celld.dev/",
        workspaceId: "celld-workspace",
        workspaceName: "Design TinyCloud 2.0 with celld",
        requiresAttention: false,
        attentionReason: null,
        lastMessageAt: staleTimestamp,
      }),
      thread({
        id: "celld-subagent",
        title: "Run celld verification",
        workspaceId: "celld-workspace",
        workspaceName: "Design TinyCloud 2.0 with celld",
        parentAgentId: "celld-idle",
        status: "running",
        requiresAttention: false,
        attentionReason: null,
      }),
    ]);

    const parent = renderer.root.find(
      (node) =>
        typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith(
          "Design TinyCloud 2.0 with celld, thread group with 3 tabs",
        ),
    );
    expect(parent.props.accessibilityLabel).toContain("opens the Paused tab, Paused");
    expect(
      findCard(renderer, "Tell me about the TinyCloud update").props.accessibilityLabel,
    ).toContain("tab of Design TinyCloud 2.0 with celld");
    expect(() => findCard(renderer, "TinyCloud document sync")).toThrow();
    expect(() => findCard(renderer, "https://celld.dev/")).toThrow();
    expect(() => findCard(renderer, "Run celld verification")).toThrow();

    openViewOptions(renderer);
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Show stale" }).props.onPress();
    });
    expect(findCard(renderer, "TinyCloud document sync").props.accessibilityLabel).toContain(
      "tab of Design TinyCloud 2.0 with celld",
    );
    expect(findCard(renderer, "https://celld.dev/").props.accessibilityLabel).toContain(
      "tab of Design TinyCloud 2.0 with celld",
    );

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Show subagents" }).props.onPress();
    });
    expect(
      renderer.root.findAll(
        (node) =>
          typeof node.props.accessibilityLabel === "string" &&
          node.props.accessibilityLabel.startsWith(
            "Design TinyCloud 2.0 with celld, thread group with 3 tabs",
          ),
      ),
    ).toHaveLength(1);
    expect(findCard(renderer, "Run celld verification").props.accessibilityLabel).not.toContain(
      "tab of Design TinyCloud 2.0 with celld",
    );

    act(() => renderer.unmount());
  });

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
          lastMessageAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString(),
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

    openViewOptions(renderer);
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Show subagents" }).props.onPress();
    });
    expect(findCard(renderer, "Run verification")).toBeTruthy();

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Show stale" }).props.onPress();
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
      lastMessageAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString(),
    });
    const renderer = renderBoard([staleThread], vi.fn(), onArchive);

    openViewOptions(renderer);
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Show stale" }).props.onPress();
    });
    act(() => {
      findCard(renderer, "Old migration").props.onContextMenu({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      });
    });
    act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: "Archive Old migration from actions" })
        .props.onPress();
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
          lastMessageAt: staleTimestamp,
        }),
      ],
      vi.fn(),
      onArchive,
    );

    openViewOptions(renderer);
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Show stale" }).props.onPress();
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
          lastMessageAt: staleTimestamp,
        }),
        thread({
          id: "second",
          title: "Second stale thread",
          requiresAttention: false,
          attentionReason: null,
          updatedAt: staleTimestamp,
          lastMessageAt: staleTimestamp,
        }),
      ],
      vi.fn(),
      onArchive,
    );

    openViewOptions(renderer);
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: "Show stale" }).props.onPress();
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
    expect(competingArchive.props.style({ pressed: false })).toContainEqual({ opacity: 0.45 });
    const cancelCurrentArchive = renderer.root.findByProps({
      accessibilityLabel: "Cancel archiving First stale thread",
    });
    expect(cancelCurrentArchive.props.disabled).toBe(true);
    expect(cancelCurrentArchive.props.style({ pressed: false })).toContainEqual({ opacity: 0.45 });
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

  it("exposes view checkbox and compact tab state to assistive technology", () => {
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

    openViewOptions(renderer as ReactTestRenderer);
    const subagents = renderer?.root.findByProps({ accessibilityLabel: "Show subagents" });
    expect(subagents?.props.accessibilityState).toEqual({ checked: false });
    expect(subagents?.props["aria-checked"]).toBe(false);

    const selectedTab = renderer?.root.findByProps({ accessibilityLabel: "Needs You, 1 item" });
    expect(selectedTab?.props.accessibilityState).toEqual({ selected: true });
    expect(selectedTab?.props["aria-selected"]).toBe(true);
    expect(selectedTab?.props["aria-controls"]).toBe("thread-board-panel-attention");
    expect(renderer?.root.findByProps({ role: "tabpanel" }).props.nativeID).toBe(
      "thread-board-panel-attention",
    );

    act(() => renderer?.unmount());
  });

  it("uses the native control-height floor for iOS and Android layouts", () => {
    for (const [platform, expectedHeight] of [
      ["ios", 44],
      ["android", 48],
    ] as const) {
      let renderer: ReactTestRenderer | undefined;
      act(() => {
        renderer = create(
          <ThreadBoardView
            theme={theme}
            layout={{ compact: true, platform }}
            host={{ id: "host-1", label: "Studio" }}
            threads={[thread()]}
            status="ready"
            error={null}
            refreshing={false}
            onRefresh={vi.fn()}
            onArchive={vi.fn(async () => undefined)}
          />,
        );
      });

      openViewOptions(renderer as ReactTestRenderer);
      const viewButtonStyles = renderer?.root
        .findByProps({ accessibilityLabel: "Close view options" })
        .props.style({ pressed: false });
      const checkboxStyles = renderer?.root
        .findByProps({ accessibilityLabel: "Show subagents" })
        .props.style({ pressed: false });
      expect(viewButtonStyles).toContainEqual(
        expect.objectContaining({ minHeight: expectedHeight }),
      );
      expect(checkboxStyles).toContainEqual(expect.objectContaining({ minHeight: expectedHeight }));

      act(() => {
        renderer?.root.findByProps({ accessibilityLabel: "List view" }).props.onPress();
      });
      act(() => {
        renderer?.root.findByProps({ accessibilityLabel: "Filter running state" }).props.onPress();
      });
      const clearFilterStyles = renderer?.root
        .findByProps({ accessibilityLabel: "Clear list filters" })
        .props.style({ pressed: false });
      expect(clearFilterStyles).toContainEqual(
        expect.objectContaining({ minHeight: expectedHeight }),
      );

      act(() => renderer?.unmount());
    }
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
    expect(renderer?.root.findAllByProps({ children: "No items here" })).toHaveLength(3);

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
