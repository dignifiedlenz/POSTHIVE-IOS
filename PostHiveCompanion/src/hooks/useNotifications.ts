import {useState, useEffect, useCallback} from 'react';
import {supabase} from '../lib/supabase';
import {
  getNotifications,
  getUnreadCount,
  markNotificationSeen,
  markAllNotificationsSeen,
} from '../lib/api';
import {Notification} from '../lib/types';

interface UseNotificationsOptions {
  workspaceId: string;
  userId: string;
}

export function useNotifications({workspaceId, userId}: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const [notificationData, count] = await Promise.all([
        getNotifications(workspaceId),
        getUnreadCount(workspaceId),
      ]);
      setNotifications(notificationData);
      setUnreadCount(count);
      setError(null);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Failed to load notifications');
    }
  }, [workspaceId]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadNotifications();
      setIsLoading(false);
    };
    init();
  }, [loadNotifications]);

  // Real-time subscription
  useEffect(() => {
    if (!workspaceId || !userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          // Only add if it belongs to current workspace
          if (newNotification.workspace_id === workspaceId) {
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updatedNotification = payload.new as Notification;
          setNotifications(prev =>
            prev.map(n =>
              n.id === updatedNotification.id ? updatedNotification : n,
            ),
          );
          // Recalculate unread count if seen_at changed
          if (updatedNotification.seen_at) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, userId]);

  // Refresh
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  }, [loadNotifications]);

  // Mark single notification as seen
  const markSeen = useCallback(
    async (notificationId: string) => {
      try {
        await markNotificationSeen(notificationId, userId);
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? {...n, seen_at: new Date().toISOString()}
              : n,
          ),
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Error marking notification seen:', err);
      }
    },
    [userId],
  );

  // Mark all as seen
  const markAllSeen = useCallback(async () => {
    try {
      await markAllNotificationsSeen(userId, workspaceId);
      setNotifications(prev =>
        prev.map(n => ({...n, seen_at: n.seen_at || new Date().toISOString()})),
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications seen:', err);
    }
  }, [userId, workspaceId]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    error,
    refresh,
    markSeen,
    markAllSeen,
  };
}












