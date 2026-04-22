# Live Activities & Dynamic Island Setup Guide

## Overview

This guide will help you set up iOS Live Activities and Dynamic Island support for displaying active tasks in PostHive Companion.

## Prerequisites

- Xcode 14.0 or later
- iOS 16.1+ deployment target
- Physical device (Live Activities don't work in simulator)
- iPhone 14 Pro/Pro Max or iPhone 15+ for Dynamic Island (other devices show on Lock Screen)

## Step 1: Add Widget Extension Target

1. Open `PostHiveCompanion.xcworkspace` in Xcode
2. File > New > Target
3. Select "Widget Extension"
4. Name it: `TaskLiveActivityWidget`
5. Product Name: `TaskLiveActivityWidget`
6. Language: Swift
7. Include Configuration Intent: No
8. Click Finish

## Step 2: Configure Widget Extension

1. Select the `TaskLiveActivityWidget` target
2. Go to "Signing & Capabilities"
3. Add capability: "Push Notifications" (if not already added)
4. Set Deployment Target to iOS 16.1

## Step 3: Add ActivityKit Framework

1. Select the `TaskLiveActivityWidget` target
2. Go to "Build Phases"
3. Expand "Link Binary With Libraries"
4. Click "+" and add:
   - `ActivityKit.framework`
   - `WidgetKit.framework`

## Step 4: Add Swift Files

1. Copy `TaskLiveActivityWidget.swift` from `ios/WidgetExtension/` to the Widget Extension target folder
2. In Xcode, right-click the Widget Extension folder > "Add Files to TaskLiveActivityWidget"
3. Select `TaskLiveActivityWidget.swift`
4. Make sure "Copy items if needed" is checked
5. Ensure it's added to the `TaskLiveActivityWidget` target (not the main app target)

## Step 5: Update Info.plist

The main app's `Info.plist` has already been updated with `NSSupportsLiveActivities = true`.

## Step 6: Register Widget

In the Widget Extension's main file (usually `TaskLiveActivityWidget.swift`), make sure you have:

```swift
@main
struct TaskLiveActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        TaskLiveActivityWidget()
    }
}
```

## Step 7: Build and Test

1. Connect a physical iOS device (iPhone 14 Pro+ recommended)
2. Select the device as your build target
3. Build and run the app
4. When you mark a task as "in_progress", the Live Activity should appear

## Usage in React Native

```typescript
import { useLiveActivity } from '../hooks/useLiveActivity';
import { Todo } from '../lib/types';

function TaskComponent({ task }: { task: Todo }) {
  const isActive = task.status === 'in_progress';
  
  useLiveActivity({
    task,
    isActive,
    onError: (error) => {
      console.error('Live Activity error:', error);
    },
  });

  // ... rest of component
}
```

## Testing

1. **Start a task**: Mark a task as "in_progress"
2. **Check Lock Screen**: Swipe down to see Live Activity
3. **Check Dynamic Island**: On iPhone 14 Pro+, check the Dynamic Island
4. **Update timer**: The countdown should update every second
5. **Complete task**: Mark task as "completed" - Live Activity should end

## Troubleshooting

### Live Activity doesn't appear
- Make sure you're testing on a physical device (not simulator)
- Check that iOS version is 16.1+
- Verify `NSSupportsLiveActivities` is set to `true` in Info.plist
- Check device settings: Settings > Face ID & Passcode > Allow Access When Locked > Live Activities

### Widget Extension build errors
- Make sure ActivityKit and WidgetKit frameworks are linked
- Verify deployment target is iOS 16.1+
- Check that TaskActivityAttributes matches between main app and widget extension

### Timer not updating
- Check that update interval is running (should update every second)
- Verify task end time is correctly calculated
- Check console logs for errors

## Features

- ✅ Shows task name and project
- ✅ Countdown timer (hours:minutes:seconds)
- ✅ Progress bar based on estimated time
- ✅ Priority color coding (urgent=red, high=orange, medium=blue, low=green)
- ✅ Dynamic Island support (compact, expanded, minimal views)
- ✅ Lock Screen support
- ✅ Automatic updates every second
- ✅ Auto-start when task becomes active
- ✅ Auto-end when task is completed

## Next Steps

1. Test on physical device
2. Customize widget appearance if needed
3. Add more features (pause/resume, extend time, etc.)
4. Consider adding push notifications for remote updates












