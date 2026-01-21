# Quick Signing Fix - Action Items

## ✅ Already Fixed (Automatically)

1. ✅ Release build now uses "Apple Distribution"
2. ✅ Podfile updated to sign Hermes framework
3. ✅ dSYM generation enabled for Release builds

## ⚠️ CRITICAL: Add Hermes Signing Script in Xcode

**You MUST do this manually in Xcode** - it's the most important step:

1. Open `PostHiveCompanion.xcworkspace` in Xcode
2. Select **PostHiveCompanion** project → **PostHiveCompanion** target
3. Go to **Build Phases** tab
4. Click **+** → **New Run Script Phase**
5. Name it: **"Sign Hermes Framework"**
6. **DRAG IT TO BE BEFORE "Embed Pods Frameworks"** (critical!)
7. Paste this script:

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
fi
```

8. Uncheck "For install builds only"
9. Check "Show environment variables in build log"

## ✅ Verify These Settings

### In Xcode → PostHiveCompanion Target → Signing & Capabilities:
- ✅ "Automatically manage signing" is CHECKED
- ✅ Team is selected (ZJMC964HL6)
- ✅ Bundle Identifier matches App Store Connect

### In Xcode → TaskLiveActivityWidgetExtension Target → Signing & Capabilities:
- ✅ "Automatically manage signing" is CHECKED  
- ✅ **SAME team** as main app
- ✅ Bundle Identifier is correct

## 🧹 Clean & Rebuild

```bash
cd /Users/lorenzschaefer/POSTHIVE-IOS/PostHiveCompanion/ios
./fix_signing.sh
```

Then in Xcode:
1. Product → Clean Build Folder (⇧⌘K)
2. Select "Generic iOS Device" (not simulator!)
3. Product → Archive

## That's It!

After adding the Hermes signing script and verifying the settings above, you should be good to go!

See `SIGNING_CHECKLIST.md` for detailed troubleshooting if issues persist.
