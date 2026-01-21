# Live Activities Integration Example

## Basic Usage

Here's how to integrate Live Activities into your task management screens:

### Example: TasksScreen Integration

```typescript
import { useLiveActivity } from '../hooks/useLiveActivity';
import { useTodos } from '../hooks/useTodos';
import { Todo } from '../lib/types';

export function TasksScreen() {
  const { inProgressTodos } = useTodos({ workspaceId, userId });
  
  // Get the currently active task (first in-progress task)
  const activeTask = inProgressTodos[0];
  
  // Automatically manage Live Activity for active task
  useLiveActivity({
    task: activeTask || null,
    isActive: !!activeTask,
    onError: (error) => {
      console.error('Live Activity error:', error);
      // Optionally show user-friendly error message
    },
  });

  // ... rest of component
}
```

### Example: Task Detail Component

```typescript
import { useLiveActivity } from '../hooks/useLiveActivity';

function TaskDetailComponent({ task }: { task: Todo }) {
  const [isActive, setIsActive] = useState(task.status === 'in_progress');
  
  // Manage Live Activity based on task status
  useLiveActivity({
    task,
    isActive,
    onError: (error) => {
      Alert.alert('Live Activity Error', error.message);
    },
  });

  const handleToggleStatus = async () => {
    const newStatus = isActive ? 'completed' : 'in_progress';
    await updateTodoStatus(task.id, newStatus);
    setIsActive(newStatus === 'in_progress');
  };

  return (
    <View>
      <Text>{task.title}</Text>
      <Button 
        title={isActive ? 'Complete Task' : 'Start Task'}
        onPress={handleToggleStatus}
      />
    </View>
  );
}
```

### Example: Manual Control

If you need more control over when Live Activities start/stop:

```typescript
import { LiveActivity } from '../lib/LiveActivityModule';
import { Todo } from '../lib/types';

async function startTaskWithLiveActivity(todo: Todo) {
  // Check if available
  const available = await LiveActivity.isAvailable();
  if (!available) {
    console.log('Live Activities not available');
    return;
  }

  // Start Live Activity
  const startTime = new Date().toISOString();
  const endTime = new Date(Date.now() + (todo.estimated_minutes || 60) * 60000).toISOString();
  
  await LiveActivity.startActivity({
    id: todo.id,
    title: todo.title,
    projectName: todo.project_name,
    estimatedMinutes: todo.estimated_minutes || 60,
    priority: todo.priority,
    startTime,
    endTime,
  });
}

async function completeTaskWithLiveActivity(todoId: string) {
  await LiveActivity.endActivity(todoId);
}
```

## Integration Points

### 1. When Task Status Changes to "in_progress"

```typescript
const handleStartTask = async (todo: Todo) => {
  await updateTodoStatus(todo.id, 'in_progress');
  // Live Activity will automatically start via useLiveActivity hook
};
```

### 2. When Task Status Changes to "completed"

```typescript
const handleCompleteTask = async (todo: Todo) => {
  await updateTodoStatus(todo.id, 'completed');
  // Live Activity will automatically end via useLiveActivity hook
};
```

### 3. When Task Time Needs to be Extended

```typescript
const handleExtendTime = async (todo: Todo, additionalMinutes: number) => {
  const newEndTime = new Date(Date.now() + additionalMinutes * 60000).toISOString();
  
  // Update Live Activity with new end time
  await LiveActivity.startActivity({
    ...todo,
    endTime: newEndTime,
  });
};
```

## Best Practices

1. **Always check availability**: Use `LiveActivity.isAvailable()` before attempting to use Live Activities
2. **Handle errors gracefully**: Provide fallback behavior if Live Activities aren't available
3. **Clean up on unmount**: The `useLiveActivity` hook automatically cleans up, but if using manual control, make sure to end activities
4. **Update frequently**: The hook updates every second, but you can update more frequently if needed
5. **Test on physical device**: Live Activities don't work in the iOS simulator

## UI Considerations

- Show a badge or indicator when Live Activity is active
- Provide a way to manually end Live Activity if needed
- Consider showing remaining time in the app UI as well
- Add settings to enable/disable Live Activities

## Error Handling

```typescript
useLiveActivity({
  task: activeTask,
  isActive: !!activeTask,
  onError: (error) => {
    // Log error for debugging
    console.error('Live Activity error:', error);
    
    // Show user-friendly message if needed
    if (error.message.includes('NOT_SUPPORTED')) {
      // Device doesn't support Live Activities
      return;
    }
    
    // Other errors - could show toast or alert
    Alert.alert(
      'Live Activity Error',
      'Unable to update Live Activity. The task timer will continue in the app.',
    );
  },
});
```












