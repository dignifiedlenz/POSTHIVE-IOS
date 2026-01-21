# Mobile App: Calendar Day View Data Fetching

This document explains how to fetch all ongoing tasks and events for the CalendarDayView component in the React Native mobile app.

## Overview

The CalendarDayView displays several types of items:
1. **Todos** - Tasks with due dates (pending, in_progress, completed)
2. **Scheduled Tasks** - Auto-scheduled work blocks from the planner
3. **Calendar Events** - Meetings and events (from Google Calendar or Posthive)
4. **Blocked Times** - User-defined time blocks (vacation, travel, breaks, etc.)

---

## Type Definitions

### Todo
```typescript
interface Todo {
  id: string;
  workspace_id: string;
  project_id?: string;
  deliverable_id?: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;      // DATE format: "YYYY-MM-DD"
  due_time?: string;      // TIME format: "HH:mm"
  estimated_minutes?: number;
  assigned_to?: string;
  assigned_name?: string;
  created_by: string;
  completed_by?: string;
  completed_at?: string;
  created_at: string;
  is_private?: boolean;
  updated_at?: string;
  project_name?: string;
  deliverable_name?: string;
}
```

### ScheduledTask
```typescript
interface ScheduledTask {
  id: string;
  user_id: string;
  workspace_id: string;
  source_type: 'todo' | 'deliverable';
  source_id: string;
  title: string;
  scheduled_start: string;  // ISO timestamp
  scheduled_end: string;    // ISO timestamp
  estimated_minutes: number;
  status: 'pending' | 'active' | 'completed' | 'rescheduled' | 'skipped';
  created_calendar_event: boolean;
  calendar_event_id?: string;
  manually_rescheduled?: boolean;
}
```

### CalendarEvent
```typescript
interface CalendarEvent {
  id: string;
  workspace_id: string;
  source_type: 'google' | 'posthive';
  title: string;
  description: string | null;
  start_time: string;      // ISO timestamp
  end_time: string;        // ISO timestamp
  is_all_day: boolean;
  location: string | null;
  meeting_link: string | null;
  calendar_name: string | null;
  calendar_color: string | null;
  created_by: string | null;
  project_id: string | null;
}
```

### BlockedTime
```typescript
interface BlockedTime {
  id: string;
  user_id: string;
  workspace_id: string;
  start_time: string;      // ISO timestamp
  end_time: string;        // ISO timestamp
  type: 'travel_day' | 'vacation' | 'away' | 'appointment' | 'break' | 'recurring';
  reason?: string;
  recurring_day_of_week?: number; // 0=Sunday, 6=Saturday
}
```

---

## API Endpoints

### 1. Fetch Todos

**Server Action:** `getTodosByWorkspace(workspaceId)`

**API Equivalent for Mobile:**
```http
GET /api/workspaces/{workspaceId}/todos
Authorization: Bearer {access_token}
```

**Supabase Direct Query:**
```typescript
const { data: todos, error } = await supabase
  .from('todos')
  .select(`
    *,
    assigned_user:assigned_to(name),
    project:project_id(name),
    deliverable:deliverable_id(name)
  `)
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false });
```

---

### 2. Fetch Scheduled Tasks (Planner)

**Endpoint:**
```http
GET /api/workspaces/{workspaceId}/planner/schedule
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "scheduled_tasks": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "workspace_id": "uuid",
      "source_type": "todo",
      "source_id": "uuid",
      "title": "Edit intro sequence",
      "scheduled_start": "2024-12-16T09:00:00Z",
      "scheduled_end": "2024-12-16T10:30:00Z",
      "estimated_minutes": 90,
      "status": "pending",
      "created_calendar_event": false,
      "manually_rescheduled": false
    }
  ],
  "calendar_events": []
}
```

**Note:** This endpoint returns scheduled tasks from the past 30 days (for completed tasks) and all future tasks.

---

### 3. Fetch Calendar Events

**Endpoint:**
```http
GET /api/workspaces/{workspaceId}/calendar/events?start={ISO_DATE}&end={ISO_DATE}
Authorization: Bearer {access_token}
```

**Example:**
```http
GET /api/workspaces/abc123/calendar/events?start=2024-12-16T00:00:00.000Z&end=2024-12-16T23:59:59.999Z
```

**Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "source_type": "google",
      "title": "Team Standup",
      "description": null,
      "start_time": "2024-12-16T10:00:00Z",
      "end_time": "2024-12-16T10:30:00Z",
      "is_all_day": false,
      "location": "Zoom",
      "meeting_link": "https://zoom.us/...",
      "calendar_name": "Work",
      "calendar_color": "#1a73e8",
      "created_by": null,
      "project_id": null
    }
  ]
}
```

---

### 4. Fetch Blocked Times

**Endpoint:**
```http
GET /api/workspaces/{workspaceId}/planner/block-time?start={ISO_DATE}&end={ISO_DATE}
Authorization: Bearer {access_token}
```

**Example:**
```http
GET /api/workspaces/abc123/planner/block-time?start=2024-12-16T00:00:00.000Z&end=2024-12-16T23:59:59.999Z
```

**Response:**
```json
{
  "blocked_times": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "workspace_id": "uuid",
      "start_time": "2024-12-16T12:00:00Z",
      "end_time": "2024-12-16T13:00:00Z",
      "type": "break",
      "reason": "Lunch"
    }
  ]
}
```

---

### 5. Fetch Upcoming Deadlines

**Server Action:** `getUpcomingDeadlines(workspaceId, daysAhead)`

**Supabase Direct Query (for mobile):**

```typescript
async function getUpcomingDeadlines(workspaceId: string, daysAhead: number = 30) {
  const now = new Date();
  const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  // Fetch todos with deadlines
  const { data: todos } = await supabase
    .from('todos')
    .select(`
      id, title, due_date, due_time, priority, is_private, status, project_id,
      project:project_id(name),
      deliverable:deliverable_id(name)
    `)
    .eq('workspace_id', workspaceId)
    .not('due_date', 'is', null)
    .lte('due_date', futureDateStr);

  // Fetch projects for deliverables
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('workspace_id', workspaceId);

  const projectIds = projects?.map(p => p.id) || [];

  // Fetch deliverables with deadlines
  const { data: deliverables } = await supabase
    .from('deliverables')
    .select(`
      id, name, due_date, due_time, project_id, status,
      project:project_id(name)
    `)
    .in('project_id', projectIds)
    .not('due_date', 'is', null)
    .lte('due_date', futureDateStr);

  return [...todos, ...deliverables];
}
```

---

## React Native Implementation

### Custom Hook: `useCalendarDayData`

```typescript
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface CalendarDayData {
  todos: Todo[];
  scheduledTasks: ScheduledTask[];
  calendarEvents: CalendarEvent[];
  blockedTimes: BlockedTime[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useCalendarDayData(
  workspaceId: string,
  selectedDate: Date
): CalendarDayData {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range for the selected day
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Fetch all data in parallel
      const [todosRes, scheduledRes, eventsRes, blockedRes] = await Promise.all([
        // 1. Fetch todos
        supabase
          .from('todos')
          .select(`
            *,
            assigned_user:assigned_to(name),
            project:project_id(name),
            deliverable:deliverable_id(name)
          `)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),

        // 2. Fetch scheduled tasks via API
        fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/planner/schedule`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        }),

        // 3. Fetch calendar events via API
        fetch(
          `${API_BASE_URL}/api/workspaces/${workspaceId}/calendar/events?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        ),

        // 4. Fetch blocked times via API
        fetch(
          `${API_BASE_URL}/api/workspaces/${workspaceId}/planner/block-time?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        ),
      ]);

      // Process todos
      if (todosRes.data) {
        setTodos(todosRes.data);
      }

      // Process scheduled tasks
      if (scheduledRes.ok) {
        const scheduledData = await scheduledRes.json();
        setScheduledTasks(scheduledData.scheduled_tasks || []);
      }

      // Process calendar events
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setCalendarEvents(eventsData.events || []);
      }

      // Process blocked times
      if (blockedRes.ok) {
        const blockedData = await blockedRes.json();
        setBlockedTimes(blockedData.blocked_times || []);
      }

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workspaceId, selectedDate.toDateString()]);

  return {
    todos,
    scheduledTasks,
    calendarEvents,
    blockedTimes,
    loading,
    error,
    refresh: fetchData,
  };
}
```

---

## Filtering for Display

### Filter Todos for Selected Date

```typescript
const todosForDay = useMemo(() => {
  const dayKey = format(selectedDate, 'yyyy-MM-dd');
  return todos.filter(todo => {
    if (!todo.due_date) return false;
    return todo.due_date === dayKey;
  });
}, [todos, selectedDate]);
```

### Split Todos into On-Track vs Overdue

```typescript
const { onTrackTodos, overdueTodos } = useMemo(() => {
  const now = new Date();
  const pending = todos.filter(t => t.status !== 'completed');
  
  const onTrack: Todo[] = [];
  const overdue: Todo[] = [];
  
  pending.forEach(todo => {
    if (!todo.due_date) {
      onTrack.push(todo);
      return;
    }
    
    let dueDateTime = new Date(todo.due_date);
    if (todo.due_time) {
      const [hours, minutes] = todo.due_time.split(':').map(Number);
      dueDateTime.setHours(hours, minutes, 0, 0);
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
  
  return { onTrackTodos: onTrack, overdueTodos: overdue };
}, [todos]);
```

### Filter Scheduled Tasks for Selected Date

```typescript
const dayScheduledTasks = useMemo(() => {
  const startOfDay = new Date(selectedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(selectedDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  return scheduledTasks.filter(task => {
    if (task.status === 'skipped') return false;
    const taskStart = new Date(task.scheduled_start);
    const taskEnd = new Date(task.scheduled_end);
    return taskStart < endOfDay && taskEnd > startOfDay;
  });
}, [scheduledTasks, selectedDate]);
```

### Separate All-Day vs Timed Events

```typescript
const { dayEvents, allDayEvents } = useMemo(() => {
  const dayKey = format(selectedDate, 'yyyy-MM-dd');
  const startOfDay = new Date(selectedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(selectedDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const allDay: CalendarEvent[] = [];
  const timed: CalendarEvent[] = [];
  
  calendarEvents.forEach(event => {
    if (event.is_all_day) {
      // Google Calendar uses exclusive end dates
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
  
  return { dayEvents: timed, allDayEvents: allDay };
}, [calendarEvents, selectedDate]);
```

---

## Actions

### Complete a Todo

```typescript
async function completeTodo(todoId: string): Promise<void> {
  const { error } = await supabase
    .from('todos')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: session.user.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', todoId);

  if (error) throw error;
}
```

### Complete a Scheduled Task

```http
POST /api/workspaces/{workspaceId}/planner/task/{taskId}/complete
Authorization: Bearer {access_token}
```

```typescript
async function completeScheduledTask(workspaceId: string, taskId: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/${workspaceId}/planner/task/${taskId}/complete`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` }
    }
  );
  
  if (!response.ok) throw new Error('Failed to complete task');
}
```

---

## Visual Representation Constants

```typescript
// Pixels per hour for calendar view
const PX_PER_HOUR = 60;  // Mobile (vs 80 on web)

// Calculate position for an item
function calculatePosition(startTime: Date, endTime: Date) {
  const startHour = startTime.getHours() + startTime.getMinutes() / 60;
  const endHour = endTime.getHours() + endTime.getMinutes() / 60;
  const duration = endHour - startHour;
  
  return {
    top: startHour * PX_PER_HOUR,
    height: Math.max(duration * PX_PER_HOUR, 20), // Min height 20px
  };
}
```

---

## Color Schemes

### Event/Task Status Colors
| Status | Background | Border |
|--------|------------|--------|
| Pending Task | `bg-zinc-700/40` | `border-zinc-500` |
| Completed Task | `bg-green-950/60` | `border-green-700` |
| Overdue Task | `bg-red-900/40` | `border-red-500` |
| Calendar Event | `bg-blue-950/95` | `border-blue-700` |

### Blocked Time Type Colors
| Type | Background | Border | Text |
|------|------------|--------|------|
| travel_day | `bg-amber-950/40` | `border-amber-700` | `text-amber-200` |
| vacation | `bg-purple-950/40` | `border-purple-700` | `text-purple-200` |
| away | `bg-orange-950/40` | `border-orange-700` | `text-orange-200` |
| appointment | `bg-cyan-950/40` | `border-cyan-700` | `text-cyan-200` |
| break | `bg-zinc-800/40` | `border-zinc-600` | `text-zinc-300` |
| recurring | `bg-indigo-950/40` | `border-indigo-700` | `text-indigo-200` |

---

## Real-Time Updates

For real-time updates, subscribe to Supabase channels:

```typescript
useEffect(() => {
  const channel = supabase
    .channel('calendar-updates')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'todos', filter: `workspace_id=eq.${workspaceId}` },
      (payload) => {
        // Handle todo changes
        refresh();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'scheduled_tasks', filter: `workspace_id=eq.${workspaceId}` },
      (payload) => {
        // Handle scheduled task changes
        refresh();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [workspaceId]);
```

---

## Summary of Required API Calls

| Data | Method | Endpoint |
|------|--------|----------|
| Todos | Supabase Direct | `supabase.from('todos').select(...)` |
| Scheduled Tasks | API | `GET /api/workspaces/{id}/planner/schedule` |
| Calendar Events | API | `GET /api/workspaces/{id}/calendar/events?start=...&end=...` |
| Blocked Times | API | `GET /api/workspaces/{id}/planner/block-time?start=...&end=...` |
| Complete Todo | Supabase Direct | `supabase.from('todos').update(...)` |
| Complete Task | API | `POST /api/workspaces/{id}/planner/task/{taskId}/complete` |

