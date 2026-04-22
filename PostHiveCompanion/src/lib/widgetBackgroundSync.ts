/**
 * widgetBackgroundSync.ts
 *
 * Fetches fresh data from Supabase and updates iOS widgets when the app
 * runs in the background (Background App Refresh). This keeps widgets
 * up to date even when the user hasn't opened the app.
 */

import {Platform} from 'react-native';
import {supabase} from './supabase';
import {
  getRecentDeliverables,
  getTodos,
  getNotifications,
  getTransferHistory,
  getUserPreferredWorkspace,
  getUserPrimaryWorkspace,
  getUserWorkspaces,
} from './api';
import {WidgetModule, UpcomingWidgetItem, ActivityWidgetItem, ActivityType} from './WidgetModule';
import {Todo, CalendarEvent} from './types';
import {capitalizeFirst} from './utils';

const TYPE_MAP: Record<string, ActivityType> = {
  comment_added: 'comment',
  comment_reply: 'comment',
  comment_mention: 'mention',
  comment_resolved: 'approval',
  version_uploaded: 'upload',
  version_signed_off: 'approval',
  deliverable_created: 'upload',
  deliverable_status_changed: 'revision',
  deliverable_due_soon: 'revision',
  deliverable_overdue: 'revision',
  todo_assigned: 'share',
  todo_due_soon: 'revision',
  todo_overdue: 'revision',
  todo_completed: 'approval',
  project_created: 'upload',
  project_deadline_approaching: 'revision',
  project_assigned: 'share',
  dropzone_file_uploaded: 'upload',
  transfer_downloaded: 'download',
  transcription_completed: 'approval',
  upload_completed: 'upload',
};

/**
 * Fetches all widget data from Supabase and updates the native widgets.
 * Safe to call from background - uses persisted session.
 */
export async function syncWidgetDataInBackground(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;

  try {
    const {
      data: {session},
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return false;
    }

    const userId = session.user.id;

    // Resolve workspace: preferred > primary > first available
    let workspaceId: string | null = await getUserPreferredWorkspace(userId);
    if (!workspaceId) {
      const primary = await getUserPrimaryWorkspace();
      workspaceId = primary?.workspace_id ?? null;
    }
    if (!workspaceId) {
      const workspaces = await getUserWorkspaces(userId);
      workspaceId = workspaces[0]?.id ?? null;
    }
    if (!workspaceId) {
      return false;
    }

    const workspacesForRole = await getUserWorkspaces(userId);
    const currentWs = workspacesForRole.find(w => w.id === workspaceId);
    const includeNotificationFeed =
      currentWs?.role !== 'editor';

    // Fetch all data in parallel
    const [deliverables, todos, notifications, eventsRes, transfers] = await Promise.all([
      getRecentDeliverables(workspaceId, userId),
      getTodos(workspaceId),
      includeNotificationFeed
        ? getNotifications(workspaceId, 50)
        : Promise.resolve([]),
      supabase
        .from('calendar_events')
        .select('*')
        .eq('workspace_id', workspaceId),
      getTransferHistory(workspaceId, 5),
    ]);

    const calendarEvents = (eventsRes.data || []) as CalendarEvent[];

    // Build upcoming items (todos + events)
    const upcomingItems = buildUpcomingItems(todos, calendarEvents);
    WidgetModule.updateUpcomingItems(upcomingItems);

    // Latest deliverable (most recently updated)
    const latest =
      deliverables.length > 0
        ? [...deliverables].sort((a, b) => {
            const ta = Date.parse(a.updated_at || a.created_at) || 0;
            const tb = Date.parse(b.updated_at || b.created_at) || 0;
            return tb - ta;
          })[0]
        : null;
    if (latest) {
      const currentVersion =
        typeof latest.current_version === 'number' ? latest.current_version : undefined;
      WidgetModule.updateLatestDeliverable({
        id: latest.id,
        name: latest.name,
        projectName: latest.project_name,
        thumbnailUrl: latest.thumbnail_url || undefined,
        unreadCommentCount: latest.unread_comment_count || 0,
        currentVersion,
        updatedAt: latest.updated_at,
      });
    } else {
      WidgetModule.updateLatestDeliverable(null);
    }

    // Activity feed from notifications
    const activities: ActivityWidgetItem[] = notifications.slice(0, 20).map(n => ({
      id: n.id,
      type: TYPE_MAP[n.type] || 'upload',
      title: n.title,
      subtitle: n.message,
      timestamp: n.created_at,
      userName: (n.data?.actor_name as string) || undefined,
    }));
    WidgetModule.updateActivityFeed(activities);

    // No active transfer in background
    WidgetModule.clearActiveTransfer();
    WidgetModule.updateRecentTransfers(
      (transfers || []).slice(0, 5).map(transfer => ({
        id: transfer.id,
        fileName:
          transfer.transfer_name ||
          transfer.project_name ||
          transfer.operation_type ||
          'Transfer',
        isUpload: transfer.operation_type?.toLowerCase().includes('upload') ?? false,
        completedAt: transfer.completed_at || transfer.started_at,
      })),
    );

    // Reload widget timelines
    WidgetModule.reloadAllWidgets();

    return true;
  } catch (err) {
    console.warn('[WidgetBackgroundSync] Error:', err);
    return false;
  }
}

function buildUpcomingItems(
  todos: Todo[],
  events: CalendarEvent[],
): UpcomingWidgetItem[] {
  const now = new Date();
  const items: UpcomingWidgetItem[] = [];

  todos
    .filter(t => t.status !== 'completed')
    .forEach(todo => {
      let timeString: string | undefined;
      if (todo.due_date) {
        timeString = todo.due_date;
        if (todo.due_time) {
          const [h, m] = todo.due_time.split(':');
          const d = new Date(todo.due_date);
          d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
          timeString = d.toISOString();
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

  events
    .filter(e => new Date(e.start_time).getTime() > now.getTime() - 3600000)
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

  items.sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return new Date(a.time).getTime() - new Date(b.time).getTime();
  });

  return items.slice(0, 15);
}
