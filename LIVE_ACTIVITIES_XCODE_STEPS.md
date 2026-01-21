# Xcode Setup Steps - Manual Guide

Since automated setup isn't possible, here are the **exact steps** you need to follow in Xcode:

## Step 1: Add Widget Extension Target

1. Open `PostHiveCompanion.xcworkspace` in Xcode (NOT the .xcodeproj)
2. Click on the project name in the left sidebar (top level)
3. Click the **"+"** button at the bottom of the TARGETS list
4. Select **"Widget Extension"**
5. Click **Next**
6. Fill in:
   - **Product Name**: `TaskLiveActivityWidget`
   - **Team**: (select your team)
   - **Organization Identifier**: (should match your app's)
   - **Language**: **Swift**
   - **Include Configuration Intent**: ❌ **Uncheck this**
7. Click **Finish**
8. When prompted "Activate 'TaskLiveActivityWidget' scheme?", click **Cancel** (we'll use the main app scheme)
   - **If you clicked Activate by mistake**: Don't worry! Just switch back:
     - Look at the top toolbar in Xcode
     - Click the scheme dropdown (next to the play/stop buttons)
     - Select **"PostHiveCompanion"** (the main app scheme)
     - The widget extension will still build when you build the main app

## Step 2: Configure Widget Extension Target

1. Select the **TaskLiveActivityWidget** target in the left sidebar
2. Go to **"General"** tab:
   - **Deployment Target**: Set to **iOS 16.1**
   - **Bundle Identifier**: Should be `com.yourcompany.PostHiveCompanion.TaskLiveActivityWidget`
3. Go to **"Signing & Capabilities"** tab:
   - Select your **Team**
   - Make sure **"Automatically manage signing"** is checked
   - **No additional capabilities needed** (ActivityKit is included automatically)

## Step 3: Link Frameworks

1. Select the **TaskLiveActivityWidget** target
2. Go to **"Build Phases"** tab
3. Expand **"Link Binary With Libraries"**
4. Click the **"+"** button
5. Add these frameworks (if not already there):
   - `ActivityKit.framework`
   - `WidgetKit.framework`
6. Make sure they're set to **"Required"** (not Optional)

## Step 4: Replace Widget Swift File

Xcode created a default widget file, but we need to replace it with our custom implementation.

**Easy Method - Replace the existing file:**
1. In Xcode's left sidebar, find the **TaskLiveActivityWidget** folder (should be at the same level as "PostHiveCompanion")
2. Open `TaskLiveActivityWidgetLiveActivity.swift` (or similar file - Xcode may have named it differently)
3. **Select all** (⌘A) and **delete** the contents
4. **Copy and paste** the entire contents from `ios/WidgetExtension/TaskLiveActivityWidget.swift`
5. Save the file (⌘S)

**Alternative Method - Add our file and remove the old one:**
1. In Xcode's left sidebar, right-click on the **TaskLiveActivityWidget** folder
2. Select **"Add Files to 'PostHiveCompanion'..."** (yes, it says PostHiveCompanion but that's okay)
3. Navigate to: `ios/WidgetExtension/TaskLiveActivityWidget.swift`
4. In the dialog:
   - ✅ Check **"Copy items if needed"**
   - ✅ Check **"TaskLiveActivityWidget"** target ONLY
   - ❌ Uncheck **"PostHiveCompanion"** if it's checked
5. Click **Add**
6. Delete the old default widget file that Xcode created (if it's different from ours)

**Verify it's correct:**
- The file should contain our custom `TaskLiveActivityWidget` code with `TaskActivityAttributes`
- Select the file in Xcode
- Right sidebar → "File Inspector" tab (first icon)
- Under "Target Membership":
  - ✅ TaskLiveActivityWidget (checked)
  - ❌ PostHiveCompanion (unchecked)

## Step 5: Update Widget Bundle File

The Widget Extension should have created a file like `TaskLiveActivityWidgetBundle.swift`. Update it to:

```swift
import WidgetKit
import SwiftUI

@main
struct TaskLiveActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        TaskLiveActivityWidget()
    }
}
```

## Step 6: Verify Main App Target

1. Select the **PostHiveCompanion** target (main app)
2. Go to **"Build Phases"** tab
3. Expand **"Link Binary With Libraries"**
4. Make sure `ActivityKit.framework` is linked (add it if missing)

## Step 7: Build and Test

1. Connect a physical iOS device (iPhone 14 Pro+ recommended)
2. Select your device as the build target
3. Select the **PostHiveCompanion** scheme (not the widget extension scheme)
4. Build and run (⌘R)
5. Test by marking a task as "in_progress"

## Troubleshooting

### "ActivityKit is not available"
- Make sure deployment target is iOS 16.1+
- Check that ActivityKit.framework is linked

### Widget doesn't appear
- Make sure you're testing on a physical device (not simulator)
- Check device settings: Settings > Face ID & Passcode > Allow Access When Locked > Live Activities

### Build errors about missing files
- Verify `TaskLiveActivityWidget.swift` is added to the Widget Extension target
- Check that `LiveActivityModule.swift` is in the main app target

### "No such module 'ActivityKit'"
- Make sure ActivityKit.framework is linked in Build Phases
- Clean build folder (⌘ShiftK) and rebuild

## Quick Checklist

- [ ] Widget Extension target created
- [ ] Deployment target set to iOS 16.1
- [ ] ActivityKit.framework linked to Widget Extension
- [ ] WidgetKit.framework linked to Widget Extension  
- [ ] TaskLiveActivityWidget.swift added to Widget Extension target
- [ ] LiveActivityModule.swift in main app target
- [ ] Info.plist has NSSupportsLiveActivities = true
- [ ] Testing on physical device

---

**Note**: The code files are already created and ready. You just need to configure the Xcode project structure as described above.

