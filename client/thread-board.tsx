/*
THESIS: Live agent state becomes a calm dispatch board, never a second task tracker.
OWN-WORLD: Paseo theme tokens, low-chrome lanes, compact status marks, and native controls.
STORY: See what needs attention, scan active work, then open the real thread in one action.
FIRST VIEWPORT: Identity and visibility controls lead directly into four status lanes; compact clients show one lane at a time.
FORM: An operational board extending Paseo's established interface and the user's approved lane model.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
*/
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { usePaseo } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useEffect, useMemo, useState } from "react";
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
  type BoardThread,
  countChildren,
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
}

function laneColor(lane: LaneId, theme: PluginSurfaceProps["theme"]): string {
  if (lane === "attention") return theme.colors.statusWarning;
  if (lane === "running") return theme.colors.statusSuccess;
  return theme.colors.foregroundMuted;
}

function threadStatusColor(thread: BoardThread, theme: PluginSurfaceProps["theme"]): string {
  if (thread.status === "error" || thread.attentionReason === "error") {
    return theme.colors.statusDanger;
  }
  return laneColor(laneOf(thread), theme);
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
  return <ThreadBoardView {...props} {...directory} onRefresh={directory.refresh} />;
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
}: ThreadBoardViewProps) {
  const [includeSubagents, setIncludeSubagents] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [compactLane, setCompactLane] = useState<LaneId>("attention");
  const [now, setNow] = useState(() => Date.now());

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
        padding: 12,
        gap: 8,
        borderRadius: 12,
        backgroundColor: colors.surface0,
      },
      cardPressed: { backgroundColor: colors.surface2 },
      cardCompact: {
        backgroundColor: colors.surface1,
        borderWidth: 1,
        borderColor: colors.border,
      },
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
      placement: { color: colors.foregroundMuted, fontSize: 12, lineHeight: 17 },
      cardBottom: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
      model: { flex: 1, color: colors.foregroundMuted, fontSize: 11 },
      childCount: { color: colors.foregroundMuted, fontSize: 11 },
      empty: { paddingHorizontal: 12, paddingVertical: 20, alignItems: "center" as const, gap: 5 },
      emptyTitle: { color: colors.foreground, fontSize: 13, fontWeight: "600" as const },
      emptyCopy: { color: colors.foregroundMuted, fontSize: 12, textAlign: "center" as const },
    };
  }, [layout.compact, layout.platform, theme]);

  const childCounts = useMemo(() => countChildren(threads), [threads]);
  const visible = useMemo(
    () => visibleThreads(threads, { includeSubagents, showClosed }),
    [includeSubagents, showClosed, threads],
  );
  const lanes = useMemo(() => {
    const result: Record<LaneId, BoardThread[]> = {
      attention: [],
      running: [],
      idle: [],
      closed: [],
    };
    for (const thread of visible) result[laneOf(thread)].push(thread);
    return result;
  }, [visible]);
  const shownLanes = showClosed ? LANES : LANES.filter((lane) => lane !== "closed");
  const childTotal = threads.filter((thread) => thread.parentAgentId !== null).length;
  const closedTotal = threads.filter(
    (thread) => laneOf(thread) === "closed" && (includeSubagents || thread.parentAgentId === null),
  ).length;
  const activeTotal = visible.filter((thread) => laneOf(thread) !== "closed").length;

  const toggleClosed = () => {
    setShowClosed((current) => {
      if (current && compactLane === "closed") setCompactLane("attention");
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

  const renderCard = (thread: BoardThread) => {
    const statusColor = threadStatusColor(thread, theme);
    const children = childCounts.get(thread.id) ?? 0;
    const age = relativeAge(thread.lastActivityAt, now);
    const activityLabel =
      age === "now" ? "active now" : age ? `active ${age} ago` : "activity unknown";
    const childLabel =
      children > 0 ? `, ${children} ${children === 1 ? "subagent" : "subagents"}` : "";
    const accessibleDescription = `${thread.title}, ${stateLabel(thread)}, ${placement(thread)}, ${modelLabel(thread)}, ${activityLabel}${childLabel}`;
    const content = (
      <>
        <View style={styles.cardTop}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{stateLabel(thread)}</Text>
          <Text style={styles.age}>{age}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2} ellipsizeMode="tail">
          {thread.title}
        </Text>
        <Text style={styles.placement} numberOfLines={1} ellipsizeMode="tail">
          {placement(thread)}
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

    return navigation ? (
      <Pressable
        key={thread.id}
        accessibilityRole="button"
        accessibilityLabel={accessibleDescription}
        accessibilityHint="Opens this thread in Paseo"
        onPress={() => navigation.openAgent({ agentId: thread.id })}
        style={({ pressed }) => [
          styles.card,
          layout.compact && styles.cardCompact,
          pressed && styles.cardPressed,
        ]}
      >
        {content}
      </Pressable>
    ) : (
      <View key={thread.id} style={[styles.card, layout.compact && styles.cardCompact]}>
        {content}
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
        accessibilityLabel={compact ? `${LANE_TITLES[lane]} threads` : undefined}
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
          keyExtractor={(thread) => thread.id}
          renderItem={({ item }) => renderCard(item)}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          contentContainerStyle={compact ? styles.laneContentCompact : styles.laneContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No threads here</Text>
              <Text style={styles.emptyCopy}>
                {lane === "attention"
                  ? "Nothing needs you right now."
                  : `No ${LANE_TITLES[lane].toLowerCase()} threads.`}
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
            closedTotal > 0 ? `Closed ${closedTotal}` : "Closed",
            "Archive",
            showClosed,
            toggleClosed,
            "Show closed threads",
          )}
        </View>
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error} Use Refresh to try again.
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
                  accessibilityLabel={`${LANE_TITLES[lane]}, ${lanes[lane].length} ${lanes[lane].length === 1 ? "thread" : "threads"}`}
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
