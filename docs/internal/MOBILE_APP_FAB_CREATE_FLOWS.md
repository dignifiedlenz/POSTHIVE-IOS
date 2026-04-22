# Mobile App: FAB (Floating Action Button) Create Flows

This document details the complete implementation guide for the Floating Action Button (FAB) that provides quick access to create Projects, Deliverables, Todos, and Events in the mobile app.

---

## Table of Contents

1. [FAB Design Overview](#fab-design-overview)
2. [Create Project Flow](#1-create-project-flow)
3. [Create Deliverable Flow](#2-create-deliverable-flow)
4. [Create Todo Flow](#3-create-todo-flow)
5. [Create Event Flow](#4-create-event-flow)
6. [API Reference Summary](#api-reference-summary)
7. [Type Definitions](#type-definitions)

---

## FAB Design Overview

### Visual Design
- **Position**: Bottom-right corner, 16px from edges
- **Size**: 56x56px main button
- **Background**: White (`#FFFFFF`)
- **Icon**: Plus icon in black
- **Animation**: Expand to show menu options on tap

### Menu Items (Expanded State)
```typescript
const fabMenuItems = [
  { id: 'project', icon: 'FolderPlus', label: 'Project', color: '#3B82F6' },
  { id: 'deliverable', icon: 'Package', label: 'Deliverable', color: '#8B5CF6' },
  { id: 'todo', icon: 'CheckSquare', label: 'Task', color: '#22C55E' },
  { id: 'event', icon: 'Calendar', label: 'Event', color: '#F59E0B' },
];
```

### React Native FAB Component Structure
```tsx
interface FABProps {
  workspaceId: string;
  workspaceSlug: string;
  currentProjectId?: string; // For context-aware deliverable creation
}

export function CreateFAB({ workspaceId, workspaceSlug, currentProjectId }: FABProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeModal, setActiveModal] = useState<'project' | 'deliverable' | 'todo' | 'event' | null>(null);
  
  // ... implementation
}
```

---

## 1. Create Project Flow

### Form Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | ✅ | - | Project name |
| `description` | string | ❌ | - | Brief description |
| `deadline` | date | ✅ | - | Project deadline (YYYY-MM-DD) |
| `client_id` | string (UUID) | ✅ | - | Selected client |
| `project_type` | enum | ❌ | `'video'` | `'photo'` \| `'video'` \| `'mixed'` |
| `thumbnail` | string (URL) | ❌ | - | Thumbnail image URL |

### API Endpoint

**Method:** Supabase Direct Insert

```typescript
interface CreateProjectData {
  name: string;
  description?: string;
  deadline?: string;      // ISO date string
  client_id?: string;
  project_type?: 'photo' | 'video' | 'mixed';
  thumbnail?: string;
}

async function createProject(workspaceId: string, data: CreateProjectData): Promise<Project> {
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: data.name,
      description: data.description || null,
      deadline: data.deadline || null,
      client_id: data.client_id || null,
      project_type: data.project_type || 'video',
      created_by: session.user.id
    })
    .select()
    .single();

  if (error) throw error;
  return project;
}
```

### Required Pre-fetch Data

```typescript
// Fetch clients for dropdown
const { data: clients } = await supabase
  .from('clients')
  .select('id, name, company')
  .eq('workspace_id', workspaceId)
  .order('name');
```

### Mobile Form UI

```tsx
// Simplified form for mobile
const CreateProjectForm = () => (
  <View>
    {/* Name - Required */}
    <TextInput 
      placeholder="Project name *"
      value={name}
      onChangeText={setName}
    />
    
    {/* Client - Required Picker */}
    <ClientPicker 
      clients={clients}
      selected={clientId}
      onSelect={setClientId}
      onCreateNew={() => setShowClientForm(true)}
    />
    
    {/* Deadline - Required Date Picker */}
    <DatePicker
      label="Deadline *"
      value={deadline}
      onChange={setDeadline}
    />
    
    {/* Project Type - Optional Segmented Control */}
    <SegmentedControl
      options={['Video', 'Photo']}
      selected={projectType}
      onSelect={setProjectType}
    />
    
    {/* Description - Optional */}
    <TextInput 
      placeholder="Description (optional)"
      multiline
      value={description}
      onChangeText={setDescription}
    />
  </View>
);
```

### Validation Rules

```typescript
const validateProject = (data: CreateProjectData): string | null => {
  if (!data.name?.trim()) return 'Project name is required';
  if (!data.client_id) return 'Client is required';
  if (!data.deadline) return 'Deadline is required';
  return null;
};
```

---

## 2. Create Deliverable Flow

### Form Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | ✅ | - | Deliverable name |
| `description` | string | ❌ | - | Brief description |
| `type` | enum | ✅ | `'video'` | See types below |
| `due_date` | date | ✅* | - | Due date (*not required for `image_gallery`) |
| `due_time` | time | ❌ | `'13:00'` | Due time (HH:mm) |
| `project_id` | string | ✅ | - | Parent project (auto-filled if context available) |

### Deliverable Types

```typescript
type DeliverableType = 
  | 'video'
  | 'image'
  | 'image_gallery'  // No versions, no due date
  | 'graphic'
  | 'foto'
  | 'pdf'
  | 'audio'
  | 'document';
```

### API Endpoint

**Method:** Supabase Direct Insert

```typescript
interface CreateDeliverableData {
  name: string;
  description?: string;
  type: DeliverableType;
  due_date?: string;     // YYYY-MM-DD (not required for image_gallery)
  due_time?: string;     // HH:mm
  version?: string;      // Default 'V1', 'V0' for galleries
}

async function createDeliverable(
  projectId: string,
  data: CreateDeliverableData
): Promise<Deliverable> {
  const isImageGallery = data.type === 'image_gallery';
  const versionNumber = isImageGallery ? 0 : 1; // Galleries start at 0, others at 1
  
  const { data: deliverable, error } = await supabase
    .from('deliverables')
    .insert({
      project_id: projectId,
      name: data.name,
      description: data.description || null,
      type: data.type,
      status: 'draft',
      current_version: versionNumber,
      due_date: isImageGallery ? null : (data.due_date || null),
      due_time: isImageGallery ? null : (data.due_time || null),
      created_by: session.user.id
    })
    .select()
    .single();

  if (error) throw error;
  return deliverable;
}
```

### Required Pre-fetch Data

```typescript
// If no project context, fetch projects for selection
const { data: projects } = await supabase
  .from('projects')
  .select('id, name')
  .eq('workspace_id', workspaceId)
  .eq('status', 'active')
  .order('created_at', { ascending: false });
```

### Mobile Form UI

```tsx
const CreateDeliverableForm = () => (
  <View>
    {/* Project - Required (if no context) */}
    {!currentProjectId && (
      <ProjectPicker 
        projects={projects}
        selected={projectId}
        onSelect={setProjectId}
      />
    )}
    
    {/* Name - Required */}
    <TextInput 
      placeholder="Deliverable name *"
      value={name}
      onChangeText={setName}
    />
    
    {/* Type - Required Picker */}
    <TypePicker
      options={deliverableTypes}
      selected={type}
      onSelect={setType}
    />
    
    {/* Due Date & Time - Required (except galleries) */}
    {type !== 'image_gallery' && (
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <DatePicker
          label="Due Date *"
          value={dueDate}
          onChange={setDueDate}
        />
        <TimePicker
          label="Due Time"
          value={dueTime}
          onChange={setDueTime}
          step={15} // 15-minute intervals
        />
      </View>
    )}
    
    {/* Description - Optional */}
    <TextInput 
      placeholder="Description (optional)"
      multiline
      value={description}
      onChangeText={setDescription}
    />
    
    {/* Info Banner for Galleries */}
    {type === 'image_gallery' && (
      <InfoBanner>
        Image galleries don't have versions or due dates.
      </InfoBanner>
    )}
  </View>
);
```

### Validation Rules

```typescript
const validateDeliverable = (data: CreateDeliverableData): string | null => {
  if (!data.name?.trim()) return 'Deliverable name is required';
  if (!data.type) return 'Type is required';
  if (data.type !== 'image_gallery' && !data.due_date) {
    return 'Due date is required';
  }
  return null;
};
```

---

## 3. Create Todo Flow

### Form Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | ✅ | - | Task title |
| `description` | string | ❌ | - | Task description |
| `priority` | enum | ✅ | `'medium'` | Priority level |
| `due_date` | date | ❌ | 5h from now | Due date (YYYY-MM-DD) |
| `due_time` | time | ❌ | Rounded to 30min | Due time (HH:mm) |
| `estimated_minutes` | number | ❌ | `30` | Time estimate |
| `project_id` | string | ❌ | - | Link to project |
| `deliverable_id` | string | ❌ | - | Link to deliverable |
| `assigned_to` | string | ❌ | - | Assignee user ID |
| `is_private` | boolean | ❌ | `false` | Private task flag |

### Priority Options

```typescript
const priorities = [
  { value: 'low', label: 'Low', color: '#22C55E' },
  { value: 'medium', label: 'Medium', color: '#EAB308' },
  { value: 'high', label: 'High', color: '#F97316' },
  { value: 'urgent', label: 'Urgent', color: '#EF4444' },
];
```

### API Endpoint

**Method:** Supabase Direct Insert

```typescript
interface CreateTodoForm {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;        // YYYY-MM-DD
  due_time?: string;        // HH:mm
  estimated_minutes?: number;
  project_id?: string;
  deliverable_id?: string;
  assigned_to?: string;
  is_private?: boolean;
}

async function createTodo(
  workspaceId: string,
  data: CreateTodoForm
): Promise<Todo> {
  const { data: todo, error } = await supabase
    .from('todos')
    .insert({
      workspace_id: workspaceId,
      project_id: data.project_id || null,
      deliverable_id: data.deliverable_id || null,
      title: data.title,
      description: data.description || null,
      priority: data.priority,
      due_date: data.due_date || null,
      due_time: data.due_time || null,
      estimated_minutes: data.estimated_minutes || null,
      assigned_to: data.assigned_to || null,
      is_private: data.is_private || false,
      created_by: session.user.id
    })
    .select()
    .single();

  if (error) throw error;
  return todo;
}
```

### Required Pre-fetch Data

```typescript
// Fetch in parallel for form dropdowns
const [projects, members] = await Promise.all([
  // Projects for optional linking
  supabase
    .from('projects')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active'),
  
  // Workspace members for assignment
  supabase
    .from('workspace_members')
    .select(`
      user_id,
      users:user_id (name, email)
    `)
    .eq('workspace_id', workspaceId)
]);

// Deliverables are loaded when project is selected
async function loadDeliverables(projectId: string) {
  const { data } = await supabase
    .from('deliverables')
    .select('id, name')
    .eq('project_id', projectId);
  return data;
}
```

### Default Due Date/Time Calculation

```typescript
function getDefaultDueDateTime(): { date: string; time: string } {
  const now = new Date();
  const fiveHoursFromNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  
  // Round to nearest 30 minutes
  const minutes = fiveHoursFromNow.getMinutes();
  const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 60;
  
  let roundedDate = new Date(fiveHoursFromNow);
  if (roundedMinutes === 60) {
    roundedDate.setHours(roundedDate.getHours() + 1);
    roundedDate.setMinutes(0);
  } else {
    roundedDate.setMinutes(roundedMinutes);
    roundedDate.setSeconds(0);
    roundedDate.setMilliseconds(0);
  }
  
  const dateStr = roundedDate.toISOString().split('T')[0];
  const timeStr = `${String(roundedDate.getHours()).padStart(2, '0')}:${String(roundedDate.getMinutes()).padStart(2, '0')}`;
  
  return { date: dateStr, time: timeStr };
}
```

### Mobile Form UI

```tsx
const CreateTodoForm = () => {
  const defaultDateTime = getDefaultDueDateTime();
  
  return (
    <View>
      {/* Title with Private Toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput 
          placeholder="Task title *"
          value={title}
          onChangeText={setTitle}
          style={{ flex: 1 }}
        />
        <TouchableOpacity onPress={() => setIsPrivate(!isPrivate)}>
          {isPrivate ? <Lock /> : <Unlock />}
        </TouchableOpacity>
      </View>
      
      {/* Priority - Required */}
      <PrioritySelector
        options={priorities}
        selected={priority}
        onSelect={setPriority}
      />
      
      {/* Due Date & Time */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <DatePicker
          label="Due Date"
          value={dueDate}
          onChange={setDueDate}
        />
        <TimePicker
          label="Time"
          value={dueTime}
          onChange={setDueTime}
          step={15}
        />
      </View>
      
      {/* Estimated Time - Scroll Input */}
      <EstimatedTimeInput
        value={estimatedMinutes}
        onChange={setEstimatedMinutes}
        min={5}
        max={480}
        step={15}
      />
      
      {/* Project (Optional) */}
      <ProjectPicker 
        projects={projects}
        selected={projectId}
        onSelect={(id) => {
          setProjectId(id);
          setDeliverableId(null);
        }}
        allowNone
      />
      
      {/* Deliverable (if project selected) */}
      {projectId && (
        <DeliverablePicker 
          deliverables={deliverables}
          selected={deliverableId}
          onSelect={setDeliverableId}
          allowNone
        />
      )}
      
      {/* Assignee (hidden if private) */}
      {!isPrivate && (
        <MemberPicker 
          members={members}
          selected={assignedTo}
          onSelect={setAssignedTo}
          allowNone
        />
      )}
      
      {/* Description */}
      <TextInput 
        placeholder="Description (optional)"
        multiline
        value={description}
        onChangeText={setDescription}
      />
    </View>
  );
};
```

### Validation Rules

```typescript
const validateTodo = (data: CreateTodoForm): string | null => {
  if (!data.title?.trim()) return 'Task title is required';
  if (!data.priority) return 'Priority is required';
  return null;
};
```

---

## 4. Create Event Flow

### Form Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | ✅ | - | Event title |
| `description` | string | ❌ | - | Event description |
| `start_time` | datetime | ✅ | Now + 1h | Start time (ISO) |
| `end_time` | datetime | ✅ | Start + 1h | End time (ISO) |
| `is_all_day` | boolean | ❌ | `false` | All-day event flag |
| `location` | string | ❌ | - | Event location |
| `meeting_link` | string | ❌ | - | Video call URL |
| `project_id` | string | ❌ | - | Link to project |
| `syncToGoogle` | boolean | ❌ | `false` | Sync to Google Calendar |
| `googleCalendarId` | string | ❌ | - | Target Google calendar |

### API Endpoint

**HTTP API (for Google Calendar sync support)**

```http
POST /api/workspaces/{workspaceId}/calendar/events
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "title": "Team Meeting",
  "description": "Weekly sync",
  "start_time": "2024-12-16T14:00:00.000Z",
  "end_time": "2024-12-16T15:00:00.000Z",
  "is_all_day": false,
  "location": "Conference Room A",
  "meeting_link": "https://meet.google.com/abc-defg-hij",
  "syncToGoogle": true,
  "googleCalendarId": "primary"
}
```

**Response:**
```json
{
  "success": true,
  "eventId": "uuid"
}
```

### Implementation

```typescript
interface CreateEventParams {
  title: string;
  description?: string;
  start_time: string;       // ISO timestamp
  end_time: string;         // ISO timestamp
  is_all_day?: boolean;
  location?: string;
  meeting_link?: string;
  project_id?: string;
  syncToGoogle?: boolean;
  googleCalendarId?: string;
}

async function createEvent(
  workspaceId: string,
  data: CreateEventParams
): Promise<{ success: boolean; eventId?: string }> {
  const { data: session } = await supabase.auth.getSession();
  
  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/${workspaceId}/calendar/events`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session?.access_token}`
      },
      body: JSON.stringify(data)
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create event');
  }
  
  return response.json();
}
```

### Required Pre-fetch Data

```typescript
// Fetch connected Google calendars for sync option
async function fetchCalendars(workspaceId: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/${workspaceId}/calendar/calendars`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (response.ok) {
    const data = await response.json();
    return data.calendars || [];
  }
  return [];
}
```

### Mobile Form UI

```tsx
const CreateEventForm = () => {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 60 * 60 * 1000));
  
  return (
    <View>
      {/* Google Calendar Sync (if connected) */}
      {calendars.length > 0 && (
        <CalendarPicker
          calendars={[
            { id: 'none', name: "Don't sync to calendar" },
            ...calendars
          ]}
          selected={selectedCalendar}
          onSelect={setSelectedCalendar}
        />
      )}
      
      {selectedCalendar !== 'none' && (
        <InfoBanner type="success">
          ✓ This event will sync to Google Calendar
        </InfoBanner>
      )}
      
      {/* Title - Required */}
      <TextInput 
        placeholder="Event title *"
        value={title}
        onChangeText={setTitle}
      />
      
      {/* All Day Toggle */}
      <SwitchRow
        label="All-day event"
        value={isAllDay}
        onValueChange={setIsAllDay}
      />
      
      {/* Start Date/Time */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <DatePicker
          label="Start Date"
          value={startDate}
          onChange={setStartDate}
        />
        {!isAllDay && (
          <TimePicker
            label="Start Time"
            value={startDate}
            onChange={setStartDate}
          />
        )}
      </View>
      
      {/* End Date/Time */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <DatePicker
          label="End Date"
          value={endDate}
          onChange={setEndDate}
          minimumDate={startDate}
        />
        {!isAllDay && (
          <TimePicker
            label="End Time"
            value={endDate}
            onChange={setEndDate}
          />
        )}
      </View>
      
      {/* Location */}
      <TextInput 
        placeholder="Location (optional)"
        value={location}
        onChangeText={setLocation}
      />
      
      {/* Meeting Link */}
      <TextInput 
        placeholder="Meeting link (optional)"
        value={meetingLink}
        onChangeText={setMeetingLink}
        keyboardType="url"
        autoCapitalize="none"
      />
      
      {/* Description */}
      <TextInput 
        placeholder="Description (optional)"
        multiline
        value={description}
        onChangeText={setDescription}
      />
    </View>
  );
};
```

### Validation Rules

```typescript
const validateEvent = (data: CreateEventParams): string | null => {
  if (!data.title?.trim()) return 'Event title is required';
  
  const start = new Date(data.start_time);
  const end = new Date(data.end_time);
  
  if (end <= start) return 'End time must be after start time';
  
  if (data.meeting_link && !isValidUrl(data.meeting_link)) {
    return 'Invalid meeting link URL';
  }
  
  return null;
};

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
```

---

## API Reference Summary

| Action | Method | Endpoint/Table |
|--------|--------|----------------|
| Create Project | Supabase | `projects` table |
| Create Deliverable | Supabase | `deliverables` table |
| Create Todo | Supabase | `todos` table |
| Create Event | HTTP API | `POST /api/workspaces/{id}/calendar/events` |
| Get Clients | Supabase | `clients` table |
| Get Projects | Supabase | `projects` table |
| Get Deliverables | Supabase | `deliverables` table |
| Get Members | Supabase | `workspace_members` table |
| Get Calendars | HTTP API | `GET /api/workspaces/{id}/calendar/calendars` |

---

## Type Definitions

### Project

```typescript
interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived' | 'completed';
  deadline: string | null;
  client_id?: string;
  thumbnail: string | null;
  project_type: 'photo' | 'video' | 'mixed';
  workspace_id: string;
  created_by: string;
  created_at: string;
  updated_at: string | null;
}
```

### Deliverable

```typescript
interface Deliverable {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  type?: 'video' | 'image' | 'image_gallery' | 'graphic' | 'pdf' | 'audio' | 'document' | 'foto';
  version: string;
  status: 'draft' | 'in-review' | 'approved' | 'delivered';
  due_date: string;
  due_time?: string;
  created_at: string;
  created_by: string;
}
```

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
  due_date?: string;
  due_time?: string;
  estimated_minutes?: number;
  assigned_to?: string;
  is_private?: boolean;
  created_by: string;
  created_at: string;
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
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location: string | null;
  meeting_link: string | null;
  calendar_name: string | null;
  calendar_color: string | null;
  created_by: string | null;
  project_id: string | null;
}
```

---

## Success/Error Handling

### Success Callbacks

```typescript
const handleSuccess = {
  project: (project: Project) => {
    // Navigate to new project
    navigation.navigate('ProjectDetail', { projectId: project.id });
    // Or show toast
    Toast.show('Project created successfully');
  },
  
  deliverable: (deliverable: Deliverable) => {
    // Refresh parent list
    queryClient.invalidateQueries(['deliverables', projectId]);
    Toast.show('Deliverable created');
  },
  
  todo: (todo: Todo) => {
    // Dispatch event for real-time UI update
    EventEmitter.emit('todo-created', todo);
    Toast.show('Task created');
  },
  
  event: (event: CalendarEvent) => {
    // Refresh calendar view
    queryClient.invalidateQueries(['calendar-events']);
    Toast.show('Event created');
  },
};
```

### Error Display

```typescript
const ErrorBanner = ({ message }: { message: string }) => (
  <View style={styles.errorBanner}>
    <AlertCircle size={16} color="#EF4444" />
    <Text style={styles.errorText}>{message}</Text>
  </View>
);
```

---

## Styling Reference

### Colors

| State | Background | Border | Text |
|-------|------------|--------|------|
| Default Input | `#18181B` (zinc-900) | `#52525B` (zinc-600) | `#FFFFFF` |
| Focus Input | `#18181B` | `#A1A1AA` (zinc-400) | `#FFFFFF` |
| Error | `#7F1D1D/50` | `#B91C1C` | `#FECACA` |
| Primary Button | `#FFFFFF` | - | `#000000` |
| Secondary Button | `transparent` | `#52525B` | `#A1A1AA` |

### Common Styles

```typescript
const styles = StyleSheet.create({
  input: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#52525B',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#D4D4D8', // zinc-300
    marginBottom: 6,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#000000',
    fontWeight: '500',
    fontSize: 14,
  },
});
```

