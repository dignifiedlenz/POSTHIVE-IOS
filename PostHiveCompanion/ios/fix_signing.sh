#!/bin/bash

# Script to fix code signing issues for PostHiveCompanion iOS app
# Run this before archiving for App Store submission

set -e

echo "🔧 Fixing code signing configuration..."

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_FILE="$PROJECT_DIR/PostHiveCompanion.xcodeproj/project.pbxproj"

# Backup project file
cp "$PROJECT_FILE" "$PROJECT_FILE.backup"
echo "✅ Backed up project file"

# Clean build folders
echo "🧹 Cleaning build folders..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf "$PROJECT_DIR/build"
rm -rf "$PROJECT_DIR/Pods/build"

echo "✅ Cleaned build folders"

# Reinstall pods
echo "📦 Reinstalling pods..."
cd "$PROJECT_DIR"
pod deintegrate || true
pod install

echo "✅ Pods reinstalled"

echo ""
echo "🎯 Next steps:"
echo "1. Open PostHiveCompanion.xcworkspace in Xcode"
echo "2. Select 'Generic iOS Device' (not simulator)"
echo "3. Product → Clean Build Folder (⇧⌘K)"
echo "4. Product → Archive"
echo ""
echo "⚠️  Make sure in Xcode:"
echo "   - PostHiveCompanion target → Signing & Capabilities"
echo "   - TaskLiveActivityWidgetExtension target → Signing & Capabilities"
echo "   - Both have 'Automatically manage signing' enabled"
echo "   - Both use the same team"
echo ""
