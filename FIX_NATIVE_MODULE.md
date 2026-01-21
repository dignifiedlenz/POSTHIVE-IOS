# Fix Native Module Error

## Problem
`LiveActivityModule` is null - the native module isn't being found by React Native.

## Solution: Add File to Xcode Project

The Swift file exists on disk but needs to be added to the Xcode project.

### Steps:

1. **In Xcode**, right-click on the **PostHiveCompanion** folder (the one inside the blue PostHiveCompanion project icon)
2. Select **"Add Files to 'PostHiveCompanion'..."**
3. Navigate to: `ios/PostHiveCompanion/LiveActivityModule.swift`
   - You might need to go to the project root and navigate: `PostHiveCompanion/ios/PostHiveCompanion/LiveActivityModule.swift`
4. In the dialog that appears:
   - ✅ Check **"Copy items if needed"** (if the file isn't already in the right place)
   - ✅ Check **"PostHiveCompanion"** target ONLY
   - ❌ Uncheck **"TaskLiveActivityWidget"** (if it's checked)
5. Click **Add**

### Alternative: Drag and Drop

1. Open Finder and navigate to: `PostHiveCompanion/ios/PostHiveCompanion/`
2. Find `LiveActivityModule.swift`
3. Drag it into Xcode's left sidebar, dropping it into the **PostHiveCompanion** folder (under the blue project icon)
4. In the dialog:
   - ✅ Check **"Copy items if needed"**
   - ✅ Check **"PostHiveCompanion"** target
5. Click **Finish**

### After Adding:

1. **Verify Target Membership:**
   - Select `LiveActivityModule.swift` in Xcode
   - Right sidebar → File Inspector (first icon)
   - Under "Target Membership":
     - ✅ **PostHiveCompanion** should be checked
     - ❌ TaskLiveActivityWidget should be unchecked

5. **Verify the file is in Build Phases:**
   - Select **PostHiveCompanion** target
   - **Build Phases** tab
   - Expand **"Compile Sources"**
   - Make sure `LiveActivityModule.swift` is listed there
   - If not, click **"+"** and add it

6. **Clean and rebuild:**
   - Product > Clean Build Folder (⇧⌘K)
   - Product > Build (⌘B)

### Alternative: Add via Xcode UI

If the file isn't showing up:

1. In Xcode, right-click on **PostHiveCompanion** folder
2. **Add Files to "PostHiveCompanion"...**
3. Navigate to `ios/PostHiveCompanion/LiveActivityModule.swift`
4. Make sure:
   - ✅ **"Copy items if needed"** is checked
   - ✅ **"PostHiveCompanion"** target is checked
5. Click **Add**

### Verify It Works

After adding, check the console - you should see:
- ✅ No more "cannot read property 'isAvailable' of null" error
- ✅ "Live Activities available: true/false" log

If you still see errors, the module might need to be registered differently. Let me know!

