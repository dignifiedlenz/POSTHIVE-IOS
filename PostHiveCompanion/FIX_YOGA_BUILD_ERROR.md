# Fix Yoga Build Errors

## Problem
Yoga header file errors (`'yoga/debug/AssertFatal.h'` file not found, etc.) are preventing the iOS build.

## Solution Steps

### 1. Clean Build Artifacts
```bash
cd PostHiveCompanion
rm -rf ios/Pods ios/Podfile.lock
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

### 2. Reinstall Pods
```bash
cd ios
bundle exec pod install --repo-update
```

If you get a "FrozenError" with CocoaPods, try:
```bash
bundle update cocoapods
cd ios
bundle exec pod install
```

### 3. Clean Xcode Build Folder
In Xcode:
- Product > Clean Build Folder (⇧⌘K)

### 4. Rebuild
In Xcode:
- Product > Build (⌘B)

## Alternative: If Pod Install Fails

If `pod install` continues to fail, try:

1. **Update Ruby gems:**
```bash
bundle update
```

2. **Use system CocoaPods (if bundle fails):**
```bash
cd ios
pod install --repo-update
```

3. **Check CocoaPods version:**
```bash
bundle exec pod --version
```

Should be >= 1.13 (as specified in Gemfile)

## Why This Happens

Yoga is React Native's layout engine. These errors typically occur when:
- Pods are out of sync with node_modules
- Xcode build cache is stale
- CocoaPods version mismatch
- Derived data corruption

The fix is to clean everything and reinstall pods fresh.












