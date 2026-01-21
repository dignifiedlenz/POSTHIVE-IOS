/**
 * useWidgetSync.ts
 * 
 * Hook to automatically sync app data to iOS Home Screen Widgets
 * 
 * Usage:
 * Place in a top-level component (like App.tsx or a provider) to keep widgets updated
 * 
 * Example:
 *   useWidgetSync({
 *     todos: pendingTodos,
 *     events: upcomingEvents,
 *     latestDeliverable: deliverables[0],
 *     activeTransfer: currentTransfer,
 *   });
 */

import {useEffect, useRef, useCallback} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {
  WidgetModule,
  UpcomingWidgetItem,
  ActivityWidgetItem,
  ActivityType,
} from '../lib/WidgetModule';
import {Todo, Deliverable, CalendarEvent} from '../lib/types';
import {capitalizeFirst} from '../lib/utils';

// Activity item from app
export interface AppActivity {
  id: string;
  type: ActivityType;
  title: string;
  subtitle?: string;
  timestamp: string | Date;
  thumbnailUrl?: string;
  userName?: string;
}

interface UseWidgetSyncOptions {
  todos?: Todo[];
  events?: CalendarEvent[];
  deliverables?: Deliverable[];
  latestDeliverable?: Deliverable | null;
  activeTransfer?: {
    id: string;
    fileName: string;
    progress: number;
    bytesTransferred: number;
    totalBytes: number;
    isUpload: boolean;
  } | null;
  activities?: AppActivity[];
}

/**
 * Automatically syncs app data to iOS widgets
 * Updates are batched and throttled to avoid excessive widget refreshes
 */
export function useWidgetSync({
  todos = [],
  events = [],
  deliverables = [],
  latestDeliverable,
  activeTransfer,
  activities = [],
}: UseWidgetSyncOptions) {
  const lastUpdateRef = useRef<number>(0);
  const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null);

  // Store latest data in refs to avoid stale closures
  const todosRef = useRef(todos);
  const eventsRef = useRef(events);
  const deliverablesRef = useRef(deliverables);
  const deliverableRef = useRef(latestDeliverable);
  const transferRef = useRef(activeTransfer);
  const activitiesRef = useRef(activities);

  // Update refs when props change
  todosRef.current = todos;
  eventsRef.current = events;
  deliverablesRef.current = deliverables;
  deliverableRef.current = latestDeliverable;
  transferRef.current = activeTransfer;
  activitiesRef.current = activities;

  const pickLatestDeliverable = (items: Deliverable[]): Deliverable | null => {
    if (!items || items.length === 0) return null;

    const parseTime = (d: Deliverable) => {
      const t = Date.parse(d.updated_at || d.created_at);
      return Number.isFinite(t) ? t : 0;
    };

    // Always return the most recently updated deliverable
    return [...items].sort((a, b) => parseTime(b) - parseTime(a))[0] ?? null;
  };

  // Stable update function using refs
  const performUpdate = useCallback(() => {
    lastUpdateRef.current = Date.now();

    // Update upcoming items
    const items = getUpcomingItemsFromRefs();
    WidgetModule.updateUpcomingItems(items);

    // Update deliverable
    // Use latestDeliverable prop first (matches dashboard), fallback to pickLatestDeliverable
    const deliverable =
      deliverableRef.current ?? pickLatestDeliverable(deliverablesRef.current);
    if (deliverable) {
      // Use the already-resolved thumbnail_url from getRecentDeliverables
      // It's already been resolved through resolveThumbnail with all priority sources
      const thumbnailUrl = deliverable.thumbnail_url;
      
      // Ensure currentVersion is a number or undefined (not null)
      const currentVersion = typeof deliverable.current_version === 'number' 
        ? deliverable.current_version 
        : undefined;
      
      console.log('[WidgetSync] Updating deliverable widget:', {
        name: deliverable.name,
        thumbnailUrl: thumbnailUrl || 'NO THUMBNAIL',
        currentVersion: currentVersion,
        current_version_raw: deliverable.current_version,
        hasThumbnail: !!thumbnailUrl,
      });
      
      WidgetModule.updateLatestDeliverable({
        id: deliverable.id,
        name: deliverable.name,
        projectName: deliverable.project_name,
        thumbnailUrl: thumbnailUrl || undefined,
        unreadCommentCount: deliverable.unread_comment_count || 0,
        currentVersion: currentVersion,
        updatedAt: deliverable.updated_at,
      });
    } else {
      WidgetModule.updateLatestDeliverable(null);
    }

    // Update transfer
    const transfer = transferRef.current;
    if (transfer) {
      WidgetModule.updateActiveTransfer({
        id: transfer.id,
        fileName: transfer.fileName,
        progress: transfer.progress,
        bytesTransferred: transfer.bytesTransferred,
        totalBytes: transfer.totalBytes,
        isUpload: transfer.isUpload,
        startedAt: new Date().toISOString(),
      });
    } else {
      // Avoid passing `null` through the NSDictionary bridge path.
      WidgetModule.clearActiveTransfer();
    }

    // Update activity feed
    const currentActivities = activitiesRef.current;
    if (currentActivities.length > 0) {
      console.log('[WidgetSync] Updating activity feed with', currentActivities.length, 'items');
      const widgetActivities: ActivityWidgetItem[] = currentActivities
        .slice(0, 20) // Limit to 20 most recent
        .map(activity => ({
          id: activity.id,
          type: activity.type,
          title: activity.title,
          subtitle: activity.subtitle,
          timestamp: typeof activity.timestamp === 'string' 
            ? activity.timestamp 
            : activity.timestamp.toISOString(),
          thumbnailUrl: activity.thumbnailUrl,
          userName: activity.userName,
        }));
      
      // Call through WidgetModule which handles the native module check
      WidgetModule.updateActivityFeed(widgetActivities);
    } else {
      console.log('[WidgetSync] No activities to sync');
    }
  }, []);

  // Helper to get upcoming items from refs
  const getUpcomingItemsFromRefs = (): UpcomingWidgetItem[] => {
    const now = new Date();
    const items: UpcomingWidgetItem[] = [];
    const currentTodos = todosRef.current;
    const currentEvents = eventsRef.current;

    // Add ALL incomplete todos
    currentTodos
      .filter(todo => todo.status !== 'completed')
      .forEach(todo => {
        let timeString: string | undefined = undefined;
        
        if (todo.due_date) {
          timeString = todo.due_date;
          if (todo.due_time) {
            const [hours, minutes] = todo.due_time.split(':');
            const dateWithTime = new Date(todo.due_date);
            dateWithTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
            timeString = dateWithTime.toISOString();
          }
        }

        items.push({
          id: todo.id,
          title: capitalizeFirst(todo.title),
          subtitle: todo.project_name,
          time: timeString,
          type: 'todo',
          priority: todo.priority,
        });
      });

    // Add ALL upcoming events
    currentEvents
      .filter(event => {
        const startTime = new Date(event.start_time);
        return startTime.getTime() > now.getTime() - 3600000;
      })
      .forEach(event => {
        items.push({
          id: event.id,
          title: event.title,
          subtitle: event.location || event.calendar_name || undefined,
          time: event.start_time,
          type: 'event',
          color: event.calendar_color || undefined,
        });
      });

    // Sort by time
    items.sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return new Date(a.time).getTime() - new Date(b.time).getTime();
    });

    return items.slice(0, 15);
  };

  // Initial update and periodic refresh (every 30 seconds)
  useEffect(() => {
    // Initial update after a short delay
    const initialTimer = setTimeout(() => {
      performUpdate();
    }, 1000);

    // Periodic refresh every 30 seconds
    const intervalTimer = setInterval(() => {
      performUpdate();
    }, 30000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }
    };
  }, [performUpdate]);

  // Update when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        performUpdate();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [performUpdate]);
}

/**
 * Hook specifically for tracking transfer progress in widgets
 * Use this when you have an active upload/download
 */
export function useTransferWidget(transfer: {
  id: string;
  fileName: string;
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  isUpload: boolean;
} | null) {
  const lastProgressRef = useRef<number>(-1);

  useEffect(() => {
    if (!transfer) {
      // Clear when transfer is null
      WidgetModule.clearActiveTransfer();
      lastProgressRef.current = -1;
      return;
    }

    // Only update if progress changed by at least 1%
    const progressDiff = Math.abs(transfer.progress - lastProgressRef.current);
    if (progressDiff >= 0.01 || lastProgressRef.current === -1) {
      lastProgressRef.current = transfer.progress;
      
      WidgetModule.updateActiveTransfer({
        id: transfer.id,
        fileName: transfer.fileName,
        progress: transfer.progress,
        bytesTransferred: transfer.bytesTransferred,
        totalBytes: transfer.totalBytes,
        isUpload: transfer.isUpload,
        startedAt: new Date().toISOString(),
      });
    }
  }, [transfer]);

  // Clear on unmount
  useEffect(() => {
    return () => {
      WidgetModule.clearActiveTransfer();
    };
  }, []);
}

