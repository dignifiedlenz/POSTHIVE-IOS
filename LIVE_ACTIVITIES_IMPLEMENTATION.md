# iOS Live Activities & Dynamic Island Implementation

## Overview

This document outlines the implementation of iOS Live Activities and Dynamic Island support for displaying the current active task and remaining time in PostHive Companion.

## Features

- **Live Activity**: Shows current task name and countdown timer on Lock Screen
- **Dynamic Island**: Displays task info in Dynamic Island (iPhone 14 Pro+ and iPhone 15+)
- **Real-time Updates**: Updates countdown timer every second
- **Task Management**: Start/stop Live Activity when tasks are marked as active/completed

## Requirements

- iOS 16.1+ for Live Activities
- iPhone 14 Pro/Pro Max or iPhone 15+ for Dynamic Island
- ActivityKit framework
- WidgetKit for widget extension

## Architecture

### Components

1. **Native iOS Module** (`LiveActivityModule.swift`)
   - Bridge between React Native and ActivityKit
   - Methods: `startActivity`, `updateActivity`, `endActivity`

2. **Widget Extension** (`TaskLiveActivityWidget.swift`)
   - SwiftUI widget that displays task info
   - Updates every second with countdown timer
   - Supports compact, expanded, and minimal presentations

3. **React Native Bridge** (`LiveActivityModule.ts`)
   - TypeScript interface for native module
   - Provides hooks for easy integration

4. **React Hook** (`useLiveActivity.ts`)
   - Manages Live Activity lifecycle
   - Automatically starts/stops based on task status

## Data Structure

```typescript
interface LiveActivityTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  startTime: string; // ISO timestamp
  endTime: string;   // ISO timestamp
  projectName?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}
```

## Implementation Steps

1. ✅ Add Live Activities capability to Info.plist
2. ✅ Create Widget Extension target
3. ✅ Implement native Swift module
4. ✅ Create React Native bridge
5. ✅ Build SwiftUI widget
6. ✅ Integrate with task management hooks
7. ✅ Test on device (simulator doesn't support Live Activities)

## Usage

```typescript
import { useLiveActivity } from '../hooks/useLiveActivity';

function TaskComponent({ task }) {
  const { startActivity, updateActivity, endActivity } = useLiveActivity();
  
  const handleStartTask = async () => {
    await startActivity({
      id: task.id,
      title: task.title,
      estimatedMinutes: task.estimated_minutes,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + task.estimated_minutes * 60000).toISOString(),
      projectName: task.project_name,
      priority: task.priority,
    });
  };
  
  // ...
}
```

## Resources

- [Apple ActivityKit Documentation](https://developer.apple.com/documentation/activitykit)
- [React Native Live Activities Example](https://github.com/rgommezz/timer-live-activity)
- [WidgetKit Documentation](https://developer.apple.com/documentation/widgetkit)












