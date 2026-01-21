# Code Signing Fix Checklist

## ✅ What We've Fixed Automatically

1. ✅ Changed Release build to use "Apple Distribution" (was "Apple Development")
2. ✅ Updated Podfile to sign Hermes framework properly
3. ✅ Updated project-level Release settings

## 🔧 What You Need to Do in Xcode

### Step 1: Add Hermes Framework Signing Script

**This is critical** - The Hermes framework needs to be explicitly signed.

1. Open `PostHiveCompanion.xcworkspace` in Xcode
2. Select your **PostHiveCompanion** project (blue icon) in the navigator
3. Select the **PostHiveCompanion** target
4. Go to **Build Phases** tab
5. Click the **+** button at the top → **New Run Script Phase**
6. Name it: **"Sign Hermes Framework"**
7. **Drag this script phase to be BEFORE "Embed Pods Frameworks"** (very important!)
8. Paste this script:

```bash
# Sign Hermes Framework
FRAMEWORK_PATH="${BUILT_PRODUCTS_DIR}/${FRAMEWORKS_FOLDER_PATH}/hermesvm.framework"
if [ -d "$FRAMEWORK_PATH" ]; then
    echo "🔐 Signing Hermes framework..."
    codesign --force --sign "${CODE_SIGN_IDENTITY}" \
        --preserve-metadata=identifier,entitlements,flags \
        --timestamp=none \
        "$FRAMEWORK_PATH"
    echo "✅ Hermes framework signed"
else
    echo "⚠️  Hermes framework not found at $FRAMEWORK_PATH"
fi
```

9. Make sure "For install builds only" is **UNCHECKED**
10. Make sure "Show environment variables in build log" is **CHECKED** (for debugging)

### Step 2: Enable dSYM Generation

1. Select **PostHiveCompanion** target
2. Go to **Build Settings** tab
3. Search for: `Debug Information Format`
4. Set **Release** configuration to: **DWARF with dSYM File**
   - (Debug can stay as "DWARF")

### Step 3: Verify Signing Settings for All Targets

#### Main App (PostHiveCompanion)
1. Select **PostHiveCompanion** target
2. Go to **Signing & Capabilities** tab
3. Verify:
   - ✅ **Automatically manage signing**: CHECKED
   - **Team**: Your team (ZJMC964HL6)
   - **Bundle Identifier**: Should match App Store Connect
   - **Provisioning Profile**: Should show "Xcode Managed Profile"

#### Widget Extension (TaskLiveActivityWidgetExtension)
1. Select **TaskLiveActivityWidgetExtension** target
2. Go to **Signing & Capabilities** tab
3. Verify:
   - ✅ **Automatically manage signing**: CHECKED
   - **Team**: **SAME** team as main app (ZJMC964HL6)
   - **Bundle Identifier**: Should be `com.posthive.companion.TaskLiveActivityWidgetExtension` (or similar)
   - **Provisioning Profile**: Should show "Xcode Managed Profile"

### Step 4: Verify Build Settings

1. Select **PostHiveCompanion** target
2. Go to **Build Settings** tab
3. Search for `Code Signing Identity`
4. Verify:
   - **Release**: Should be "Apple Distribution"
   - **Debug**: Can be "Apple Development"

5. Search for `Code Signing Style`
   - Should be "Automatic" for both Debug and Release

### Step 5: Clean and Rebuild

1. **Clean Build Folder**: Product → Clean Build Folder (⇧⌘K)
2. Close Xcode
3. Run the fix script:
   ```bash
   cd /Users/lorenzschaefer/POSTHIVE-IOS/PostHiveCompanion/ios
   ./fix_signing.sh
   ```
4. Reopen Xcode
5. **Select "Generic iOS Device"** (not simulator!)
6. **Build**: Product → Build (⌘B) - check for errors
7. **Archive**: Product → Archive

## 🔍 Verification Steps

After archiving, validate:

1. In Organizer, select your archive
2. Click **Validate App**
3. Check for any remaining signing errors

If you still see errors:

### Error: "hermesvm.framework is not properly signed"
- Make sure the "Sign Hermes Framework" script is **BEFORE** "Embed Pods Frameworks"
- Check the script output in build log
- Verify CODE_SIGN_IDENTITY is set correctly

### Error: "TaskLiveActivityWidgetExtension is not properly signed"
- Verify widget extension has same team as main app
- Check that both have "Automatically manage signing" enabled
- Clean and rebuild

### Error: "Missing dSYM"
- Verify "Debug Information Format" is set to "DWARF with dSYM File" for Release
- Clean and rebuild

## 📋 Final Checklist Before Archive

- [ ] Hermes signing script added to Build Phases (BEFORE Embed Pods Frameworks)
- [ ] dSYM generation enabled for Release builds
- [ ] Main app signing configured (Automatic, correct team)
- [ ] Widget extension signing configured (Automatic, same team)
- [ ] Release build uses "Apple Distribution"
- [ ] Clean build folder completed
- [ ] Pods reinstalled (if needed)
- [ ] Selected "Generic iOS Device" (not simulator)
- [ ] Build succeeds without errors
- [ ] Archive created successfully

## 🚀 After Successful Archive

1. **Validate App** in Organizer
2. If validation passes, **Distribute App** → **App Store Connect**
3. Upload and wait for processing
4. Complete App Store Connect metadata
5. Submit for review!

---

**If you're still having issues after following this checklist, the problem might be:**
- Certificate/Provisioning Profile issues (check Xcode → Preferences → Accounts)
- Team membership issues
- Bundle identifier mismatch with App Store Connect
