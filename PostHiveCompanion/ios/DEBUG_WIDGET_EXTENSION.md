# Debugging Widget Extension - Fix for "Always Fails at This Step"

## ❌ The Problem

You're trying to run/debug `TaskLiveActivityWidgetExtension` directly, but **widget extensions cannot be launched directly**. They must run from the main app that embeds them.

## ✅ Solution: How to Debug Widget Extensions

### Method 1: Run the Main App (Recommended)

1. **Select the main app as the run target:**
   - In Xcode's toolbar, click the scheme selector (next to the play button)
   - Select **PostHiveCompanion** (NOT TaskLiveActivityWidgetExtension)
   - Select your simulator (e.g., "iPhone 15 Pro")

2. **Build and run:**
   - Press ⌘R or click the Play button
   - The main app will launch
   - The widget extension is automatically embedded and available

3. **Test the widget:**
   - Once the app is running, add the widget to your home screen
   - Or trigger widget updates from your app code
   - The widget will run in the context of the main app

### Method 2: Debug from Main App Code

1. **Set breakpoints in your widget code** (e.g., `TaskLiveActivityWidget.swift`)
2. **Run the main app** (PostHiveCompanion target)
3. **Trigger widget code** from your app
4. **Breakpoints will hit** in the widget extension when it executes

### Method 3: Attach to Widget Process (Advanced)

If you need to debug the widget specifically:

1. **Run the main app first** (PostHiveCompanion)
2. **Add the widget to home screen** (this activates the widget)
3. **In Xcode:** Debug → Attach to Process → Find `PostHiveCompanion` or the widget process
4. Set breakpoints in widget code
5. Interact with the widget to trigger breakpoints

## 🔧 Fix Signing for Simulator Debugging

For **Debug builds on simulator**, use:
- ✅ `CODE_SIGN_IDENTITY = "Apple Development"` (correct for Debug)
- ✅ `CODE_SIGN_STYLE = Automatic`
- ✅ Both main app and extension use same team

For **Release builds for App Store**, use:
- ✅ `CODE_SIGN_IDENTITY = "Apple Distribution"` (correct for Release)
- ✅ `CODE_SIGN_STYLE = Automatic`

## 📋 Current Configuration

✅ **Debug builds** (for simulator):
- Main app: "Apple Development" ✓
- Widget extension: "Apple Development" ✓

✅ **Release builds** (for App Store):
- Main app: "Apple Distribution" ✓
- Widget extension: Will use "Apple Development" (needs to match main app's release setting)

## 🚨 Common Issues

### Issue: "Cannot attach to TaskLiveActivityWidgetExtension"
**Solution**: Don't try to run the extension directly. Run the main app instead.

### Issue: "No such module" or build errors
**Solution**: 
1. Clean build folder (⇧⌘K)
2. Ensure the scheme includes both targets
3. Check that the widget extension is in "Dependencies" of the main app target

### Issue: Widget doesn't appear
**Solution**:
1. Make sure you've added the widget to the home screen
2. Check widget bundle identifier matches in Info.plist
3. Verify widget is properly embedded in the main app

## ✅ Steps to Test Widget

1. **Select scheme:** PostHiveCompanion (main app)
2. **Select device:** iPhone simulator
3. **Build and run:** ⌘R
4. **After app launches:**
   - Go to home screen
   - Long press → Add Widget
   - Find your widget and add it
   - The widget should now work

## 📝 Verifying Setup

1. Open Xcode
2. Select **PostHiveCompanion** scheme (NOT the widget)
3. Select a simulator
4. Click Run (⌘R)
5. App should launch successfully
6. Widget extension will be embedded automatically

---

**Key Takeaway**: Always run the **main app** (PostHiveCompanion), not the widget extension. The widget runs within the main app's process.
