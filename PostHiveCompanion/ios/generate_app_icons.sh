#!/bin/bash

# Script to generate all app icon sizes from a 1024x1024 source icon
# Usage: ./generate_app_icons.sh /path/to/your/1024x1024-icon.png

set -e

ICON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/PostHiveCompanion/Images.xcassets/AppIcon.appiconset"

if [ -z "$1" ]; then
    echo "❌ Error: Please provide the path to your 1024x1024 icon"
    echo "Usage: $0 /path/to/icon-1024.png"
    exit 1
fi

SOURCE_ICON="$1"

if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Error: Icon file not found: $SOURCE_ICON"
    exit 1
fi

echo "🎨 Generating app icons from: $SOURCE_ICON"
echo "📁 Output directory: $ICON_DIR"
echo ""

# Check if sips is available (macOS built-in tool)
if ! command -v sips &> /dev/null; then
    echo "❌ Error: sips command not found. This script requires macOS."
    exit 1
fi

# Create a temporary file without alpha channel
TEMP_ICON="${ICON_DIR}/temp-no-alpha.png"

echo "🔄 Removing alpha channel from source icon..."
sips -s format png -s formatOptions normal "$SOURCE_ICON" --out "$TEMP_ICON" > /dev/null 2>&1

# If sips doesn't remove alpha, try ImageMagick or use Python
if [ -f "$TEMP_ICON" ]; then
    # Check if still has alpha
    ALPHA_CHECK=$(sips -g hasAlpha "$TEMP_ICON" 2>/dev/null | grep "hasAlpha" | awk '{print $2}')
    if [ "$ALPHA_CHECK" = "yes" ]; then
        echo "⚠️  sips didn't remove alpha, trying alternative method..."
        # Use Python to remove alpha (fallback)
        python3 -c "
from PIL import Image
import sys
img = Image.open('$SOURCE_ICON')
if img.mode == 'RGBA':
    # Create white background
    background = Image.new('RGB', img.size, (255, 255, 255))
    background.paste(img, mask=img.split()[3])  # Use alpha channel as mask
    background.save('$TEMP_ICON', 'PNG')
else:
    img.convert('RGB').save('$TEMP_ICON', 'PNG')
" 2>/dev/null || {
            echo "⚠️  Python method failed, trying ImageMagick..."
            if command -v convert &> /dev/null; then
                convert "$SOURCE_ICON" -background white -alpha remove -alpha off "$TEMP_ICON"
            else
                echo "❌ Error: Could not remove alpha channel. Please use an image editor to remove transparency."
                exit 1
            fi
        }
    fi
    SOURCE_ICON="$TEMP_ICON"
fi

echo "✅ Alpha channel removed"
echo ""

# Generate all required icon sizes
echo "📐 Generating icon sizes..."

# iPhone App Icons
sips -z 40 40 "$SOURCE_ICON" --out "${ICON_DIR}/Icon-20@2x.png" > /dev/null 2>&1
echo "✅ Created Icon-20@2x.png (40x40)"

sips -z 60 60 "$SOURCE_ICON" --out "${ICON_DIR}/Icon-20@3x.png" > /dev/null 2>&1
echo "✅ Created Icon-20@3x.png (60x60)"

sips -z 58 58 "$SOURCE_ICON" --out "${ICON_DIR}/Icon-29@2x.png" > /dev/null 2>&1
echo "✅ Created Icon-29@2x.png (58x58)"

sips -z 87 87 "$SOURCE_ICON" --out "${ICON_DIR}/Icon-29@3x.png" > /dev/null 2>&1
echo "✅ Created Icon-29@3x.png (87x87)"

sips -z 80 80 "$SOURCE_ICON" --out "${ICON_DIR}/Icon-40@2x.png" > /dev/null 2>&1
echo "✅ Created Icon-40@2x.png (80x80)"

sips -z 120 120 "$SOURCE_ICON" --out "${ICON_DIR}/Icon-40@3x.png" > /dev/null 2>&1
echo "✅ Created Icon-40@3x.png (120x120)"

sips -z 120 120 "$SOURCE_ICON" --out "${ICON_DIR}/Icon-60@2x.png" > /dev/null 2>&1
echo "✅ Created Icon-60@2x.png (120x120)"

sips -z 180 180 "$SOURCE_ICON" --out "${ICON_DIR}/Icon-60@3x.png" > /dev/null 2>&1
echo "✅ Created Icon-60@3x.png (180x180)"

# App Store icon (1024x1024) - copy the source but ensure no alpha
sips -z 1024 1024 "$SOURCE_ICON" --out "${ICON_DIR}/Icon-1024.png" > /dev/null 2>&1
echo "✅ Created Icon-1024.png (1024x1024)"

# Clean up temp file
rm -f "$TEMP_ICON"

echo ""
echo "✨ All app icons generated successfully!"
echo ""
echo "📋 Generated icons:"
echo "   - Icon-20@2x.png (40x40)"
echo "   - Icon-20@3x.png (60x60)"
echo "   - Icon-29@2x.png (58x58)"
echo "   - Icon-29@3x.png (87x87)"
echo "   - Icon-40@2x.png (80x80)"
echo "   - Icon-40@3x.png (120x120)"
echo "   - Icon-60@2x.png (120x120)"
echo "   - Icon-60@3x.png (180x180)"
echo "   - Icon-1024.png (1024x1024)"
echo ""
echo "✅ All icons are ready for App Store submission!"
