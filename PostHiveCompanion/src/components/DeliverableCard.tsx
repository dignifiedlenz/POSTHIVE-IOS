import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image} from 'react-native';
import {MessageCircle} from 'lucide-react-native';
import {theme} from '../theme';
import {Deliverable} from '../lib/types';
import {formatDueDate, getDueDateColor} from '../lib/utils';
import {StatusBadge} from './ui/Badge';

interface DeliverableCardProps {
  deliverable: Deliverable;
  onPress: () => void;
}

export function DeliverableCard({deliverable, onPress}: DeliverableCardProps) {
  const hasUnreadComments =
    deliverable.unread_comment_count && deliverable.unread_comment_count > 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.thumbnailContainer}>
        <Image
          source={
            deliverable.thumbnail_url
              ? {uri: deliverable.thumbnail_url}
              : require('../assets/default-thumbnail.png')
          }
          style={styles.thumbnail}
          resizeMode="cover"
          defaultSource={require('../assets/default-thumbnail.png')}
        />
        {deliverable.current_version != null && (
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>V{deliverable.current_version}</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {deliverable.name}
          </Text>
          {hasUnreadComments && (
            <View style={styles.commentBadge}>
              <MessageCircle size={12} color={theme.colors.textPrimary} />
              <Text style={styles.commentCount}>
                {deliverable.unread_comment_count}
              </Text>
            </View>
          )}
        </View>

        {deliverable.project_name && (
          <Text style={styles.projectName} numberOfLines={1}>
            {deliverable.project_name}
          </Text>
        )}

        <View style={styles.footer}>
          <StatusBadge status={deliverable.status} size="sm" />
          {deliverable.due_date && (
            <Text
              style={[
                styles.dueDate,
                {color: getDueDateColor(deliverable.due_date)},
              ]}>
              {formatDueDate(deliverable.due_date)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: 'transparent',
    marginBottom: theme.spacing.sm,
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: theme.spacing.md,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.md,
  },
  versionBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  versionText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    flex: 1,
  },
  commentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
    marginLeft: theme.spacing.sm,
    gap: 4,
  },
  commentCount: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
  },
  projectName: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dueDate: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
  },
});

