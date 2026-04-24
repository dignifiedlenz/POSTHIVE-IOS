import React from 'react';
import {View, Text, Pressable, FlatList, StyleSheet} from 'react-native';
import type {WorkspaceMember} from '../lib/types';
import {theme} from '../theme';

type Props = {
  visible: boolean;
  members: WorkspaceMember[];
  onPick: (member: WorkspaceMember) => void;
  onDismiss: () => void;
};

/** Compact member list shown above the composer when the user types @. */
export function AssistantMentionPicker({visible, members, onPick, onDismiss}: Props) {
  if (!visible || members.length === 0) return null;

  return (
    <View style={styles.sheet} accessibilityViewIsModal>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Mention teammate</Text>
        <Pressable onPress={onDismiss} hitSlop={10}>
          <Text style={styles.dismiss}>Done</Text>
        </Pressable>
      </View>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={members}
        keyExtractor={m => m.user_id}
        style={styles.list}
        nestedScrollEnabled
        renderItem={({item}) => (
          <Pressable
            style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => onPick(item)}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            {item.email ? (
              <Text style={styles.email} numberOfLines={1}>
                {item.email}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const MAX_LIST_H = 200;

const styles = StyleSheet.create({
  sheet: {
    maxHeight: MAX_LIST_H + 52,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: 12,
    marginHorizontal: theme.spacing.sm,
    marginBottom: 6,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  dismiss: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  list: {
    maxHeight: MAX_LIST_H,
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  name: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
  email: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
