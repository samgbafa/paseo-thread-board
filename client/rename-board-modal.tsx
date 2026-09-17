import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { Icon, Modal } from "@getpaseo/plugin/client/react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { BoardNameSuggestion, BoardNameTarget } from "../shared/naming";

interface RenameBoardModalProps {
  theme: PluginSurfaceProps["theme"];
  layout: PluginSurfaceProps["layout"];
  open: boolean;
  onOpenChange(open: boolean): void;
  targets: readonly BoardNameTarget[];
  suggestions: readonly BoardNameSuggestion[] | null;
  ready: boolean;
  saving: boolean;
  savedNameCount: number;
  loadError: string | null;
  onReload(): void;
  onGenerate(): void;
  onApply(suggestions: readonly BoardNameSuggestion[]): Promise<void>;
  onRestore(): Promise<void>;
  onApplied(count: number): void;
  onRestored(): void;
}

export function RenameBoardModal({
  theme,
  layout,
  open,
  onOpenChange,
  targets,
  suggestions,
  ready,
  saving,
  savedNameCount,
  loadError,
  onReload,
  onGenerate,
  onApply,
  onRestore,
  onApplied,
  onRestored,
}: RenameBoardModalProps) {
  const [applying, setApplying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setActionError(null);
  }, [open]);

  const styles = useMemo(() => {
    const colors = theme.colors;
    const controlHeight = layout.platform === "android" ? 48 : 44;
    return {
      body: { gap: 18 },
      intro: { gap: 7 },
      lead: { color: colors.foreground, fontSize: 15, lineHeight: 21, fontWeight: "600" as const },
      copy: { color: colors.foregroundMuted, fontSize: 13, lineHeight: 19 },
      boundary: {
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
        gap: 9,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.surface1,
        padding: 12,
      },
      boundaryCopy: { flex: 1, color: colors.foregroundMuted, fontSize: 12, lineHeight: 17 },
      preview: { gap: 10 },
      previewHeading: { color: colors.foreground, fontSize: 14, fontWeight: "700" as const },
      previewCopy: { color: colors.foregroundMuted, fontSize: 12, lineHeight: 17 },
      previewList: { gap: 8 },
      previewRow: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 10,
        gap: 5,
      },
      previewMeta: {
        color: colors.foregroundMuted,
        fontSize: 10,
        fontWeight: "700" as const,
      },
      oldName: { color: colors.foregroundMuted, fontSize: 12, lineHeight: 17 },
      newNameRow: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 7 },
      newName: {
        flex: 1,
        color: colors.foreground,
        fontSize: 14,
        lineHeight: 19,
        fontWeight: "600" as const,
      },
      error: {
        color: colors.statusDanger,
        backgroundColor: colors.surface1,
        borderRadius: 10,
        padding: 11,
        fontSize: 12,
        lineHeight: 17,
      },
      actions: {
        flexDirection: layout.compact ? ("column" as const) : ("row" as const),
        alignItems: "stretch" as const,
        justifyContent: "flex-end" as const,
        gap: 8,
      },
      action: {
        minHeight: controlHeight,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        gap: 7,
      },
      primaryAction: { borderColor: colors.accent, backgroundColor: colors.accent },
      actionText: { color: colors.foreground, fontSize: 13, fontWeight: "600" as const },
      primaryActionText: {
        color: colors.accentForeground,
        fontSize: 13,
        fontWeight: "700" as const,
      },
      dangerActionText: { color: colors.statusDanger, fontSize: 13, fontWeight: "600" as const },
      disabled: { opacity: 0.45 },
    };
  }, [layout.compact, layout.platform, theme]);

  const suggestionByKey = useMemo(
    () => new Map((suggestions ?? []).map((suggestion) => [suggestion.key, suggestion.name])),
    [suggestions],
  );
  const workspaceCount = targets.filter((target) => target.kind === "workspace").length;
  const threadCount = targets.length - workspaceCount;
  const busy = applying || restoring || saving;

  const generate = () => {
    if (busy || !ready || targets.length === 0) return;
    setActionError(null);
    onGenerate();
  };

  const apply = async () => {
    if (!suggestions || busy) return;
    setApplying(true);
    setActionError(null);
    try {
      await onApply(suggestions);
      onApplied(suggestions.length);
      onOpenChange(false);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "The new board names could not be saved.",
      );
    } finally {
      setApplying(false);
    }
  };

  const restore = async () => {
    if (busy || savedNameCount === 0) return;
    setRestoring(true);
    setActionError(null);
    try {
      await onRestore();
      onRestored();
      onOpenChange(false);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "The original board names could not be restored.",
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal
      title="Rename board with Luna"
      icon={<Icon name="Sparkles" size={18} color={theme.colors.foreground} />}
      open={open}
      onOpenChange={onOpenChange}
    >
      <Modal.Content contentContainerStyle={styles.body}>
        {suggestions ? (
          <View style={styles.preview}>
            <Text style={styles.previewHeading}>Review {suggestions.length} proposed names</Text>
            <Text style={styles.previewCopy}>Nothing changes until you apply the full set.</Text>
            <View style={styles.previewList}>
              {targets.map((target) => (
                <View key={target.key} style={styles.previewRow}>
                  <Text style={styles.previewMeta}>
                    {target.kind === "workspace" ? "GROUPED PARENT" : "THREAD / TAB"}
                  </Text>
                  <Text style={styles.oldName} numberOfLines={2} ellipsizeMode="tail">
                    {target.currentName}
                  </Text>
                  <View style={styles.newNameRow}>
                    <Icon name="ArrowRight" size={14} color={theme.colors.foregroundMuted} />
                    <Text style={styles.newName}>{suggestionByKey.get(target.key)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.intro}>
              <Text style={styles.lead}>Give every active thread a clear, scannable name.</Text>
              <Text style={styles.copy}>
                Luna uses the titles, project context, and sibling tabs already visible to Thread
                Board. Generation continues in the background, so you can keep using Thread Board
                and Paseo while Luna works.
              </Text>
            </View>
            <View style={styles.boundary}>
              <Icon name="Info" size={16} color={theme.colors.foregroundMuted} />
              <Text style={styles.boundaryCopy}>
                These names are saved only in Thread Board. Paseo does not yet let plugins rename
                existing native thread tabs.
              </Text>
            </View>
            <Text style={styles.copy}>
              Ready to name {threadCount} {threadCount === 1 ? "thread or tab" : "threads and tabs"}
              {workspaceCount > 0
                ? ` plus ${workspaceCount} grouped ${workspaceCount === 1 ? "parent" : "parents"}`
                : ""}
              . The temporary Luna helper is archived when it finishes.
            </Text>
          </>
        )}

        {loadError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            Saved board names could not be loaded. {loadError}
          </Text>
        ) : null}
        {actionError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {actionError}
          </Text>
        ) : null}

        <View style={styles.actions}>
          {loadError ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading saved board names"
              disabled={busy}
              onPress={onReload}
              style={({ pressed }) => [
                styles.action,
                busy && styles.disabled,
                pressed && styles.disabled,
              ]}
            >
              <Text style={styles.actionText}>Retry</Text>
            </Pressable>
          ) : null}
          {!suggestions && savedNameCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Restore original board names"
              disabled={busy || !ready}
              onPress={() => void restore()}
              style={({ pressed }) => [
                styles.action,
                (busy || !ready) && styles.disabled,
                pressed && styles.disabled,
              ]}
            >
              {restoring ? (
                <ActivityIndicator size="small" color={theme.colors.statusDanger} />
              ) : null}
              <Text style={styles.dangerActionText}>Restore originals</Text>
            </Pressable>
          ) : null}
          {suggestions ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Generate another set of board names"
                disabled={busy}
                onPress={generate}
                style={({ pressed }) => [
                  styles.action,
                  busy && styles.disabled,
                  pressed && styles.disabled,
                ]}
              >
                <Icon name="RefreshCw" size={15} color={theme.colors.foreground} />
                <Text style={styles.actionText}>Generate again</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Apply ${suggestions.length} board names`}
                accessibilityState={{ busy: applying, disabled: busy }}
                disabled={busy}
                onPress={() => void apply()}
                style={({ pressed }) => [
                  styles.action,
                  styles.primaryAction,
                  busy && styles.disabled,
                  pressed && styles.disabled,
                ]}
              >
                {applying ? (
                  <ActivityIndicator size="small" color={theme.colors.accentForeground} />
                ) : (
                  <Icon name="Check" size={15} color={theme.colors.accentForeground} />
                )}
                <Text style={styles.primaryActionText}>Apply all names</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Generate board names with Luna"
              accessibilityState={{
                disabled: busy || !ready || targets.length === 0,
              }}
              disabled={busy || !ready || targets.length === 0}
              onPress={generate}
              style={({ pressed }) => [
                styles.action,
                styles.primaryAction,
                (busy || !ready || targets.length === 0) && styles.disabled,
                pressed && styles.disabled,
              ]}
            >
              <Icon name="Sparkles" size={15} color={theme.colors.accentForeground} />
              <Text style={styles.primaryActionText}>Generate names</Text>
            </Pressable>
          )}
        </View>
      </Modal.Content>
    </Modal>
  );
}
