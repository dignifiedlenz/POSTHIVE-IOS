import React, {useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Bell, CheckCheck} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {useNotifications} from '../../hooks/useNotifications';
import {NotificationItem} from '../../components/NotificationItem';
import {Notification} from '../../lib/types';

export function NotificationsScreen() {
  const navigation = useNavigation();
  const {user, currentWorkspace} = useAuth();
  const {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    refresh,
    markSeen,
    markAllSeen,
  } = useNotifications({
    workspaceId: currentWorkspace?.id || '',
    userId: user?.id || '',
  });

  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      // Mark as seen
      if (!notification.seen_at) {
        markSeen(notification.id);
      }

      // Navigate based on notification type
      const {type, deliverable_id, version_id, comment_id, todo_id, project_id} = notification;
      
      // Comment notifications - go to deliverable with version and comment context
      if (type.startsWith('comment_') && deliverable_id) {
        navigation.navigate('ReviewTab' as never, {
          screen: 'DeliverableReview',
          params: {
            deliverableId: deliverable_id,
            versionId: version_id,
            commentId: comment_id,
          },
        } as never);
        return;
      }
      
      // Version notifications - go to deliverable with specific version
      if ((type === 'version_uploaded' || type === 'version_signed_off') && deliverable_id) {
        navigation.navigate('ReviewTab' as never, {
          screen: 'DeliverableReview',
          params: {
            deliverableId: deliverable_id,
            versionId: version_id,
          },
        } as never);
        return;
      }
      
      // Deliverable notifications - go to deliverable
      if (deliverable_id) {
        navigation.navigate('ReviewTab' as never, {
          screen: 'DeliverableReview',
          params: {deliverableId: deliverable_id},
        } as never);
        return;
      }
      
      // Todo notifications - go to Tasks tab
      if (todo_id) {
        navigation.navigate('TasksTab' as never);
        return;
      }
      
      // Project notifications - go to project deliverables
      if (project_id) {
        const projectName = (notification.data?.project_name as string) || 'Project';
        navigation.navigate('ReviewTab' as never, {
          screen: 'ProjectDeliverables',
          params: {projectId: project_id, projectName},
        } as never);
        return;
      }
    },
    [navigation, markSeen],
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Bell size={40} color={theme.colors.textMuted} />
      <Text style={styles.emptyTitle}>NO NOTIFICATIONS</Text>
      <Text style={styles.emptySubtitle}>
        You're all caught up! New notifications will appear here
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with section label and mark all button */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={markAllSeen}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <CheckCheck size={14} color={theme.colors.textMuted} />
            <Text style={styles.markAllText}>MARK ALL READ</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <NotificationItem
            notification={item}
            onPress={() => handleNotificationPress(item)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          notifications.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={theme.colors.textPrimary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Show wave background
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
  },
  unreadBadge: {
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: theme.colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  list: {
    padding: theme.spacing.md,
  },
  emptyList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderHover,
    marginTop: theme.spacing.md,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
