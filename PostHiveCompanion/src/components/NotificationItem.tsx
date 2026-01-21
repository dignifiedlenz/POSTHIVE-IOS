import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {
  Bell,
  MessageCircle,
  CheckSquare,
  Film,
  Folder,
  UserPlus,
  Upload,
  Clock,
} from 'lucide-react-native';
import {theme} from '../theme';
import {Notification, NotificationType} from '../lib/types';
import {formatTimeAgo} from '../lib/utils';

interface NotificationItemProps {
  notification: Notification;
  onPress: () => void;
}

const getNotificationIcon = (type: NotificationType) => {
  const iconSize = 20;
  const iconColor = theme.colors.textSecondary;

  switch (type) {
    case 'comment_added':
    case 'comment_reply':
    case 'comment_mention':
    case 'comment_resolved':
      return <MessageCircle size={iconSize} color={iconColor} />;
    case 'todo_assigned':
    case 'todo_completed':
    case 'todo_due_soon':
    case 'todo_overdue':
      return <CheckSquare size={iconSize} color={iconColor} />;
    case 'deliverable_created':
    case 'deliverable_status_changed':
    case 'deliverable_due_soon':
    case 'deliverable_overdue':
    case 'version_uploaded':
    case 'version_signed_off':
      return <Film size={iconSize} color={iconColor} />;
    case 'project_created':
    case 'project_deadline_approaching':
    case 'project_assigned':
      return <Folder size={iconSize} color={iconColor} />;
    case 'workspace_invite':
    case 'workspace_member_joined':
      return <UserPlus size={iconSize} color={iconColor} />;
    case 'upload_completed':
    case 'dropzone_file_uploaded':
    case 'transfer_downloaded':
      return <Upload size={iconSize} color={iconColor} />;
    case 'transcription_completed':
      return <Clock size={iconSize} color={iconColor} />;
    default:
      return <Bell size={iconSize} color={iconColor} />;
  }
};

export function NotificationItem({notification, onPress}: NotificationItemProps) {
  const isUnread = !notification.seen_at;

  return (
    <TouchableOpacity
      style={[styles.container, isUnread && styles.unread]}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        {getNotificationIcon(notification.type)}
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          {isUnread && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {notification.message}
        </Text>
        <Text style={styles.time}>{formatTimeAgo(notification.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
  },
  unread: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
    marginLeft: theme.spacing.sm,
  },
  message: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    marginBottom: 4,
  },
  time: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
  },
});












