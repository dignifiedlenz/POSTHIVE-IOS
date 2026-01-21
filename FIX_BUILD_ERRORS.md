# Fix Build Errors - Quick Guide

## Problem
You have multiple widget files and the old Xcode-generated file is causing conflicts.

## Solution: Delete the Old File

**In Xcode:**

1. **Find the problematic file**: `TaskLiveActivityWidgetLiveActivity.swift` in the `TaskLiveActivityWidget` folder
2. **Right-click** on it in Xcode's left sidebar
3. Select **"Delete"**
4. Choose **"Move to Trash"** (not "Remove Reference")
5. **Clean build folder**: Product > Clean Build Folder (⇧⌘K)
6. **Build again**: Product > Build (⌘B)

## Alternative: If You Can't Delete It

If Xcode won't let you delete it, replace its contents:

1. Open `TaskLiveActivityWidgetLiveActivity.swift`
2. **Select all** (⌘A) and **delete**
3. **Leave it empty** or add this comment:
   ```swift
   // This file is not used - see TaskLiveActivityWidget.swift instead
   ```
4. Make sure it's **NOT** included in the Widget Extension target:
   - Select the file
   - Right sidebar → File Inspector
   - Under "Target Membership", **uncheck** "TaskLiveActivityWidget"

## Verify Files

You should have:
- ✅ `TaskLiveActivityWidget.swift` - Our custom widget (with `TaskActivityAttributes`)
- ✅ `TaskLiveActivityWidgetBundle.swift` - Bundle file (references `TaskLiveActivityWidget()`)
- ❌ `TaskLiveActivityWidgetLiveActivity.swift` - DELETE THIS (old Xcode template)

## After Fixing

1. Clean build folder (⇧⌘K)
2. Build (⌘B)
3. Should compile successfully!












