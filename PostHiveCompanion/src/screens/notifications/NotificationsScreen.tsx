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
import {Bell, CheckCheck, ChevronLeft} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import {theme} from '../../theme';
import {BrandedLoadingScreen} from '../../components/BrandedLoadingScreen';
import {useAuth} from '../../hooks/useAuth';
import {useNotifications} from '../../hooks/useNotifications';
import {NotificationItem} from '../../components/NotificationItem';
import {Notification} from '../../lib/types';

export function NotificationsScreen() {
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
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
      
      // Comment notifications - go to deliverable with version and comment context.
      // DeliverableReview is now a root-level screen (above the tab navigator) so it presents
      // over the native iOS tab bar instead of being constrained inside it.
      if (type.startsWith('comment_') && deliverable_id) {
        (navigation as any).navigate('DeliverableReview', {
          deliverableId: deliverable_id,
          versionId: version_id,
          commentId: comment_id,
        });
        return;
      }

      if ((type === 'version_uploaded' || type === 'version_signed_off') && deliverable_id) {
        (navigation as any).navigate('DeliverableReview', {
          deliverableId: deliverable_id,
          versionId: version_id,
        });
        return;
      }

      if (deliverable_id) {
        (navigation as any).navigate('DeliverableReview', {deliverableId: deliverable_id});
        return;
      }
      
      // Todo notifications - productivity home
      if (todo_id) {
        (navigation as any).navigate('MainTabs', {
          screen: 'Home',
          params: {screen: 'Dashboard'},
        });
        return;
      }
      
      // Project notifications - go to project deliverables
      if (project_id) {
        const projectName = (notification.data?.project_name as string) || 'Project';
        (navigation as any).navigate('MainTabs', {
          screen: 'Home',
          params: {
            screen: 'ProjectDeliverables',
            params: {projectId: project_id, projectName},
          },
        });
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
    return <BrandedLoadingScreen message="Loading notifications..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header with section label and mark all button */}
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity
            style={styles.headerBack}
            onPress={() => navigation.goBack()}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityRole="button"
            accessibilityLabel="Back">
            <ChevronLeft size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBackPlaceholder} />
        )}
        <View style={styles.headerCenter}>
          <View style={styles.headerLeft}>
            <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={markAllSeen}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <CheckCheck size={14} color={theme.colors.textMuted} />
            <Text style={styles.markAllText}>MARK ALL READ</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.markAllPlaceholder} />
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
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackPlaceholder: {
    width: 40,
    height: 40,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  markAllPlaceholder: {
    width: 40,
    height: 40,
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
