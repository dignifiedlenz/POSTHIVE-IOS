# PostHive iOS Home Screen Widgets Setup Guide

## Overview

This guide covers setting up three iOS Home Screen Widgets for PostHive:

1. **Upcoming Widget** (Medium/Large) - Shows upcoming events and todos
2. **Deliverable Widget** (Small/Medium) - Shows latest deliverable with unread comment count
3. **Transfer Widget** (Small) - Shows current file transfer progress

## Prerequisites

- Xcode 15.0 or later
- iOS 17.0+ deployment target (widgets also work on iOS 16.1+)
- Physical device for testing (widgets work in simulator but some features are limited)

## Files Created

```
ios/
├── PostHiveCompanion/
│   ├── PostHiveCompanion.entitlements (updated with App Groups)
│   ├── WidgetModule.swift (React Native bridge)
│   └── WidgetModule.m (Objective-C bridge header)
└── TaskLiveActivityWidget/
    ├── TaskLiveActivityWidget.entitlements (new - App Groups for widget)
    ├── PostHiveWidgets.swift (all three widget implementations)
    └── TaskLiveActivityWidgetBundle.swift (updated to include widgets)

src/
├── lib/
│   └── WidgetModule.ts (TypeScript interface)
└── hooks/
    └── useWidgetSync.ts (auto-sync hook)
```

## Step 1: Configure App Groups in Xcode

App Groups allow the main app to share data with the widget extension.

### Main App Target

1. Open `PostHiveCompanion.xcworkspace` in Xcode
2. Select the `PostHiveCompanion` target
3. Go to "Signing & Capabilities"
4. Click "+ Capability" and add "App Groups"
5. Click "+" and add: `group.com.posthive.companion`
6. Ensure the group is checked/enabled

### Widget Extension Target

1. Select the `TaskLiveActivityWidget` target
2. Go to "Signing & Capabilities"  
3. Click "+ Capability" and add "App Groups"
4. Add the same group: `group.com.posthive.companion`
5. Ensure the group is checked/enabled

## Step 2: Add New Swift Files to Widget Target

1. In Xcode, select the `TaskLiveActivityWidget` folder in the Project Navigator
2. Right-click > "Add Files to TaskLiveActivityWidget"
3. Select `PostHiveWidgets.swift`
4. Ensure "Copy items if needed" is checked
5. Ensure target membership is set to `TaskLiveActivityWidget` only

The entitlements file should automatically be picked up, but verify:
1. Select `TaskLiveActivityWidget` target
2. Go to "Build Settings"
3. Search for "Code Signing Entitlements"
4. Set to `TaskLiveActivityWidget/TaskLiveActivityWidget.entitlements`

## Step 3: Add Native Module Files to Main App

1. In Xcode, select the `PostHiveCompanion` folder
2. Right-click > "Add Files to PostHiveCompanion"
3. Select both:
   - `WidgetModule.swift`
   - `WidgetModule.m`
4. Ensure target membership is set to `PostHiveCompanion` only

## Step 4: Update Bridging Header (if needed)

If prompted to create a bridging header, accept. Otherwise, verify the existing bridging header (`PostHiveCompanion-Bridging-Header.h`) includes React Native imports.

## Step 5: Build and Test

1. Clean the build folder: Product > Clean Build Folder (⇧⌘K)
2. Build the app: Product > Build (⌘B)
3. Run on a device or simulator
4. Long-press on the home screen to enter jiggle mode
5. Tap "+" to add a widget
6. Search for "PostHive" or "PostHiveCompanion"
7. You should see three widget options

## Usage in React Native

### Basic Usage - Auto Sync Hook

Add the sync hook to a top-level component to automatically keep widgets updated:

```tsx
import { useWidgetSync } from '../hooks/useWidgetSync';
import { useTodos } from '../hooks/useTodos';
import { useDeliverables } from '../hooks/useDeliverables';

function App() {
  const { pendingTodos, inProgressTodos } = useTodos({ workspaceId, userId });
  const { deliverables } = useDeliverables({ workspaceId, userId });
  
  // Automatically sync to widgets
  useWidgetSync({
    todos: [...pendingTodos, ...inProgressTodos],
    events: [], // Add your events here
    latestDeliverable: deliverables[0],
    activeTransfer: null, // Set during uploads
  });

  return <YourApp />;
}
```

### Manual Updates

For more control, use the WidgetModule directly:

```tsx
import { WidgetModule } from '../lib/WidgetModule';

// Update upcoming items
WidgetModule.updateUpcomingItems([
  {
    id: '1',
    title: 'Client Call',
    subtitle: 'Zoom',
    time: new Date().toISOString(),
    type: 'event',
    color: '#4A90D9',
  },
  {
    id: '2',
    title: 'Export Final Cut',
    type: 'todo',
    priority: 'high',
  },
]);

// Update deliverable
WidgetModule.updateLatestDeliverable({
  id: 'del-123',
  name: 'Final Export v2',
  projectName: 'Wedding Film',
  unreadCommentCount: 3,
  updatedAt: new Date().toISOString(),
});

// Update transfer progress
WidgetModule.updateActiveTransfer({
  id: 'transfer-1',
  fileName: 'Export_4K.mov',
  progress: 0.45,
  bytesTransferred: 1200000000,
  totalBytes: 2700000000,
  isUpload: true,
  startedAt: new Date().toISOString(),
});

// Clear transfer when done
WidgetModule.clearActiveTransfer();

// Force refresh all widgets
WidgetModule.reloadAllWidgets();
```

### Transfer Progress Hook

For upload/download progress tracking:

```tsx
import { useTransferWidget } from '../hooks/useWidgetSync';

function UploadScreen() {
  const [transfer, setTransfer] = useState(null);

  // This hook automatically updates the widget
  useTransferWidget(transfer);

  const handleUpload = async (file) => {
    setTransfer({
      id: 'upload-' + Date.now(),
      fileName: file.name,
      progress: 0,
      bytesTransferred: 0,
      totalBytes: file.size,
      isUpload: true,
    });

    // During upload, update progress
    onProgress((progress) => {
      setTransfer(prev => ({
        ...prev,
        progress: progress.percent,
        bytesTransferred: progress.loaded,
      }));
    });

    // When complete, clear
    setTransfer(null);
  };
}
```

## Widget Deep Links

Widgets support deep linking back to the app:

- **Upcoming Widget**: `posthive://calendar`
- **Deliverable Widget**: `posthive://deliverable/{id}` or `posthive://deliverables`
- **Transfer Widget**: `posthive://transfers`

Handle these in your app's URL scheme handler.

## Troubleshooting

### Widgets don't appear in widget gallery
- Ensure the widget extension is included in your build scheme
- Check that the bundle identifier is correct
- Clean build and reinstall

### Widget shows "Unable to Load"
- Check App Groups are configured for both targets
- Verify the group identifier matches: `group.com.posthive.companion`
- Check console logs for errors

### Data not updating
- Widgets update on a schedule (every 15-30 minutes by default)
- Force refresh: Call `WidgetModule.reloadAllWidgets()`
- Check that data is being written to UserDefaults correctly

### Transfer widget not showing progress
- Ensure you're calling `updateActiveTransfer()` regularly during transfer
- Progress updates are throttled to prevent excessive refreshes

## Widget Sizes

| Widget | Small | Medium | Large |
|--------|-------|--------|-------|
| Upcoming | ❌ | ✅ | ✅ |
| Deliverable | ✅ | ✅ | ❌ |
| Transfer | ✅ | ❌ | ❌ |

## Customization

### Colors
Edit `PostHiveColors` struct in `PostHiveWidgets.swift`:

```swift
struct PostHiveColors {
    static let primary = Color(red: 0.4, green: 0.3, blue: 0.9)
    static let accent = Color(red: 1.0, green: 0.4, blue: 0.4)
    // ... customize as needed
}
```

### Update Frequency
Modify the timeline refresh intervals in each widget's `TimelineProvider`:

```swift
// More frequent updates (use sparingly - impacts battery)
let nextUpdate = Calendar.current.date(byAdding: .minute, value: 5, to: Date())

// Less frequent (better for battery)
let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())
```

## Features

### Upcoming Widget
- ✅ Shows events and todos sorted by time
- ✅ Priority color coding for todos
- ✅ Calendar color for events
- ✅ Time-until badges
- ✅ "X more" indicator for overflow
- ✅ Deep link to calendar

### Deliverable Widget  
- ✅ Thumbnail placeholder (gradient)
- ✅ Unread comment badge
- ✅ Project name display
- ✅ Deep link to deliverable

### Transfer Widget
- ✅ Circular progress indicator
- ✅ File size display
- ✅ Upload/download indicator
- ✅ Auto-clear when complete



