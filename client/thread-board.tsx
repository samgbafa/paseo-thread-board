/*
THESIS: Live agent state becomes a calm thread-first dispatch board, never a second task tracker.
OWN-WORLD: Paseo theme tokens, low-chrome lanes, compact status marks, and native controls.
STORY: See urgent threads, understand each tab's state, then open the right tab in one action.
FIRST VIEWPORT: Four lanes hold urgent roll-up parents and clearly referenced child tabs; compact clients show one lane at a time.
FORM: Local extension of the established Thread Board form; no concept roll by local-extension contract.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
*/
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { usePaseo } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import {
  type BoardItem,
  type BoardThread,
  boardItems,
  countChildren,
  groupThreads,
  LANE_TITLES,
  LANES,
  type LaneId,
  laneOf,
  relativeAge,
  stateLabel,
  visibleThreads,
} from "../shared/board";
import { useThreadDirectory } from "./use-thread-directory";

const CLOCK_INTERVAL_MS = 30_000;

interface ThreadBoardViewProps extends PluginSurfaceProps {
  threads: readonly BoardThread[];
  status: "loading" | "ready" | "error";
  error: string | null;
  refreshing: boolean;
  onRefresh(): void;
  onArchive(threadId: string): Promise<void>;
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
  if (lane !== "stale" && (thread.status === "error" || thread.attentionReason === "error")) {
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
  return (
    <ThreadBoardView
      {...props}
      {...directory}
      onRefresh={directory.refresh}
      onArchive={async (threadId) => {
        await paseo.agents.ref(threadId).archive();
      }}
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
}: ThreadBoardViewProps) {
  const [includeSubagents, setIncludeSubagents] = useState(false);
  const [showStale, setShowStale] = useState(false);
  const [compactLane, setCompactLane] = useState<LaneId>("attention");
  const [now, setNow] = useState(() => Date.now());
  const [confirmingArchiveId, setConfirmingArchiveId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const archiveInFlightId = useRef<string | null>(null);
  const [locallyArchivedIds, setLocallyArchivedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

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
      controls: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        gap: 8,
      },
      toggle: {
        minHeight: controlHeight,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 7,
      },
      toggleOn: {
        borderColor: colors.accent,
        backgroundColor: colors.surface2,
      },
      toggleText: { color: colors.foregroundMuted, fontSize: 13, fontWeight: "500" as const },
      toggleTextOn: { color: colors.foreground, fontSize: 13, fontWeight: "600" as const },
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
      tabCard: { marginLeft: 10 },
      cardTop: { flexDirection: "row" as const, alignItems: "center" as const, gap: 7 },
      statusDot: { width: 7, height: 7, borderRadius: 4 },
      statusLabel: { flex: 1, fontSize: 11, fontWeight: "600" as const },
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
      idle: [],
      stale: [],
    };
    for (const item of items) result[item.lane].push(item);
    return result;
  }, [items]);
  const shownLanes = showStale ? LANES : LANES.filter((lane) => lane !== "stale");
  const childTotal = availableThreads.filter((thread) => thread.parentAgentId !== null).length;
  const staleTotal = eligibleThreads.filter((thread) => laneOf(thread, now) === "stale").length;
  const activeTotal = threadGroups.filter((group) => group.lane !== "stale").length;

  const toggleStale = () => {
    setShowStale((current) => {
      if (current && compactLane === "stale") setCompactLane("attention");
      if (current) setConfirmingArchiveId(null);
      return !current;
    });
  };

  const renderToggle = (
    label: string,
    icon: string,
    enabled: boolean,
    onPress: () => void,
    accessibilityLabel: string,
  ) => (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: enabled }}
      aria-checked={enabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggle,
        enabled && styles.toggleOn,
        pressed && styles.pressed,
      ]}
    >
      <Icon
        name={icon}
        size={15}
        color={enabled ? theme.colors.accent : theme.colors.foregroundMuted}
      />
      <Text style={enabled ? styles.toggleTextOn : styles.toggleText}>{label}</Text>
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
    const accessibleDescription = `${title}, ${relationshipLabel ? `${relationshipLabel}, ` : ""}${stateLabel(thread, now)}, ${placementLabel}, ${modelLabel(thread)}, ${activityLabel}${childLabel}`;
    const content = (
      <>
        <View style={styles.cardTop}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>
            {stateLabel(thread, now)}
          </Text>
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
    return (
      <View
        key={item.id}
        style={[
          styles.card,
          layout.compact && styles.cardCompact,
          kind === "group" && styles.groupCard,
          kind === "tab" && styles.tabCard,
        ]}
      >
        {navigation ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibleDescription}
            accessibilityHint={
              kind === "group"
                ? "Opens the most urgent tab in this thread"
                : kind === "tab"
                  ? "Opens this tab in Paseo"
                  : "Opens this thread in Paseo"
            }
            onPress={() => navigation.openAgent({ agentId: thread.id })}
            style={({ pressed }) => [styles.cardOpen, pressed && styles.cardPressed]}
          >
            {content}
          </Pressable>
        ) : (
          <View style={styles.cardOpen}>{content}</View>
        )}
        {kind !== "group" && lane === "stale" ? (
          <View style={styles.archiveRow} accessibilityLiveRegion="polite">
            {confirmingArchive ? (
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
                onPress={() => {
                  if (archiveBlocked) return;
                  setConfirmingArchiveId(thread.id);
                  setArchiveError(null);
                  setArchiveNotice(null);
                }}
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
              {activeTotal} active {activeTotal === 1 ? "thread" : "threads"} on {host.label}
            </Text>
          </View>
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
        <View style={styles.controls}>
          {renderToggle(
            childTotal > 0 ? `Subagents ${childTotal}` : "Subagents",
            "Network",
            includeSubagents,
            () => setIncludeSubagents((current) => !current),
            "Include subagent threads",
          )}
          {renderToggle(
            staleTotal > 0 ? `Stale ${staleTotal}` : "Stale",
            "Archive",
            showStale,
            toggleStale,
            "Show stale threads",
          )}
        </View>
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error} Use Refresh to try again.
        </Text>
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

      {status === "loading" && threads.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading threads…</Text>
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
