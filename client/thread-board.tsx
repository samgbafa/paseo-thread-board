/*
THESIS: Live agent state becomes a calm thread-first dispatch board, never a second task tracker.
OWN-WORLD: Paseo theme tokens, low-chrome lanes, compact status marks, and native controls.
STORY: Choose the right density, find urgent threads, then open the exact parent or tab in one action.
FIRST VIEWPORT: A persisted Kanban or hierarchical searchable list holds urgent roll-up parents with their matching child tabs; compact Kanban shows one lane at a time.
FORM: Local extension of the established Thread Board form; no concept roll by local-extension contract.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
*/
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { usePaseo } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import {
  type BoardItem,
  type BoardThread,
  boardItems,
  countChildren,
  groupThreads,
  isStale,
  LANE_TITLES,
  LANES,
  type LaneId,
  laneOf,
  relativeAge,
  stateLabel,
  visibleThreads,
} from "../shared/board";
import { DEFAULT_NAME_ALIASES } from "../shared/name-aliases";
import {
  applyNameAliases,
  type BoardNameSuggestion,
  type BoardNameTarget,
  collectNameTargets,
  mergeNameSuggestions,
} from "../shared/naming";
import {
  DEFAULT_VIEW_OPTIONS,
  type ThreadBoardViewOptions,
  type ViewMode,
} from "../shared/view-options";
import { generateBoardNames } from "./generate-board-names";
import { RenameBoardModal } from "./rename-board-modal";
import { usePersistedNameAliases } from "./use-name-aliases";
import { useThreadDirectory } from "./use-thread-directory";
import { useThreadWorkflow } from "./use-thread-workflow";
import { usePersistedViewOptions } from "./use-view-options";
import { webContextMenuProps } from "./web";

const CLOCK_INTERVAL_MS = 30_000;

const LIST_LANE_PRIORITY: Record<LaneId, number> = {
  attention: 0,
  running: 1,
  paused: 2,
};

interface ThreadBoardViewProps extends PluginSurfaceProps {
  threads: readonly BoardThread[];
  status: "loading" | "ready" | "error";
  error: string | null;
  refreshing: boolean;
  onRefresh(): void;
  onArchive(threadId: string): Promise<void>;
  onPause?(threads: readonly BoardThread[]): void;
  onObserveThreads?(threads: readonly BoardThread[]): void;
  workflowReady?: boolean;
  workflowSaving?: boolean;
  workflowError?: string | null;
  workflowErrorKind?: "load" | "save" | null;
  onReloadWorkflow?(): void;
  viewOptions?: ThreadBoardViewOptions;
  viewOptionsReady?: boolean;
  viewOptionsSaving?: boolean;
  viewOptionsError?: string | null;
  viewOptionsErrorKind?: "load" | "save" | null;
  onViewOptionsChange?(options: ThreadBoardViewOptions): void;
  onReloadViewOptions?(): void;
  renameTargets?: readonly BoardNameTarget[];
  nameAliasesReady?: boolean;
  nameAliasesSaving?: boolean;
  nameAliasesError?: string | null;
  savedNameCount?: number;
  onReloadNameAliases?(): void;
  onGenerateNames?(): Promise<readonly BoardNameSuggestion[]>;
  onApplyNames?(suggestions: readonly BoardNameSuggestion[]): Promise<void>;
  onRestoreNames?(): Promise<void>;
}

interface ListSection {
  id: string;
  root: BoardItem;
  children: readonly BoardItem[];
}

function laneColor(lane: LaneId, theme: PluginSurfaceProps["theme"]): string {
  if (lane === "attention") return theme.colors.statusWarning;
  if (lane === "running") return theme.colors.statusSuccess;
  return theme.colors.foregroundMuted;
}

function threadStatusColor(
  thread: BoardThread,
  now: number,
  theme: PluginSurfaceProps["theme"],
): string {
  const lane = laneOf(thread, now);
  if (
    lane === "attention" &&
    (thread.status === "error" ||
      thread.attentionReason === "error" ||
      thread.workflowAttentionReason === "error")
  ) {
    return theme.colors.statusDanger;
  }
  return laneColor(lane, theme);
}

function placement(thread: BoardThread): string {
  const workspace = thread.workspaceName?.trim();
  return workspace && workspace !== thread.projectName
    ? `${thread.projectName} / ${workspace}`
    : thread.projectName;
}

function modelLabel(thread: BoardThread): string {
  return thread.model ? `${thread.provider} · ${thread.model}` : thread.provider;
}

export function ThreadBoardSurface(props: PluginSurfaceProps) {
  const paseo = usePaseo();
  const directory = useThreadDirectory(paseo, props.host.id);
  const workflow = useThreadWorkflow(directory.threads);
  const viewOptions = usePersistedViewOptions();
  const nameAliases = usePersistedNameAliases();
  const renameTargets = useMemo(
    () => collectNameTargets(workflow.threads, nameAliases.aliases),
    [nameAliases.aliases, workflow.threads],
  );
  const namedThreads = useMemo(
    () => applyNameAliases(workflow.threads, nameAliases.aliases),
    [nameAliases.aliases, workflow.threads],
  );
  const savedNameCount =
    Object.keys(nameAliases.aliases.agentNames).length +
    Object.keys(nameAliases.aliases.workspaceNames).length;
  return (
    <ThreadBoardView
      {...props}
      {...directory}
      threads={namedThreads}
      onRefresh={directory.refresh}
      onArchive={async (threadId) => {
        await paseo.agents.ref(threadId).archive();
      }}
      viewOptions={viewOptions.options}
      viewOptionsReady={viewOptions.ready}
      viewOptionsSaving={viewOptions.saving}
      viewOptionsError={viewOptions.error}
      viewOptionsErrorKind={viewOptions.errorKind}
      onViewOptionsChange={viewOptions.update}
      onReloadViewOptions={() => void viewOptions.reload()}
      renameTargets={renameTargets}
      nameAliasesReady={nameAliases.ready}
      nameAliasesSaving={nameAliases.saving}
      nameAliasesError={nameAliases.errorKind === "load" ? nameAliases.error : null}
      savedNameCount={savedNameCount}
      onReloadNameAliases={() => void nameAliases.reload()}
      onGenerateNames={() => generateBoardNames(paseo, renameTargets)}
      onApplyNames={(suggestions) =>
        nameAliases.update(mergeNameSuggestions(nameAliases.aliases, renameTargets, suggestions))
      }
      onRestoreNames={() => nameAliases.update(DEFAULT_NAME_ALIASES)}
      onPause={workflow.pause}
      onObserveThreads={workflow.observe}
      workflowReady={workflow.ready}
      workflowSaving={workflow.saving}
      workflowError={workflow.error}
      workflowErrorKind={workflow.errorKind}
      onReloadWorkflow={() => void workflow.reload()}
    />
  );
}

export function ThreadBoardView({
  theme,
  layout,
  host,
  navigation,
  threads,
  status,
  error,
  refreshing,
  onRefresh,
  onArchive,
  onPause,
  onObserveThreads,
  workflowReady = true,
  workflowSaving = false,
  workflowError = null,
  workflowErrorKind = null,
  onReloadWorkflow,
  viewOptions: controlledViewOptions,
  viewOptionsReady = true,
  viewOptionsSaving = false,
  viewOptionsError = null,
  viewOptionsErrorKind = null,
  onViewOptionsChange,
  onReloadViewOptions,
  renameTargets = [],
  nameAliasesReady = true,
  nameAliasesSaving = false,
  nameAliasesError = null,
  savedNameCount = 0,
  onReloadNameAliases,
  onGenerateNames,
  onApplyNames,
  onRestoreNames,
}: ThreadBoardViewProps) {
  const [localViewOptions, setLocalViewOptions] = useState(DEFAULT_VIEW_OPTIONS);
  const viewOptions = controlledViewOptions ?? localViewOptions;
  const { includeSubagents, showStale, viewMode } = viewOptions;
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const [listLane, setListLane] = useState<"all" | LaneId>("all");
  const [compactLane, setCompactLane] = useState<LaneId>("attention");
  const [now, setNow] = useState(() => Date.now());
  const [cardActionsId, setCardActionsId] = useState<string | null>(null);
  const [confirmingArchiveId, setConfirmingArchiveId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const archiveInFlightId = useRef<string | null>(null);
  const [locallyArchivedIds, setLocallyArchivedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);
  const [workflowNotice, setWorkflowNotice] = useState<string | null>(null);
  const [namingNotice, setNamingNotice] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const changeViewOptions = useCallback(
    (patch: Partial<ThreadBoardViewOptions>) => {
      const next = { ...viewOptions, ...patch };
      if (controlledViewOptions === undefined) setLocalViewOptions(next);
      onViewOptionsChange?.(next);
    },
    [controlledViewOptions, onViewOptionsChange, viewOptions],
  );

  const styles = useMemo(() => {
    const colors = theme.colors;
    const gutter = layout.compact ? 12 : 20;
    const controlHeight = layout.platform === "android" ? 48 : 44;
    return {
      screen: {
        flex: 1,
        width: "100%" as const,
        minHeight: "100%" as const,
        backgroundColor: colors.surface0,
      },
      header: {
        paddingHorizontal: gutter,
        paddingTop: layout.compact ? 14 : 18,
        paddingBottom: 12,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      },
      headingRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 12,
      },
      headingBody: { flex: 1, minWidth: 0 },
      headingActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
      title: {
        color: colors.foreground,
        fontSize: layout.compact ? 20 : 24,
        fontWeight: "700" as const,
        letterSpacing: -0.35,
      },
      summary: { color: colors.foregroundMuted, fontSize: 13, marginTop: 3 },
      refresh: {
        width: controlHeight,
        height: controlHeight,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      },
      pressed: { opacity: 0.62 },
      viewOptionsButton: {
        minHeight: controlHeight,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        gap: 7,
      },
      viewOptionsButtonOpen: {
        borderColor: colors.foregroundMuted,
        backgroundColor: colors.surface2,
      },
      viewOptionsButtonText: { color: colors.foreground, fontSize: 13, fontWeight: "600" as const },
      renameButton: {
        minHeight: controlHeight,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.accent,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        gap: 7,
      },
      renameButtonCompact: { alignSelf: "stretch" as const },
      renameButtonText: { color: colors.foreground, fontSize: 13, fontWeight: "600" as const },
      viewOptionsPanel: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.surface1,
        padding: 12,
        gap: 12,
      },
      viewOptionsSection: { gap: 8 },
      viewOptionsLabelRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        minHeight: 20,
      },
      viewOptionsLabel: {
        flex: 1,
        color: colors.foregroundMuted,
        fontSize: 11,
        fontWeight: "600" as const,
      },
      saveState: { color: colors.foregroundMuted, fontSize: 11 },
      viewModeGroup: {
        alignSelf: "flex-start" as const,
        flexDirection: "row" as const,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        overflow: "hidden" as const,
      },
      viewModeOption: {
        minHeight: controlHeight,
        minWidth: layout.compact ? 116 : 128,
        paddingHorizontal: 14,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        gap: 7,
      },
      viewModeOptionDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
      viewModeOptionOn: { backgroundColor: colors.surface2 },
      viewModeText: { color: colors.foregroundMuted, fontSize: 13, fontWeight: "500" as const },
      viewModeTextOn: { color: colors.foreground, fontSize: 13, fontWeight: "600" as const },
      checkboxGroup: {
        flexDirection: layout.compact ? ("column" as const) : ("row" as const),
        flexWrap: "wrap" as const,
        gap: 8,
      },
      checkboxOption: {
        minHeight: controlHeight,
        ...(layout.compact ? {} : { width: 280 }),
        paddingHorizontal: 10,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 9,
      },
      checkbox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: colors.foregroundMuted,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      },
      checkboxOn: { borderColor: colors.accent, backgroundColor: colors.accent },
      checkboxLabel: { flex: 1, color: colors.foreground, fontSize: 13 },
      checkboxCount: {
        color: colors.foregroundMuted,
        fontSize: 12,
        fontVariant: ["tabular-nums" as const],
      },
      viewOptionsError: { flex: 1, color: colors.statusDanger, fontSize: 12, lineHeight: 16 },
      viewOptionsErrorRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10,
      },
      workflowErrorRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10,
        paddingHorizontal: gutter,
        paddingVertical: 10,
        backgroundColor: colors.surface1,
      },
      retryViewOptions: {
        minHeight: controlHeight,
        paddingHorizontal: 12,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: colors.statusDanger,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      },
      retryViewOptionsText: {
        color: colors.statusDanger,
        fontSize: 12,
        fontWeight: "600" as const,
      },
      error: {
        color: colors.statusDanger,
        backgroundColor: colors.surface1,
        paddingHorizontal: gutter,
        paddingVertical: 10,
        fontSize: 13,
      },
      notice: {
        color: colors.foreground,
        backgroundColor: colors.surface2,
        paddingHorizontal: gutter,
        paddingVertical: 10,
        fontSize: 13,
      },
      loading: {
        flex: 1,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        gap: 10,
        padding: 24,
      },
      loadingText: { color: colors.foregroundMuted, fontSize: 14 },
      compactTabs: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
      },
      compactTabsScroll: { flexGrow: 0, flexShrink: 0 },
      compactTab: {
        minHeight: controlHeight,
        paddingHorizontal: 13,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 7,
      },
      compactTabOn: { backgroundColor: colors.surface2, borderColor: colors.foregroundMuted },
      tabText: { color: colors.foregroundMuted, fontSize: 13 },
      tabTextOn: { color: colors.foreground, fontSize: 13, fontWeight: "600" as const },
      tabCount: {
        color: colors.foregroundMuted,
        fontSize: 12,
        fontVariant: ["tabular-nums" as const],
      },
      board: {
        flexGrow: 1,
        minWidth: "100%" as const,
        minHeight: "100%" as const,
        gap: 12,
        padding: gutter,
        alignItems: "stretch" as const,
      },
      boardScroll: { flex: 1 },
      list: { flex: 1, paddingHorizontal: gutter, paddingTop: 12 },
      listTools: { gap: 10, marginBottom: 12 },
      search: {
        minHeight: controlHeight,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        backgroundColor: colors.surface1,
        paddingHorizontal: 12,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
      },
      searchInput: {
        flex: 1,
        minWidth: 0,
        color: colors.foreground,
        fontSize: 14,
        paddingVertical: 0,
      },
      clearSearch: {
        width: controlHeight,
        height: controlHeight,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      },
      listFilters: { gap: 8 },
      listFeedback: {
        minHeight: controlHeight,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 12,
      },
      listResult: {
        flex: 1,
        color: colors.foregroundMuted,
        fontSize: 12,
        fontVariant: ["tabular-nums" as const],
      },
      clearFilters: {
        minHeight: controlHeight,
        paddingHorizontal: 12,
        borderRadius: 9,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      },
      clearFiltersText: { color: colors.accent, fontSize: 12, fontWeight: "600" as const },
      filterChip: {
        minHeight: controlHeight,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 7,
      },
      filterChipOn: { borderColor: colors.foregroundMuted, backgroundColor: colors.surface2 },
      filterChipText: { color: colors.foregroundMuted, fontSize: 13 },
      filterChipTextOn: { color: colors.foreground, fontSize: 13, fontWeight: "600" as const },
      listContent: { gap: 12, paddingBottom: gutter },
      listSection: { gap: 8 },
      lane: {
        flex: 1,
        minWidth: 250,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        backgroundColor: colors.surface1,
        overflow: "hidden" as const,
      },
      laneCompact: {
        flex: 1,
        marginHorizontal: 12,
        marginBottom: 12,
        borderWidth: 0,
        borderRadius: 0,
        backgroundColor: colors.surface0,
      },
      laneHeader: {
        minHeight: 48,
        paddingHorizontal: 14,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      },
      laneDot: { width: 8, height: 8, borderRadius: 4 },
      laneTitle: { flex: 1, color: colors.foreground, fontSize: 14, fontWeight: "600" as const },
      laneCount: {
        color: colors.foregroundMuted,
        fontSize: 12,
        fontVariant: ["tabular-nums" as const],
      },
      laneContent: { padding: 10, gap: 9 },
      laneContentCompact: { padding: 0, gap: 10 },
      laneList: { flex: 1 },
      card: {
        minHeight: 116,
        borderRadius: 12,
        backgroundColor: colors.surface0,
        overflow: "hidden" as const,
      },
      cardOpen: { padding: 12, gap: 8 },
      cardPressed: { backgroundColor: colors.surface2 },
      cardCompact: {
        backgroundColor: colors.surface1,
        borderWidth: 1,
        borderColor: colors.border,
      },
      groupCard: {
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.border,
      },
      tabCard: { marginLeft: layout.compact ? 12 : 20 },
      cardTop: { flexDirection: "row" as const, alignItems: "center" as const, gap: 7 },
      statusDot: { width: 7, height: 7, borderRadius: 4 },
      statusLabel: { flex: 1, fontSize: 11, fontWeight: "600" as const },
      staleBadge: {
        minHeight: 20,
        paddingHorizontal: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      },
      staleBadgeText: {
        color: colors.foregroundMuted,
        fontSize: 10,
        fontWeight: "600" as const,
      },
      age: {
        color: colors.foregroundMuted,
        fontSize: 11,
        fontVariant: ["tabular-nums" as const],
      },
      cardTitle: {
        color: colors.foreground,
        fontSize: 15,
        lineHeight: 20,
        fontWeight: "600" as const,
      },
      relationship: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 6,
      },
      relationshipText: {
        flex: 1,
        color: colors.foregroundMuted,
        fontSize: 11,
        lineHeight: 15,
      },
      groupRelationshipText: {
        flex: 1,
        color: colors.foreground,
        fontSize: 11,
        lineHeight: 15,
        fontWeight: "500" as const,
      },
      placement: { color: colors.foregroundMuted, fontSize: 12, lineHeight: 17 },
      cardBottom: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
      model: { flex: 1, color: colors.foregroundMuted, fontSize: 11 },
      childCount: { color: colors.foregroundMuted, fontSize: 11 },
      actionMenu: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 8,
        backgroundColor: colors.surface1,
      },
      actionMenuHeader: {
        minHeight: controlHeight,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
      },
      actionMenuTitle: {
        flex: 1,
        color: colors.foregroundMuted,
        fontSize: 11,
        fontWeight: "600" as const,
      },
      actionMenuClose: {
        width: controlHeight,
        height: controlHeight,
        borderRadius: 9,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      },
      actionMenuItems: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        justifyContent: "flex-end" as const,
        gap: 7,
      },
      actionMenuButton: {
        minHeight: controlHeight,
        paddingHorizontal: 12,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        gap: 6,
      },
      actionMenuButtonText: {
        color: colors.foreground,
        fontSize: 12,
        fontWeight: "600" as const,
      },
      archiveRow: {
        minHeight: controlHeight,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "flex-end" as const,
        gap: 7,
      },
      archivePrompt: {
        flex: 1,
        color: colors.foregroundMuted,
        fontSize: 12,
        lineHeight: 16,
      },
      archiveButton: {
        minHeight: controlHeight,
        paddingHorizontal: 10,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        gap: 6,
      },
      pauseButton: { borderColor: colors.statusWarning },
      pauseButtonText: {
        color: colors.statusWarning,
        fontSize: 12,
        fontWeight: "600" as const,
      },
      archiveButtonDanger: { borderColor: colors.statusDanger, backgroundColor: colors.surface2 },
      archiveButtonText: {
        color: colors.foregroundMuted,
        fontSize: 12,
        fontWeight: "600" as const,
      },
      archiveButtonTextDanger: {
        color: colors.statusDanger,
        fontSize: 12,
        fontWeight: "600" as const,
      },
      disabled: { opacity: 0.45 },
      empty: { paddingHorizontal: 12, paddingVertical: 20, alignItems: "center" as const, gap: 5 },
      emptyTitle: { color: colors.foreground, fontSize: 13, fontWeight: "600" as const },
      emptyCopy: { color: colors.foregroundMuted, fontSize: 12, textAlign: "center" as const },
    };
  }, [layout.compact, layout.platform, theme]);

  const availableThreads = useMemo(
    () => threads.filter((thread) => !locallyArchivedIds.has(thread.id)),
    [locallyArchivedIds, threads],
  );
  const childCounts = useMemo(() => countChildren(availableThreads), [availableThreads]);
  const eligibleThreads = useMemo(
    () => visibleThreads(availableThreads, { includeSubagents, showStale: true, now }),
    [availableThreads, includeSubagents, now],
  );
  const threadGroups = useMemo(() => groupThreads(eligibleThreads, now), [eligibleThreads, now]);
  const items = useMemo(
    () => boardItems(threadGroups, { showStale, now }),
    [now, showStale, threadGroups],
  );
  const lanes = useMemo(() => {
    const result: Record<LaneId, BoardItem[]> = {
      attention: [],
      running: [],
      paused: [],
    };
    for (const item of items) result[item.lane].push(item);
    return result;
  }, [items]);
  const shownLanes = LANES;
  const normalizedQuery = listQuery.trim().toLocaleLowerCase();
  const listSections = useMemo(() => {
    const matchesQuery = (item: BoardItem) => {
      if (!normalizedQuery) return true;
      const { thread, group } = item;
      return [
        item.kind === "group" ? group?.title : thread.title,
        thread.title,
        thread.projectName,
        thread.workspaceName,
        thread.provider,
        thread.model,
        LANE_TITLES[item.lane],
        isStale(thread, now) ? "Stale" : null,
        group?.title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalizedQuery));
    };
    const matchesLane = (item: BoardItem) => listLane === "all" || item.lane === listLane;
    const compareItems = (left: BoardItem, right: BoardItem) => {
      const urgency = LIST_LANE_PRIORITY[left.lane] - LIST_LANE_PRIORITY[right.lane];
      const activity =
        Date.parse(right.thread.lastMessageAt) - Date.parse(left.thread.lastMessageAt);
      return urgency || activity || left.id.localeCompare(right.id);
    };
    const tabsByGroup = new Map<string, BoardItem[]>();
    const roots: BoardItem[] = [];
    for (const item of items) {
      if (item.kind !== "tab" || !item.group) {
        roots.push(item);
        continue;
      }
      const tabs = tabsByGroup.get(item.group.id);
      if (tabs) tabs.push(item);
      else tabsByGroup.set(item.group.id, [item]);
    }

    const sections: ListSection[] = [];
    for (const root of roots.sort(compareItems)) {
      if (root.kind === "thread") {
        if (matchesLane(root) && matchesQuery(root)) {
          sections.push({ id: root.id, root, children: [] });
        }
        continue;
      }

      const children = (tabsByGroup.get(root.group?.id ?? "") ?? [])
        .filter((item) => matchesLane(item) && matchesQuery(item))
        .sort(compareItems);
      if (children.length > 0) {
        sections.push({ id: root.id, root, children });
      }
    }
    return sections;
  }, [items, listLane, normalizedQuery, now]);
  const listResultCount = listSections.reduce(
    (total, section) => total + (section.root.kind === "group" ? section.children.length : 1),
    0,
  );
  const listFiltersActive = listLane !== "all" || normalizedQuery.length > 0;
  const listContextParentCount = listFiltersActive
    ? listSections.filter((section) => section.root.kind === "group").length
    : 0;
  const listResultLabel = `${listResultCount} ${listFiltersActive ? (listResultCount === 1 ? "result" : "results") : listResultCount === 1 ? "thread" : "threads"}${
    listContextParentCount > 0
      ? ` · ${listContextParentCount} ${listContextParentCount === 1 ? "parent" : "parents"} included`
      : ""
  }`;
  const listLaneCounts = useMemo(() => {
    const destinations = items.filter((item) => item.kind !== "group");
    return {
      all: destinations.length,
      attention: destinations.filter((item) => item.lane === "attention").length,
      running: destinations.filter((item) => item.lane === "running").length,
      paused: destinations.filter((item) => item.lane === "paused").length,
    };
  }, [items]);
  const childTotal = availableThreads.filter((thread) => thread.parentAgentId !== null).length;
  const staleTotal = eligibleThreads.filter(
    (thread) => isStale(thread, now) && laneOf(thread, now) === "paused",
  ).length;
  const visibleThreadTotal = items.filter((item) => item.kind !== "tab").length;
  const canRename = Boolean(onGenerateNames && onApplyNames && onRestoreNames);

  const renderRenameButton = (compact = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Rename board with Luna"
      accessibilityHint="Generates clear names for all active top-level threads, tabs, and grouped parents"
      onPress={() => {
        setNamingNotice(null);
        setRenameOpen(true);
      }}
      style={({ pressed }) => [
        styles.renameButton,
        compact && styles.renameButtonCompact,
        pressed && styles.pressed,
      ]}
    >
      <Icon name="Sparkles" size={16} color={theme.colors.accent} />
      <Text style={styles.renameButtonText}>Rename board with Luna</Text>
    </Pressable>
  );

  const toggleStale = () => {
    if (showStale) {
      setCardActionsId(null);
      setConfirmingArchiveId(null);
    }
    changeViewOptions({ showStale: !showStale });
  };

  const renderViewMode = (mode: ViewMode, label: string, icon: string, divided = false) => {
    const selected = viewMode === mode;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={`${label} view`}
        accessibilityState={{ checked: selected, ...(!viewOptionsReady ? { disabled: true } : {}) }}
        disabled={!viewOptionsReady}
        onPress={() => changeViewOptions({ viewMode: mode })}
        style={({ pressed }) => [
          styles.viewModeOption,
          divided && styles.viewModeOptionDivider,
          selected && styles.viewModeOptionOn,
          !viewOptionsReady && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Icon
          name={icon}
          size={15}
          color={selected ? theme.colors.foreground : theme.colors.foregroundMuted}
        />
        <Text style={selected ? styles.viewModeTextOn : styles.viewModeText}>{label}</Text>
      </Pressable>
    );
  };

  const renderViewCheckbox = (
    label: string,
    count: number,
    enabled: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: enabled, ...(!viewOptionsReady ? { disabled: true } : {}) }}
      aria-checked={enabled}
      disabled={!viewOptionsReady}
      onPress={onPress}
      style={({ pressed }) => [
        styles.checkboxOption,
        !viewOptionsReady && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.checkbox, enabled && styles.checkboxOn]}>
        {enabled ? <Icon name="Check" size={14} color={theme.colors.accentForeground} /> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
      {count > 0 ? <Text style={styles.checkboxCount}>{count}</Text> : null}
    </Pressable>
  );

  const archiveThread = async (thread: BoardThread) => {
    if (archiveInFlightId.current !== null) return;
    archiveInFlightId.current = thread.id;
    setArchivingId(thread.id);
    setArchiveError(null);
    setArchiveNotice(null);
    try {
      await onArchive(thread.id);
      setLocallyArchivedIds((current) => new Set(current).add(thread.id));
      setCardActionsId(null);
      setConfirmingArchiveId(null);
      setArchiveNotice(`Archived ${thread.title}.`);
    } catch (cause) {
      const detail = cause instanceof Error && cause.message ? ` ${cause.message}` : "";
      setArchiveError(`Could not archive ${thread.title}.${detail}`);
    } finally {
      if (archiveInFlightId.current === thread.id) {
        archiveInFlightId.current = null;
        setArchivingId(null);
      }
    }
  };

  const renderCard = (item: BoardItem) => {
    const { thread, lane, group, kind } = item;
    const statusColor = threadStatusColor(thread, now, theme);
    const stale = isStale(thread, now);
    const children =
      kind === "group" && group
        ? group.tabs.reduce((total, tab) => total + (childCounts.get(tab.id) ?? 0), 0)
        : (childCounts.get(thread.id) ?? 0);
    const age = relativeAge(thread.lastMessageAt, now);
    const activityLabel =
      age === "now" ? "message sent now" : age ? `last message ${age} ago` : "message time unknown";
    const childLabel =
      children > 0 ? `, ${children} ${children === 1 ? "subagent" : "subagents"}` : "";
    const title = kind === "group" && group ? group.title : thread.title;
    const placementLabel = kind === "group" ? thread.projectName : placement(thread);
    const relationshipLabel =
      kind === "group" && group
        ? `thread group with ${group.tabs.length} tabs, opens the ${LANE_TITLES[group.lane]} tab`
        : kind === "tab" && group
          ? `tab of ${group.title}`
          : null;
    const accessibleDescription = `${title}, ${relationshipLabel ? `${relationshipLabel}, ` : ""}${stateLabel(thread, now)}${stale ? ", Stale" : ""}, ${placementLabel}, ${modelLabel(thread)}, ${activityLabel}${childLabel}`;
    const content = (
      <>
        <View style={styles.cardTop}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>
            {stateLabel(thread, now)}
          </Text>
          {stale ? (
            <View style={styles.staleBadge}>
              <Text style={styles.staleBadgeText}>Stale</Text>
            </View>
          ) : null}
          <Text style={styles.age}>{age}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </Text>
        {kind === "group" && group ? (
          <View style={styles.relationship}>
            <Icon name="Layers" size={13} color={theme.colors.foreground} />
            <Text style={styles.groupRelationshipText} numberOfLines={1} ellipsizeMode="tail">
              {group.tabs.length} tabs · opens {LANE_TITLES[group.lane]} tab
            </Text>
          </View>
        ) : kind === "tab" && group ? (
          <View style={styles.relationship}>
            <Icon name="CornerDownRight" size={13} color={theme.colors.foregroundMuted} />
            <Text style={styles.relationshipText} numberOfLines={1} ellipsizeMode="tail">
              Tab of {group.title}
            </Text>
          </View>
        ) : null}
        <Text style={styles.placement} numberOfLines={1} ellipsizeMode="tail">
          {placementLabel}
        </Text>
        <View style={styles.cardBottom}>
          <Text style={styles.model} numberOfLines={1} ellipsizeMode="tail">
            {modelLabel(thread)}
          </Text>
          {children > 0 ? (
            <Text style={styles.childCount}>
              {children} {children === 1 ? "subagent" : "subagents"}
            </Text>
          ) : null}
          {navigation ? (
            <Icon name="ChevronRight" size={15} color={theme.colors.foregroundMuted} />
          ) : null}
        </View>
      </>
    );

    const confirmingArchive = confirmingArchiveId === thread.id;
    const archiving = archivingId === thread.id;
    const archiveBlocked = archivingId !== null;
    const pauseTargets = kind === "group" && group ? group.tabs : [thread];
    const pauseEligible =
      lane === "attention" &&
      pauseTargets.every(
        (target) =>
          target.status !== "running" &&
          target.status !== "initializing" &&
          target.pendingPermissionCount === 0 &&
          target.attentionReason !== "permission",
      );
    const showPause = Boolean(onPause && pauseEligible);
    const showArchive = kind !== "group" && stale;
    const actionsOpen = cardActionsId === item.id;
    const openThread = () => {
      setCardActionsId(null);
      onObserveThreads?.(pauseTargets);
      navigation?.openAgent({ agentId: thread.id });
    };
    const toggleActions = () => {
      setConfirmingArchiveId(null);
      setCardActionsId((current) => (current === item.id ? null : item.id));
    };
    const pauseThread = () => {
      setCardActionsId(null);
      onPause?.(pauseTargets);
      setWorkflowNotice(`Paused ${title}. New activity will return it to the active board.`);
    };
    const requestArchive = () => {
      if (archiveBlocked) return;
      setCardActionsId(null);
      setConfirmingArchiveId(thread.id);
      setArchiveError(null);
      setArchiveNotice(null);
    };
    return (
      <View
        key={item.id}
        style={[
          styles.card,
          (layout.compact || viewMode === "list") && styles.cardCompact,
          kind === "group" && styles.groupCard,
          kind === "tab" && styles.tabCard,
        ]}
      >
        {navigation || showPause || showArchive ? (
          <Pressable
            {...webContextMenuProps(toggleActions)}
            accessibilityRole="button"
            accessibilityLabel={accessibleDescription}
            accessibilityHint={
              !navigation
                ? "Opens thread actions"
                : kind === "group"
                  ? "Opens the most urgent tab in this thread. Right-click or long-press for actions"
                  : kind === "tab"
                    ? "Opens this tab in Paseo. Right-click or long-press for actions"
                    : "Opens this thread in Paseo. Right-click or long-press for actions"
            }
            accessibilityState={{ expanded: actionsOpen }}
            delayLongPress={350}
            onLongPress={toggleActions}
            onPress={navigation ? openThread : toggleActions}
            style={({ pressed }) => [styles.cardOpen, pressed && styles.cardPressed]}
          >
            {content}
          </Pressable>
        ) : (
          <View style={styles.cardOpen}>{content}</View>
        )}
        {actionsOpen ? (
          <View
            accessibilityLabel={`Actions for ${title}`}
            accessibilityLiveRegion="polite"
            style={styles.actionMenu}
          >
            <View style={styles.actionMenuHeader}>
              <Text style={styles.actionMenuTitle} numberOfLines={1} ellipsizeMode="tail">
                Thread actions
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Close actions for ${title}`}
                onPress={() => setCardActionsId(null)}
                style={({ pressed }) => [styles.actionMenuClose, pressed && styles.pressed]}
              >
                <Icon name="X" size={16} color={theme.colors.foregroundMuted} />
              </Pressable>
            </View>
            <View style={styles.actionMenuItems}>
              {navigation ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${title}`}
                  onPress={openThread}
                  style={({ pressed }) => [styles.actionMenuButton, pressed && styles.pressed]}
                >
                  <Icon name="ExternalLink" size={14} color={theme.colors.foreground} />
                  <Text style={styles.actionMenuButtonText}>Open</Text>
                </Pressable>
              ) : null}
              {showPause ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${kind === "group" ? "Pause all tabs in" : "Pause"} ${title}`}
                  accessibilityHint="Keeps this work paused until a new action occurs"
                  accessibilityState={{ disabled: !workflowReady }}
                  disabled={!workflowReady}
                  onPress={pauseThread}
                  style={({ pressed }) => [
                    styles.actionMenuButton,
                    styles.pauseButton,
                    !workflowReady && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="Pause" size={14} color={theme.colors.statusWarning} />
                  <Text style={styles.pauseButtonText}>
                    {kind === "group" ? "Pause all" : "Pause"}
                  </Text>
                </Pressable>
              ) : null}
              {showArchive ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Archive ${thread.title} from actions`}
                  accessibilityHint="Asks for confirmation before archiving"
                  accessibilityState={{ disabled: archiveBlocked }}
                  disabled={archiveBlocked}
                  onPress={requestArchive}
                  style={({ pressed }) => [
                    styles.actionMenuButton,
                    archiveBlocked && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="Archive" size={14} color={theme.colors.foregroundMuted} />
                  <Text style={styles.archiveButtonText}>Archive</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
        {showArchive ? (
          <View style={styles.archiveRow} accessibilityLiveRegion="polite">
            {showArchive && confirmingArchive ? (
              <>
                <Text style={styles.archivePrompt}>Archive this thread?</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Cancel archiving ${thread.title}`}
                  disabled={archiving}
                  onPress={() => setConfirmingArchiveId(null)}
                  style={({ pressed }) => [
                    styles.archiveButton,
                    archiving && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.archiveButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Confirm archive ${thread.title}`}
                  accessibilityState={{ busy: archiving, disabled: archiving }}
                  disabled={archiving}
                  onPress={() => void archiveThread(thread)}
                  style={({ pressed }) => [
                    styles.archiveButton,
                    styles.archiveButtonDanger,
                    pressed && styles.pressed,
                  ]}
                >
                  {archiving ? (
                    <ActivityIndicator size="small" color={theme.colors.statusDanger} />
                  ) : (
                    <Icon name="Archive" size={14} color={theme.colors.statusDanger} />
                  )}
                  <Text style={styles.archiveButtonTextDanger}>Archive</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Archive ${thread.title}`}
                accessibilityHint="Asks for confirmation before archiving"
                accessibilityState={{ disabled: archiveBlocked }}
                disabled={archiveBlocked}
                onPress={requestArchive}
                style={({ pressed }) => [
                  styles.archiveButton,
                  archiveBlocked && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="Archive" size={14} color={theme.colors.foregroundMuted} />
                <Text style={styles.archiveButtonText}>Archive</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const renderLane = (lane: LaneId, compact = false) => {
    const laneThreads = lanes[lane];
    const laneStyle: ViewStyle[] = [styles.lane];
    if (compact) laneStyle.push(styles.laneCompact);
    const panelId = `thread-board-panel-${lane}`;
    return (
      <View
        key={lane}
        nativeID={panelId}
        role={compact && layout.platform === "web" ? "tabpanel" : undefined}
        accessibilityLabel={compact ? `${LANE_TITLES[lane]} items` : undefined}
        style={laneStyle}
      >
        {compact ? null : (
          <View style={styles.laneHeader}>
            <View style={[styles.laneDot, { backgroundColor: laneColor(lane, theme) }]} />
            <Text style={styles.laneTitle}>{LANE_TITLES[lane]}</Text>
            <Text style={styles.laneCount}>{laneThreads.length}</Text>
          </View>
        )}
        <FlatList
          style={styles.laneList}
          data={laneThreads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderCard(item)}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          contentContainerStyle={compact ? styles.laneContentCompact : styles.laneContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No items here</Text>
              <Text style={styles.emptyCopy}>
                {lane === "attention"
                  ? "Nothing needs you right now."
                  : `No ${LANE_TITLES[lane].toLowerCase()} items.`}
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headingRow}>
          <View style={styles.headingBody}>
            <Text accessibilityRole="header" style={styles.title}>
              Thread Board
            </Text>
            <Text style={styles.summary} numberOfLines={1} ellipsizeMode="tail">
              {visibleThreadTotal} {visibleThreadTotal === 1 ? "thread" : "threads"} on {host.label}
            </Text>
          </View>
          <View style={styles.headingActions}>
            {!layout.compact && canRename ? renderRenameButton() : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={viewOptionsOpen ? "Close view options" : "Open view options"}
              accessibilityState={{ expanded: viewOptionsOpen }}
              onPress={() => setViewOptionsOpen((current) => !current)}
              style={({ pressed }) => [
                styles.viewOptionsButton,
                viewOptionsOpen && styles.viewOptionsButtonOpen,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="SlidersHorizontal" size={16} color={theme.colors.foregroundMuted} />
              <Text style={styles.viewOptionsButtonText}>
                {layout.compact ? "View" : "View options"}
              </Text>
              <Icon
                name={viewOptionsOpen ? "ChevronUp" : "ChevronDown"}
                size={15}
                color={theme.colors.foregroundMuted}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh threads"
              accessibilityState={{ busy: refreshing }}
              onPress={onRefresh}
              style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <Icon name="RefreshCw" size={17} color={theme.colors.foregroundMuted} />
              )}
            </Pressable>
          </View>
        </View>
        {layout.compact && canRename ? renderRenameButton(true) : null}
        {viewOptionsOpen ? (
          <View accessibilityLabel="View options" style={styles.viewOptionsPanel}>
            <View style={styles.viewOptionsSection}>
              <View style={styles.viewOptionsLabelRow}>
                <Text style={styles.viewOptionsLabel}>VIEW AS</Text>
                <Text accessibilityLiveRegion="polite" style={styles.saveState}>
                  {!viewOptionsReady && !viewOptionsError
                    ? "Loading…"
                    : viewOptionsSaving
                      ? "Saving…"
                      : ""}
                </Text>
              </View>
              <View accessibilityRole="radiogroup" style={styles.viewModeGroup}>
                {renderViewMode("kanban", "Kanban", "Columns3")}
                {renderViewMode("list", "List", "List", true)}
              </View>
            </View>
            <View style={styles.viewOptionsSection}>
              <Text style={styles.viewOptionsLabel}>SHOW</Text>
              <View accessibilityLabel="Visible threads" style={styles.checkboxGroup}>
                {renderViewCheckbox("Show subagents", childTotal, includeSubagents, () =>
                  changeViewOptions({ includeSubagents: !includeSubagents }),
                )}
                {renderViewCheckbox("Show stale", staleTotal, showStale, toggleStale)}
              </View>
            </View>
            {viewOptionsError ? (
              <View style={styles.viewOptionsErrorRow}>
                <Text accessibilityRole="alert" style={styles.viewOptionsError}>
                  View options could not be {viewOptionsErrorKind === "load" ? "loaded" : "saved"}.{" "}
                  {viewOptionsError}
                </Text>
                {viewOptionsErrorKind === "load" && onReloadViewOptions ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading view options"
                    onPress={onReloadViewOptions}
                    style={({ pressed }) => [styles.retryViewOptions, pressed && styles.pressed]}
                  >
                    <Text style={styles.retryViewOptionsText}>Retry</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {canRename && onGenerateNames && onApplyNames && onRestoreNames ? (
        <RenameBoardModal
          theme={theme}
          layout={layout}
          open={renameOpen}
          onOpenChange={setRenameOpen}
          targets={renameTargets}
          ready={nameAliasesReady}
          saving={nameAliasesSaving}
          savedNameCount={savedNameCount}
          loadError={nameAliasesError}
          onReload={() => onReloadNameAliases?.()}
          onGenerate={onGenerateNames}
          onApply={onApplyNames}
          onRestore={onRestoreNames}
          onApplied={(count) =>
            setNamingNotice(
              `Applied ${count} ${count === 1 ? "board name" : "board names"}. Native Paseo tab titles are unchanged.`,
            )
          }
          onRestored={() => setNamingNotice("Restored original Thread Board names.")}
        />
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error} Use Refresh to try again.
        </Text>
      ) : null}

      {workflowError ? (
        <View style={styles.workflowErrorRow}>
          <Text accessibilityRole="alert" style={styles.viewOptionsError}>
            Board state could not be {workflowErrorKind === "load" ? "loaded" : "saved"}.{" "}
            {workflowError}
          </Text>
          {workflowErrorKind === "load" && onReloadWorkflow ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading board state"
              onPress={onReloadWorkflow}
              style={({ pressed }) => [styles.retryViewOptions, pressed && styles.pressed]}
            >
              <Text style={styles.retryViewOptionsText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {archiveError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {archiveError}
        </Text>
      ) : null}

      {archiveNotice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {archiveNotice}
        </Text>
      ) : null}

      {workflowNotice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {workflowSaving ? "Saving pause… " : ""}
          {workflowNotice}
        </Text>
      ) : null}

      {namingNotice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {namingNotice}
        </Text>
      ) : null}

      {status === "loading" && threads.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading threads…</Text>
        </View>
      ) : viewMode === "list" ? (
        <View style={styles.list}>
          <View style={styles.listTools}>
            <View style={styles.search}>
              <Icon name="Search" size={16} color={theme.colors.foregroundMuted} />
              <TextInput
                accessibilityLabel="Filter threads"
                placeholder="Filter threads"
                placeholderTextColor={theme.colors.foregroundMuted}
                value={listQuery}
                onChangeText={setListQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                style={styles.searchInput}
              />
              {listQuery ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear thread filter"
                  onPress={() => setListQuery("")}
                  style={({ pressed }) => [styles.clearSearch, pressed && styles.pressed]}
                >
                  <Icon name="X" size={16} color={theme.colors.foregroundMuted} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView
              horizontal
              accessibilityRole="radiogroup"
              accessibilityLabel="Filter by state"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.listFilters}
            >
              {(["all", ...shownLanes] as const).map((lane) => {
                const selected = listLane === lane;
                const label = lane === "all" ? "All" : LANE_TITLES[lane];
                const count = listLaneCounts[lane];
                return (
                  <Pressable
                    key={lane}
                    accessibilityRole="radio"
                    accessibilityLabel={`Filter ${label.toLocaleLowerCase()} state`}
                    accessibilityState={{ checked: selected }}
                    onPress={() => setListLane(lane)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      selected && styles.filterChipOn,
                      pressed && styles.pressed,
                    ]}
                  >
                    {lane === "all" ? null : (
                      <View
                        style={[styles.statusDot, { backgroundColor: laneColor(lane, theme) }]}
                      />
                    )}
                    <Text style={selected ? styles.filterChipTextOn : styles.filterChipText}>
                      {label}
                    </Text>
                    <Text style={styles.tabCount}>{count}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.listFeedback}>
              <Text accessibilityLiveRegion="polite" style={styles.listResult}>
                {listResultLabel}
              </Text>
              {listFiltersActive ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear list filters"
                  onPress={() => {
                    setListQuery("");
                    setListLane("all");
                  }}
                  style={({ pressed }) => [styles.clearFilters, pressed && styles.pressed]}
                >
                  <Text style={styles.clearFiltersText}>Clear filters</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <FlatList
            style={styles.laneList}
            data={listSections}
            keyExtractor={(section) => section.id}
            renderItem={({ item: section }) => (
              <View key={section.id} style={styles.listSection}>
                {renderCard(section.root)}
                {section.children.map((item) => renderCard(item))}
              </View>
            )}
            initialNumToRender={12}
            maxToRenderPerBatch={16}
            windowSize={9}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No matching threads</Text>
                <Text style={styles.emptyCopy}>Try another search or clear the filters.</Text>
              </View>
            }
          />
        </View>
      ) : layout.compact ? (
        <>
          <ScrollView
            horizontal
            accessibilityRole="tablist"
            aria-label="Thread status lanes"
            style={styles.compactTabsScroll}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.compactTabs}
          >
            {shownLanes.map((lane) => {
              const selected = compactLane === lane;
              return (
                <Pressable
                  key={lane}
                  accessibilityRole="tab"
                  accessibilityLabel={`${LANE_TITLES[lane]}, ${lanes[lane].length} ${lanes[lane].length === 1 ? "item" : "items"}`}
                  accessibilityState={{ selected }}
                  aria-selected={selected}
                  {...(layout.platform === "web"
                    ? ({ "aria-controls": `thread-board-panel-${lane}` } as object)
                    : {})}
                  onPress={() => setCompactLane(lane)}
                  style={({ pressed }) => [
                    styles.compactTab,
                    selected && styles.compactTabOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.laneDot, { backgroundColor: laneColor(lane, theme) }]} />
                  <Text style={selected ? styles.tabTextOn : styles.tabText}>
                    {LANE_TITLES[lane]}
                  </Text>
                  <Text style={styles.tabCount}>{lanes[lane].length}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {renderLane(compactLane, true)}
        </>
      ) : (
        <ScrollView horizontal style={styles.boardScroll} contentContainerStyle={styles.board}>
          {shownLanes.map((lane) => renderLane(lane))}
        </ScrollView>
      )}
    </View>
  );
}
