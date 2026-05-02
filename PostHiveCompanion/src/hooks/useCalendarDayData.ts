import {useState, useEffect, useCallback, useRef} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '../lib/supabase';
import {Todo, CalendarEvent} from '../lib/types';

// ===== CACHE =====
// Persistent cache so the calendar grid renders instantly with the previous
// snapshot while fresh data loads in the background (stale-while-revalidate).
// Keep version in the key so a shape change invalidates old payloads.
const CACHE_VERSION = 'v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // keep up to 7 days

interface CachedCalendarPayload {
  v: typeof CACHE_VERSION;
  cachedAt: number;
  todos: Todo[];
  scheduledTasks: ScheduledTask[];
  calendarEvents: CalendarEvent[];
  blockedTimes: BlockedTime[];
  deadlines: Deadline[];
}

function cacheKey(workspaceId: string, userId: string): string {
  return `calendar-cache:${CACHE_VERSION}:${workspaceId}:${userId}`;
}

async function readCache(
  workspaceId: string,
  userId: string,
): Promise<CachedCalendarPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(workspaceId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCalendarPayload;
    if (parsed.v !== CACHE_VERSION) return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(
  workspaceId: string,
  userId: string,
  payload: Omit<CachedCalendarPayload, 'v' | 'cachedAt'>,
): void {
  // Fire-and-forget; don't block the render loop on disk I/O.
  const data: CachedCalendarPayload = {
    v: CACHE_VERSION,
    cachedAt: Date.now(),
    ...payload,
  };
  AsyncStorage.setItem(cacheKey(workspaceId, userId), JSON.stringify(data)).catch(
    err => console.warn('[Calendar] Failed to write cache:', err),
  );
}

// ===== TYPE DEFINITIONS =====

export interface ScheduledTask {
  id: string;
  user_id: string;
  workspace_id: string;
  source_type: 'todo' | 'deliverable';
  source_id: string;
  title: string;
  scheduled_start: string;
  scheduled_end: string;
  estimated_minutes: number;
  status: 'pending' | 'active' | 'completed' | 'rescheduled' | 'skipped';
  created_calendar_event: boolean;
  calendar_event_id?: string;
  manually_rescheduled?: boolean;
}

export interface BlockedTime {
  id: string;
  user_id: string;
  workspace_id: string;
  start_time: string;
  end_time: string;
  type: 'travel_day' | 'vacation' | 'away' | 'appointment' | 'break' | 'recurring';
  reason?: string;
  recurring_day_of_week?: number;
}

export interface Deadline {
  id: string;
  title: string;
  due_date: string;
  due_time?: string | null;
  type: 'todo' | 'deliverable';
  version?: string;
}

interface CalendarDayData {
  todos: Todo[];
  scheduledTasks: ScheduledTask[];
  calendarEvents: CalendarEvent[];
  blockedTimes: BlockedTime[];
  deadlines: Deadline[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface UseCalendarDayDataOptions {
  workspaceId: string;
  userId: string;
  /** When false, skip network/cache/realtime (e.g. workspace editors without a calendar tab). */
  fetchEnabled?: boolean;
}

// ===== HOOK =====

export function useCalendarDayData({
  workspaceId,
  userId,
  fetchEnabled = true,
}: UseCalendarDayDataOptions): CalendarDayData {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track whether we've hydrated from cache for the current workspace/user so
  // we don't show a spinner over data we already have on disk.
  const hydratedRef = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!fetchEnabled) {
      setTodos([]);
      setScheduledTasks([]);
      setCalendarEvents([]);
      setBlockedTimes([]);
      setDeadlines([]);
      setError(null);
      setLoading(false);
      hydratedRef.current = null;
      return;
    }

    if (!workspaceId || !userId) {
      setLoading(false);
      return;
    }

    try {
      // Only show the loading spinner if we have no cached data yet for this
      // workspace+user pair. Otherwise refresh quietly in the background.
      const cacheId = `${workspaceId}:${userId}`;
      if (hydratedRef.current !== cacheId) {
        setLoading(true);
      }
      setError(null);

      // Fetch all data in parallel using Supabase direct queries
      const [todosRes, scheduledRes, eventsRes, blockedRes, deadlinesRes] = await Promise.all([
        // 1. Fetch todos via Supabase
        supabase
          .from('todos')
          .select(`
            *,
            assigned_user:assigned_to(name),
            project:project_id(name),
            deliverable:deliverable_id(name)
          `)
          .eq('workspace_id', workspaceId)
          .order('created_at', {ascending: false}),

        // 2. Fetch scheduled tasks via Supabase (direct query)
        supabase
          .from('scheduled_tasks')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId)
          .neq('status', 'skipped'),

        // 3. Fetch calendar events via RPC for a wide range so the month
        //    grid (and Google-synced calendars) show up. Mirrors the web
        //    /api/.../calendar/events behavior (joins synced_google_calendars
        //    and applies visibility/permission rules).
        (() => {
          const rangeStart = new Date();
          rangeStart.setMonth(rangeStart.getMonth() - 25);
          rangeStart.setHours(0, 0, 0, 0);
          const rangeEnd = new Date();
          rangeEnd.setMonth(rangeEnd.getMonth() + 25);
          rangeEnd.setHours(23, 59, 59, 999);
          return supabase.rpc('get_calendar_events_for_range', {
            p_workspace_id: workspaceId,
            p_start_time: rangeStart.toISOString(),
            p_end_time: rangeEnd.toISOString(),
          });
        })(),

        // 4. Fetch blocked times via Supabase
        supabase
          .from('blocked_times')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId),

        // 5. Fetch deadlines (deliverables with due dates)
        supabase
          .rpc('get_upcoming_deadlines_for_user', {
            p_workspace_id: workspaceId,
            p_user_id: userId,
            p_days_ahead: 30,
          }),
      ]);

      // Capture next-state values locally so we can persist a single cache
      // snapshot at the end without re-reading React state.
      let nextTodos: Todo[] = [];
      let nextScheduled: ScheduledTask[] = [];
      let nextEvents: CalendarEvent[] = [];
      let nextBlocked: BlockedTime[] = [];
      let nextDeadlines: Deadline[] = [];

      // Process todos
      if (todosRes.data) {
        nextTodos = todosRes.data.map((todo: any) => ({
          ...todo,
          assigned_name: todo.assigned_user?.name,
          project_name: todo.project?.name,
          deliverable_name: todo.deliverable?.name,
        }));
        setTodos(nextTodos);
        console.log('[Calendar] Todos loaded:', nextTodos.length);
      }

      // Process scheduled tasks
      if (scheduledRes.data) {
        console.log('[Calendar] Scheduled tasks loaded:', {
          count: scheduledRes.data.length,
          sample: scheduledRes.data[0],
        });
        nextScheduled = scheduledRes.data || [];
        setScheduledTasks(nextScheduled);
      } else if (scheduledRes.error) {
        console.log('[Calendar] Scheduled tasks error:', scheduledRes.error.message);
        nextScheduled = [];
        setScheduledTasks([]);
      }

      // Process calendar events (RPC returns merged Google + PostHive events
      // with calendar_name/color joined from synced_google_calendars).
      if (eventsRes.data) {
        const rawEvents = (eventsRes.data || []).map((e: any) => ({
          id: e.id,
          workspace_id: workspaceId,
          source_type: e.source_type,
          title: e.title,
          description: e.description,
          start_time: e.start_time,
          end_time: e.end_time,
          is_all_day: e.is_all_day,
          location: e.location,
          meeting_link: e.meeting_link,
          calendar_name: e.calendar_name,
          calendar_color: e.calendar_color,
          created_by: e.created_by,
          project_id: e.project_id,
          visibility: e.visibility,
        })) as CalendarEvent[];

        // Dedup: events that appear as both Google and PostHive (same
        // title + same start/end). Prefer Google (has calendar_color), keep
        // PostHive's project_id/meeting_link/description if Google missing.
        const groups = new Map<string, CalendarEvent[]>();
        for (const ev of rawEvents) {
          const startNorm = new Date(ev.start_time).getTime();
          const endNorm = new Date(ev.end_time).getTime();
          const key = `${ev.title?.trim().toLowerCase() || ''}|${startNorm}|${endNorm}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(ev);
        }
        const merged: CalendarEvent[] = [];
        for (const group of groups.values()) {
          if (group.length === 1) {
            merged.push(group[0]);
            continue;
          }
          const google = group.find(e => e.source_type === 'google');
          const posthive = group.find(e => e.source_type === 'posthive');
          if (google) {
            const m = {...google};
            if (posthive) {
              if (!m.project_id && posthive.project_id) m.project_id = posthive.project_id;
              if (!m.meeting_link && posthive.meeting_link) m.meeting_link = posthive.meeting_link;
              if (!m.description && posthive.description) m.description = posthive.description;
            }
            merged.push(m);
          } else {
            merged.push(group[0]);
          }
        }

        console.log('[Calendar] Calendar events loaded:', merged.length, '(raw:', rawEvents.length, ')');
        nextEvents = merged;
        setCalendarEvents(merged);
      } else if (eventsRes.error) {
        console.log('[Calendar] Calendar events error:', eventsRes.error.message);
        nextEvents = [];
        setCalendarEvents([]);
      }

      // Process blocked times
      if (blockedRes.data) {
        console.log('[Calendar] Blocked times loaded:', blockedRes.data.length);
        nextBlocked = blockedRes.data || [];
        setBlockedTimes(nextBlocked);
      } else if (blockedRes.error) {
        console.log('[Calendar] Blocked times error:', blockedRes.error.message);
        nextBlocked = [];
        setBlockedTimes([]);
      }

      // Process deadlines
      if (deadlinesRes.data) {
        const processedDeadlines: Deadline[] = (deadlinesRes.data || []).map((d: any) => ({
          id: d.id,
          title: d.title,
          due_date: d.due_date,
          due_time: d.due_time || null,
          type: d.type,
          version: d.version || undefined,
        }));
        console.log('[Calendar] Deadlines loaded:', processedDeadlines.length);
        nextDeadlines = processedDeadlines;
        setDeadlines(processedDeadlines);
      } else if (deadlinesRes.error) {
        console.log('[Calendar] Deadlines error:', deadlinesRes.error.message);
        nextDeadlines = [];
        setDeadlines([]);
      }

      // Persist a fresh snapshot for the next cold-start.
      hydratedRef.current = `${workspaceId}:${userId}`;
      writeCache(workspaceId, userId, {
        todos: nextTodos,
        scheduledTasks: nextScheduled,
        calendarEvents: nextEvents,
        blockedTimes: nextBlocked,
        deadlines: nextDeadlines,
      });
    } catch (err) {
      console.error('[Calendar] Error fetching data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch calendar data'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, userId, fetchEnabled]);

  // Hydrate from disk cache as soon as we have the workspace/user identity so
  // the calendar grid can render its previous snapshot instantly. Network
  // refresh kicks in right after via the fetch effect below.
  useEffect(() => {
    if (!fetchEnabled) {
      hydratedRef.current = null;
      setLoading(false);
      return;
    }
    if (!workspaceId || !userId) return;
    let cancelled = false;
    const cacheId = `${workspaceId}:${userId}`;
    (async () => {
      const cached = await readCache(workspaceId, userId);
      if (cancelled) return;
      if (!cached) return;
      // Only apply cache if we haven't already loaded fresher data for this id.
      if (hydratedRef.current === cacheId) return;
      hydratedRef.current = cacheId;
      setTodos(cached.todos || []);
      setScheduledTasks(cached.scheduledTasks || []);
      setCalendarEvents(cached.calendarEvents || []);
      setBlockedTimes(cached.blockedTimes || []);
      setDeadlines(cached.deadlines || []);
      // Clear loading immediately - we have something to show.
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId, fetchEnabled]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription for updates
  useEffect(() => {
    if (!fetchEnabled || !workspaceId || !userId) return;

    const channel = supabase
      .channel('calendar-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => fetchData(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_tasks',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => fetchData(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => fetchData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, userId, fetchEnabled, fetchData]);

  return {
    todos,
    scheduledTasks,
    calendarEvents,
    blockedTimes,
    deadlines,
    loading,
    error,
    refresh: fetchData,
  };
}

// ===== HELPER FUNCTIONS =====

/**
 * Filter todos for a specific date
 */
export function filterTodosForDate(todos: Todo[], date: Date): Todo[] {
  const dayKey = formatDateKey(date);
  return todos.filter(todo => {
    if (!todo.due_date) return false;
    return todo.due_date === dayKey;
  });
}

/**
 * Split todos into status categories
 */
export function splitTodosByStatus(todos: Todo[]): {
  onTrackTodos: Todo[];
  overdueTodos: Todo[];
  pendingTodos: Todo[];
  inProgressTodos: Todo[];
  completedTodos: Todo[];
} {
  const now = new Date();
  
  // Split by status first
  const pendingTodos = todos.filter(t => t.status === 'pending');
  const inProgressTodos = todos.filter(t => t.status === 'in_progress');
  const completedTodos = todos.filter(t => t.status === 'completed');
  
  // Non-completed todos for on-track/overdue calculation
  const notCompleted = todos.filter(t => t.status !== 'completed');

  const onTrack: Todo[] = [];
  const overdue: Todo[] = [];

  notCompleted.forEach(todo => {
    if (!todo.due_date) {
      onTrack.push(todo);
      return;
    }

    let dueDateTime = new Date(todo.due_date);
    if (todo.due_time) {
      const [hours, minutes] = todo.due_time.split(':').map(Number);
      dueDateTime.setHours(hours, minutes, 0, 0);
    } else {
      dueDateTime.setHours(23, 59, 59, 999);
    }

    if (dueDateTime < now) {
      overdue.push(todo);
    } else {
      onTrack.push(todo);
    }
  });

  // Sort by due date
  onTrack.sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  return {
    onTrackTodos: onTrack, 
    overdueTodos: overdue,
    pendingTodos,
    inProgressTodos,
    completedTodos,
  };
}

/**
 * Filter scheduled tasks for a specific date
 */
export function filterScheduledTasksForDate(
  tasks: ScheduledTask[],
  date: Date,
): ScheduledTask[] {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return tasks.filter(task => {
    if (task.status === 'skipped') return false;
    const taskStart = new Date(task.scheduled_start);
    const taskEnd = new Date(task.scheduled_end);
    return taskStart < endOfDay && taskEnd > startOfDay;
  });
}

/**
 * Separate all-day vs timed events for a specific date
 */
export function separateEventsByType(
  events: CalendarEvent[],
  date: Date,
): {
  timedEvents: CalendarEvent[];
  allDayEvents: CalendarEvent[];
} {
  const dayKey = formatDateKey(date);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const allDay: CalendarEvent[] = [];
  const timed: CalendarEvent[] = [];

  events.forEach(event => {
    if (event.is_all_day) {
      // Google Calendar uses exclusive end dates for all-day events
      const eventStartDate = event.start_time.split('T')[0];
      const eventEndDate = event.end_time.split('T')[0];
      if (dayKey >= eventStartDate && dayKey < eventEndDate) {
        allDay.push(event);
      }
    } else {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      if (eventStart < endOfDay && eventEnd > startOfDay) {
        timed.push(event);
      }
    }
  });

  return {timedEvents: timed, allDayEvents: allDay};
}

/**
 * Filter deadlines for a specific date
 */
export function filterDeadlinesForDate(
  deadlines: Deadline[],
  date: Date,
): Deadline[] {
  const dayKey = formatDateKey(date);
  return deadlines.filter(deadline => deadline.due_date === dayKey);
}

/**
 * Filter blocked times for a specific date
 */
export function filterBlockedTimesForDate(
  blockedTimes: BlockedTime[],
  date: Date,
): BlockedTime[] {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  const dayOfWeek = date.getDay();

  return blockedTimes.filter(blocked => {
    // Handle recurring blocks
    if (blocked.type === 'recurring' && blocked.recurring_day_of_week !== undefined) {
      return blocked.recurring_day_of_week === dayOfWeek;
    }
    
    const blockStart = new Date(blocked.start_time);
    const blockEnd = new Date(blocked.end_time);
    return blockStart < endOfDay && blockEnd > startOfDay;
  });
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ===== VISUAL CONSTANTS =====

export const PX_PER_HOUR = 80; // Pixels per hour for calendar view

/**
 * Calculate position and height for a time-based item
 */
export function calculateTimePosition(startTime: Date, endTime: Date): {
  top: number;
  height: number;
} {
  const startHour = startTime.getHours() + startTime.getMinutes() / 60;
  const endHour = endTime.getHours() + endTime.getMinutes() / 60;
  const duration = endHour - startHour;

  return {
    top: startHour * PX_PER_HOUR,
    height: Math.max(duration * PX_PER_HOUR, 24), // Min height 24px
  };
}

// ===== BLOCKED TIME COLORS =====

export const BLOCKED_TIME_COLORS: Record<
  BlockedTime['type'],
  {bg: string; border: string; text: string}
> = {
  travel_day: {
    bg: 'rgba(120, 53, 15, 0.4)',
    border: '#b45309',
    text: '#fcd34d',
  },
  vacation: {
    bg: 'rgba(88, 28, 135, 0.4)',
    border: '#7c3aed',
    text: '#c4b5fd',
  },
  away: {
    bg: 'rgba(124, 45, 18, 0.4)',
    border: '#ea580c',
    text: '#fdba74',
  },
  appointment: {
    bg: 'rgba(22, 78, 99, 0.4)',
    border: '#0891b2',
    text: '#67e8f9',
  },
  break: {
    bg: 'rgba(39, 39, 42, 0.4)',
    border: '#52525b',
    text: '#a1a1aa',
  },
  recurring: {
    bg: 'rgba(49, 46, 129, 0.4)',
    border: '#6366f1',
    text: '#a5b4fc',
  },
};
