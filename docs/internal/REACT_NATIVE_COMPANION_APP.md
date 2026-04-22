# PostHive iOS Companion App - Build Specification

## OBJECTIVE
Build a React Native iOS app for PostHive with exactly 3 features: Notifications, Task Management, and Deliverable Review.

---

## STEP 1: PROJECT INITIALIZATION

Execute these commands:
```bash
npx react-native@latest init PostHiveCompanion --template react-native-template-typescript
cd PostHiveCompanion
npm install @supabase/supabase-js @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated @react-native-async-storage/async-storage date-fns react-native-video react-native-svg lucide-react-native
cd ios && pod install && cd ..
```

---

## STEP 2: FILE STRUCTURE

Create this exact structure:
```
src/
├── app/
│   └── App.tsx
├── lib/
│   ├── supabase.ts
│   ├── api.ts
│   └── types.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useNotifications.ts
│   ├── useTodos.ts
│   └── useDeliverables.ts
├── screens/
│   ├── auth/
│   │   └── LoginScreen.tsx
│   ├── notifications/
│   │   └── NotificationsScreen.tsx
│   ├── tasks/
│   │   ├── TasksScreen.tsx
│   │   └── CreateTodoScreen.tsx
│   └── deliverables/
│       ├── DeliverablesScreen.tsx
│       └── DeliverableReviewScreen.tsx
├── components/
│   ├── NotificationItem.tsx
│   ├── TodoItem.tsx
│   ├── DeliverableCard.tsx
│   ├── CommentItem.tsx
│   ├── VideoPlayer.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Badge.tsx
│       └── Avatar.tsx
└── theme/
    └── index.ts
```

---

## STEP 3: ENVIRONMENT CONFIGURATION

Create `.env`:
```
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY]
API_BASE_URL=https://[POSTHIVE_DOMAIN]
```

---

## STEP 4: THEME & STYLE GUIDE

### Color Palette
Create `src/theme/index.ts`:
```typescript
export const theme = {
  colors: {
    // Backgrounds
    background: '#000000',
    surface: '#0A0A0A',
    surfaceElevated: '#141414',
    surfaceBorder: '#1F1F1F',
    
    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#A1A1A1',
    textMuted: '#6B6B6B',
    textInverse: '#000000',
    
    // Accent (PostHive brand)
    accent: '#3B82F6',       // Blue
    accentLight: '#60A5FA',
    accentDark: '#2563EB',
    
    // Status colors
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    
    // Priority colors
    priorityUrgent: '#EF4444',
    priorityHigh: '#F59E0B',
    priorityMedium: '#3B82F6',
    priorityLow: '#6B7280',
    
    // Status badges
    statusPending: '#6B7280',
    statusInProgress: '#F59E0B',
    statusCompleted: '#22C55E',
    statusDraft: '#6B7280',
    statusReview: '#F59E0B',
    statusApproved: '#22C55E',
    statusFinal: '#8B5CF6',
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  
  typography: {
    // Use SF Pro on iOS (system font)
    fontFamily: {
      regular: 'System',
      medium: 'System',
      semibold: 'System',
      bold: 'System',
    },
    fontSize: {
      xs: 11,
      sm: 13,
      md: 15,
      lg: 17,
      xl: 20,
      xxl: 28,
      xxxl: 34,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
  },
};

export type Theme = typeof theme;
```

### Design Principles
1. **Dark mode only** - Pure black (#000000) background for OLED
2. **Minimal borders** - Use subtle #1F1F1F borders sparingly
3. **High contrast text** - White (#FFFFFF) on black
4. **Accent for actions** - Blue (#3B82F6) for interactive elements
5. **Status colors** - Consistent use of green/yellow/red for status
6. **Touch targets** - Minimum 44pt for all tappable elements
7. **Card-based layout** - Use surfaceElevated (#141414) for cards

### Component Styling Rules
- All cards: `backgroundColor: theme.colors.surfaceElevated`, `borderRadius: theme.borderRadius.lg`
- All lists: No separators, use spacing between items
- Buttons: Full-width primary, icon-only secondary
- Inputs: Dark background (#141414), white text, subtle border on focus
- Badges: Pill-shaped, colored background with white text

---

## STEP 5: TYPE DEFINITIONS

Create `src/lib/types.ts`:
```typescript
// ===== NOTIFICATIONS =====
export type NotificationType =
  | 'comment_added'
  | 'comment_reply'
  | 'comment_mention'
  | 'comment_resolved'
  | 'version_uploaded'
  | 'version_signed_off'
  | 'deliverable_created'
  | 'deliverable_status_changed'
  | 'deliverable_due_soon'
  | 'deliverable_overdue'
  | 'todo_assigned'
  | 'todo_due_soon'
  | 'todo_overdue'
  | 'todo_completed'
  | 'project_created'
  | 'project_deadline_approaching'
  | 'project_assigned'
  | 'workspace_invite'
  | 'workspace_member_joined'
  | 'dropzone_file_uploaded'
  | 'transfer_downloaded'
  | 'transcription_completed'
  | 'upload_completed';

export interface Notification {
  id: string;
  user_id: string;
  workspace_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  project_id?: string;
  deliverable_id?: string;
  version_id?: string;
  comment_id?: string;
  todo_id?: string;
  actor_id?: string;
  seen_at?: string;
  read_at?: string;
  created_at: string;
}

// ===== TODOS =====
export type TodoStatus = 'pending' | 'in_progress' | 'completed';
export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Todo {
  id: string;
  workspace_id: string;
  project_id?: string;
  deliverable_id?: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  due_date?: string;
  due_time?: string;
  estimated_minutes?: number;
  assigned_to?: string;
  assigned_name?: string;
  created_by: string;
  completed_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  project_name?: string;
  deliverable_name?: string;
  is_private?: boolean;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority: TodoPriority;
  due_date?: string;
  due_time?: string;
  estimated_minutes?: number;
  assigned_to?: string;
  project_id?: string;
  deliverable_id?: string;
  is_private?: boolean;
}

// ===== DELIVERABLES =====
export type DeliverableType = 'video' | 'image' | 'pdf' | 'audio' | 'document' | 'image_gallery';
export type DeliverableStatus = 'draft' | 'review' | 'approved' | 'final';

export interface Deliverable {
  id: string;
  project_id: string;
  project_name?: string;
  name: string;
  description?: string;
  type: DeliverableType;
  status: DeliverableStatus;
  due_date?: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  current_version?: number;
  unread_comment_count?: number;
  latest_version?: Version;
}

export interface Version {
  id: string;
  deliverable_id: string;
  version_number: number;
  file_url: string;
  thumbnail_url?: string;
  uploaded_at: string;
  bunny_hls_url?: string;
}

// ===== COMMENTS =====
export interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  created_at: string;
  start_time?: number;
  end_time?: number;
  timestamp?: number;
  version_number: number;
  completed?: boolean;
  completed_by?: string;
  completed_at?: string;
  parent_id?: string;
  replies?: Comment[];
}

// ===== WORKSPACE =====
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}
```

---

## STEP 6: SUPABASE CLIENT

Create `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
```

---

## STEP 7: API FUNCTIONS

Create `src/lib/api.ts`:
```typescript
import { supabase } from './supabase';
import { Notification, Todo, CreateTodoInput, Deliverable, Comment } from './types';

// ===== NOTIFICATIONS =====

export async function getNotifications(workspaceId: string, limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function getUnreadCount(workspaceId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .is('seen_at', null);
  
  if (error) throw error;
  return count || 0;
}

export async function markNotificationSeen(notificationId: string, userId: string): Promise<void> {
  await supabase.rpc('mark_notification_seen', {
    p_notification_id: notificationId,
    p_user_id: userId,
  });
}

export async function markAllNotificationsSeen(userId: string, workspaceId: string): Promise<void> {
  await supabase.rpc('mark_all_notifications_seen', {
    p_user_id: userId,
    p_workspace_id: workspaceId,
  });
}

// ===== TODOS =====

export async function getTodos(workspaceId: string): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select(`
      *,
      assigned_user:assigned_to(name),
      project:project_id(name),
      deliverable:deliverable_id(name)
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((todo: any) => ({
    ...todo,
    assigned_name: todo.assigned_user?.name,
    project_name: todo.project?.name,
    deliverable_name: todo.deliverable?.name,
  }));
}

export async function createTodo(workspaceId: string, userId: string, input: CreateTodoInput): Promise<Todo> {
  const { data, error } = await supabase
    .from('todos')
    .insert({
      workspace_id: workspaceId,
      title: input.title,
      description: input.description || null,
      priority: input.priority,
      due_date: input.due_date || null,
      due_time: input.due_time || null,
      estimated_minutes: input.estimated_minutes || null,
      assigned_to: input.assigned_to || null,
      project_id: input.project_id || null,
      deliverable_id: input.deliverable_id || null,
      is_private: input.is_private || false,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTodoStatus(todoId: string, status: 'pending' | 'in_progress' | 'completed', userId: string): Promise<void> {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };
  
  if (status === 'completed') {
    updateData.completed_by = userId;
    updateData.completed_at = new Date().toISOString();
  } else {
    updateData.completed_by = null;
    updateData.completed_at = null;
  }

  const { error } = await supabase
    .from('todos')
    .update(updateData)
    .eq('id', todoId);

  if (error) throw error;
}

export async function deleteTodo(todoId: string): Promise<void> {
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', todoId);

  if (error) throw error;
}

// ===== DELIVERABLES =====

export async function getRecentDeliverables(workspaceId: string, userId: string): Promise<Deliverable[]> {
  const { data, error } = await supabase
    .rpc('get_workspace_deliverables_dashboard', {
      p_workspace_id: workspaceId,
      p_limit: 30,
      p_user_id: userId,
    });

  if (error) {
    // Fallback to view
    const { data: viewData, error: viewError } = await supabase
      .from('workspace_deliverables_dashboard')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(30);
    
    if (viewError) throw viewError;
    return viewData || [];
  }

  return data || [];
}

export async function getDeliverableComments(deliverableId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      author:users!comments_author_id_fkey (id, name, email, avatar),
      version:versions!comments_version_id_fkey (id, version_number, deliverable_id)
    `)
    .eq('version.deliverable_id', deliverableId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || [])
    .filter((c: any) => c.version !== null)
    .map((c: any) => ({
      id: c.id,
      content: c.content,
      author: c.author,
      created_at: c.created_at,
      start_time: c.start_time,
      end_time: c.end_time,
      timestamp: c.timestamp,
      version_number: c.version.version_number,
      completed: c.completed,
      completed_by: c.completed_by,
      completed_at: c.completed_at,
      parent_id: c.parent_id,
    }));
}

export async function addComment(
  deliverableId: string,
  versionNumber: number,
  userId: string,
  content: string,
  startTime?: number,
  endTime?: number,
  parentId?: string
): Promise<void> {
  // Get version ID
  const { data: versionData, error: versionError } = await supabase
    .from('versions')
    .select('id')
    .eq('deliverable_id', deliverableId)
    .eq('version_number', versionNumber)
    .single();

  if (versionError) throw versionError;

  const { error } = await supabase
    .from('comments')
    .insert({
      version_id: versionData.id,
      author_id: userId,
      content,
      start_time: startTime ?? null,
      end_time: endTime ?? null,
      timestamp: startTime ?? null,
      parent_id: parentId ?? null,
    });

  if (error) throw error;
}

export async function toggleCommentComplete(commentId: string, currentlyCompleted: boolean, userId: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .update({
      completed: !currentlyCompleted,
      completed_by: !currentlyCompleted ? userId : null,
      completed_at: !currentlyCompleted ? new Date().toISOString() : null,
    })
    .eq('id', commentId);

  if (error) throw error;
}

// ===== WORKSPACES =====

export async function getUserWorkspaces(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(`
      role,
      workspace:workspaces (id, name, slug, logo)
    `)
    .eq('user_id', userId);

  if (error) throw error;
  return (data || []).map((m: any) => ({ ...m.workspace, role: m.role }));
}
```

---

## STEP 8: SCREEN SPECIFICATIONS

### 8.1 Login Screen
**Path:** `src/screens/auth/LoginScreen.tsx`

**UI Elements:**
- PostHive logo at top (centered)
- Email input field
- Password input field
- "Sign In" primary button (full width)
- Loading state on button when submitting

**Behavior:**
- Call `signIn(email, password)` on submit
- Navigate to main app on success
- Show error toast on failure

### 8.2 Notifications Screen
**Path:** `src/screens/notifications/NotificationsScreen.tsx`

**UI Elements:**
- Header: "Notifications" title + unread count badge
- "Mark all as read" button (top right)
- FlatList of NotificationItem components
- Pull-to-refresh
- Empty state when no notifications

**NotificationItem Component:**
- Icon based on notification type (left)
- Title (bold, white)
- Message (secondary color)
- Time ago (muted, right aligned)
- Blue dot indicator if unread (seen_at is null)
- Tappable - navigate to relevant screen based on type

**Notification Type → Icon Mapping:**
```
comment_added, comment_reply, comment_mention → MessageCircle
todo_assigned, todo_completed → CheckSquare
deliverable_created, version_uploaded → Film
project_created → Folder
workspace_invite → UserPlus
default → Bell
```

### 8.3 Tasks Screen
**Path:** `src/screens/tasks/TasksScreen.tsx`

**UI Elements:**
- Header: "Tasks" title + "+" button to create
- Segmented control: "Pending" | "In Progress" | "Completed"
- FlatList of TodoItem components filtered by selected segment
- Pull-to-refresh
- Floating action button to create new todo

**TodoItem Component:**
- Checkbox (left) - toggles status
- Title (white, strikethrough if completed)
- Due date badge (colored by urgency: red if overdue, yellow if today, gray otherwise)
- Priority indicator (colored dot)
- Project name (muted, if assigned)
- Swipe left to delete

**Priority Colors:**
```
urgent → #EF4444 (red)
high → #F59E0B (yellow)
medium → #3B82F6 (blue)
low → #6B7280 (gray)
```

### 8.4 Create Todo Screen
**Path:** `src/screens/tasks/CreateTodoScreen.tsx`

**UI Elements:**
- Header: "New Task" + Cancel button + Save button
- Title input (required)
- Description textarea (optional)
- Priority picker (low/medium/high/urgent)
- Due date picker (optional)
- Due time picker (optional, only if date selected)
- Estimated time input in minutes (optional)

**Behavior:**
- Validate title is not empty
- Call `createTodo()` on save
- Navigate back on success

### 8.5 Deliverables Screen
**Path:** `src/screens/deliverables/DeliverablesScreen.tsx`

**UI Elements:**
- Header: "Deliverables" title
- FlatList of DeliverableCard components
- Pull-to-refresh
- Cards sorted by updated_at (most recent first)

**DeliverableCard Component:**
- Thumbnail image (left, 60x60, rounded)
- Name (white, bold)
- Project name (muted)
- Status badge (colored pill)
- Unread comment count badge (blue, if > 0)
- Due date (if exists, colored by urgency)
- Tap to navigate to review screen

**Status Badge Colors:**
```
draft → gray background
review → yellow background
approved → green background
final → purple background
```

### 8.6 Deliverable Review Screen
**Path:** `src/screens/deliverables/DeliverableReviewScreen.tsx`

**UI Elements:**
- Video player (top half of screen) with controls
- Version selector (V1, V2, etc.)
- Comments list (bottom half, scrollable)
- Comment input bar (bottom, sticky)
- Each comment shows timestamp link (tappable to seek)

**VideoPlayer Component:**
- Use react-native-video with HLS source
- Show current time / duration
- Play/pause button
- Seek bar
- Fullscreen toggle

**CommentItem Component:**
- Author avatar (small, left)
- Author name (bold)
- Timestamp badge (tappable, seeks video)
- Content text
- Completion checkbox (if user can mark complete)
- Time ago (muted)
- Reply button

**Comment Input:**
- Text input
- "Add at [current time]" button
- Send button

---

## STEP 9: NAVIGATION SETUP

Create `src/app/App.tsx`:
```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Bell, CheckSquare, Film } from 'lucide-react-native';
import { theme } from '../theme';

// Import screens
import LoginScreen from '../screens/auth/LoginScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import TasksScreen from '../screens/tasks/TasksScreen';
import CreateTodoScreen from '../screens/tasks/CreateTodoScreen';
import DeliverablesScreen from '../screens/deliverables/DeliverablesScreen';
import DeliverableReviewScreen from '../screens/deliverables/DeliverableReviewScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function TasksStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TasksList" component={TasksScreen} />
      <Stack.Screen name="CreateTodo" component={CreateTodoScreen} />
    </Stack.Navigator>
  );
}

function DeliverablesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DeliverablesList" component={DeliverablesScreen} />
      <Stack.Screen name="DeliverableReview" component={DeliverableReviewScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.surfaceBorder,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksStack}
        options={{
          tabBarIcon: ({ color, size }) => <CheckSquare color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Deliverables"
        component={DeliverablesStack}
        options={{
          tabBarIcon: ({ color, size }) => <Film color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  // Check auth state on mount using useAuth hook
  
  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <LoginScreen />}
    </NavigationContainer>
  );
}
```

---

## STEP 10: REAL-TIME SUBSCRIPTIONS

Implement in `useNotifications` hook:
```typescript
useEffect(() => {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        // Prepend new notification to list
        setNotifications(prev => [payload.new as Notification, ...prev]);
        // Increment unread count
        setUnreadCount(prev => prev + 1);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

---

## STEP 11: UTILITY FUNCTIONS

Create `src/lib/utils.ts`:
```typescript
import { formatDistanceToNow, format, isToday, isTomorrow, isPast } from 'date-fns';

export function formatTimeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDueDate(date: string): string {
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
}

export function getDueDateColor(date: string, colors: any): string {
  const d = new Date(date);
  if (isPast(d) && !isToday(d)) return colors.error;
  if (isToday(d)) return colors.warning;
  return colors.textMuted;
}

export function formatVideoTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
```

---

## SUMMARY

This specification defines a React Native iOS app with:

1. **Notifications Tab** - View/manage notifications with real-time updates
2. **Tasks Tab** - Full CRUD for todos with status/priority management
3. **Deliverables Tab** - Browse deliverables, review videos, add timestamped comments

**Key Technical Points:**
- Supabase for auth and database
- Dark theme (pure black background)
- Real-time subscriptions for notifications
- Video playback via react-native-video with HLS
- Bottom tab navigation with stack navigators per tab

**Build the screens in this order:**
1. Theme + types
2. Supabase client + API functions
3. Login screen
4. Tab navigation shell
5. Notifications screen
6. Tasks screen + Create todo
7. Deliverables screen + Review screen
