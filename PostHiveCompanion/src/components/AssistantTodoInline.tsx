import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {theme} from '../theme';
import type {AICommandData} from '../lib/api';

const QUICK_ACTIONS = [
  {label: 'Adjust', command: 'Update that todo'},
  {label: 'Attach to project', command: 'Attach that todo to a project'},
  {label: 'Attach to deliverable', command: 'Attach that todo to a deliverable'},
] as const;

type Props = {
  data: AICommandData;
  /** Sends the command through the assistant (uses last-created todo context on the server). */
  onQuickAction?: (command: string) => void;
  quickActionsDisabled?: boolean;
};

/**
 * Compact todo preview: short status line, list-style row with hollow circle + title,
 * optional assignee, then tappable follow-ups. (No left border — that pattern is for events.)
 */
export function AssistantTodoInline({
  data,
  onQuickAction,
  quickActionsDisabled,
}: Props) {
  const raw = data as Record<string, unknown>;
  const updated = !!raw.updated;
  const title = String(raw.title || raw.name || 'Todo').trim() || 'Todo';
  const assignee = raw.assigned_to_name as string | undefined;
  const showAssignee = typeof assignee === 'string' && assignee.trim().length > 0;
  const showChips = typeof onQuickAction === 'function';

  return (
    <View>
      <Text style={styles.intro}>{updated ? 'Updated todo' : 'Added todo'}</Text>
      <View style={styles.tile}>
        <View style={styles.tileRow}>
          <View style={styles.checkbox} accessibilityLabel="Todo" />
          <Text style={styles.tileTitle} numberOfLines={4}>
            {title}
          </Text>
        </View>
      </View>
      {showAssignee ? (
        <Text style={styles.assignee}>
          Assigned to {assignee.trim()}
        </Text>
      ) : null}
      {showChips ? (
        <View style={styles.chipRow} accessibilityRole="toolbar">
          {QUICK_ACTIONS.map(({label, command}) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label}
              disabled={quickActionsDisabled}
              onPress={() => onQuickAction(command)}
              style={({pressed}) => [
                styles.chip,
                quickActionsDisabled && styles.chipDisabled,
                pressed && !quickActionsDisabled && styles.chipPressed,
              ]}>
              <Text
                style={[
                  styles.chipLabel,
                  quickActionsDisabled && styles.chipLabelDisabled,
                ]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    marginBottom: 8,
    fontFamily: theme.typography.fontFamily.regular,
  },
  tile: {
    paddingVertical: 2,
    overflow: 'hidden',
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 1,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'transparent',
  },
  tileTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    lineHeight: 14,
  },
  assignee: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    marginTop: 8,
    fontFamily: theme.typography.fontFamily.regular,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: theme.colors.borderHover,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
  },
  chipLabelDisabled: {
    color: theme.colors.textMuted,
  },
});
