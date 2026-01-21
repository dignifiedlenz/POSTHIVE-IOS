# Testing Live Activities

## Quick Test Steps

### 1. Check Device Requirements
- ✅ Physical device (simulator doesn't support Live Activities)
- ✅ iOS 18+ (since we're targeting iOS 18)
- ✅ Live Activities enabled: Settings > Face ID & Passcode > Allow Access When Locked > Live Activities

### 2. Verify Integration

The Live Activity hook needs to be integrated into your task screens. Check if it's being used:

**In TasksScreen.tsx or wherever you manage tasks:**
```typescript
import { useLiveActivity } from '../hooks/useLiveActivity';

// Get the active task
const activeTask = inProgressTodos[0]; // or however you get the active task

// Add the hook
useLiveActivity({
  task: activeTask || null,
  isActive: !!activeTask && activeTask.status === 'in_progress',
  onError: (error) => {
    console.error('Live Activity error:', error);
  },
});
```

### 3. Manual Test via React Native

You can also test manually by calling the Live Activity module directly:

```typescript
import { LiveActivity } from '../lib/LiveActivityModule';

// Check if available
const available = await LiveActivity.isAvailable();
console.log('Live Activities available:', available);

// Start a test activity
await LiveActivity.startActivity({
  id: 'test-task-123',
  title: 'Test Task',
  projectName: 'Test Project',
  estimatedMinutes: 30,
  priority: 'high',
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 30 * 60000).toISOString(),
});
```

### 4. Debug Checklist

- [ ] Is the task status actually "in_progress"?
- [ ] Is `useLiveActivity` hook being called?
- [ ] Check console logs for errors
- [ ] Verify Live Activities are enabled in device settings
- [ ] Make sure you're testing on a physical device
- [ ] Lock the device and check Lock Screen
- [ ] On iPhone 14 Pro+, check Dynamic Island

### 5. Common Issues

**Live Activity doesn't appear:**
- Check device settings (see step 1)
- Verify task has `status === 'in_progress'`
- Check console for errors
- Make sure `estimated_minutes` is set

**Error: "Live Activities not available"**
- Device might not support it
- iOS version too old
- Live Activities disabled in settings

**Activity appears but doesn't update:**
- Check that the update interval is running (should update every second)
- Verify `endTime` is correctly calculated

### 6. Test Script

Add this to a test button or screen:

```typescript
import { LiveActivity } from '../lib/LiveActivityModule';

const testLiveActivity = async () => {
  try {
    const available = await LiveActivity.isAvailable();
    console.log('Available:', available);
    
    if (!available) {
      alert('Live Activities not available on this device');
      return;
    }
    
    const testTask = {
      id: 'test-' + Date.now(),
      title: 'Test Task',
      projectName: 'Test Project',
      estimatedMinutes: 5,
      priority: 'high' as const,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 5 * 60000).toISOString(),
    };
    
    await LiveActivity.startActivity(testTask);
    console.log('Live Activity started!');
    alert('Check your Lock Screen or Dynamic Island!');
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
  }
};
```

### 7. Where to Look

- **Lock Screen**: Swipe down from top
- **Dynamic Island**: iPhone 14 Pro+ and iPhone 15+ (top of screen)
- **Banner**: When app is in background

### 8. End the Test Activity

```typescript
await LiveActivity.endActivity('test-task-123');
```












