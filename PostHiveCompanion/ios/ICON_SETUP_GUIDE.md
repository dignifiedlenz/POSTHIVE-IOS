# App Icon Setup Guide

## Where to Put Your 1024x1024 Icon

Your 1024x1024 icon should be placed in:
```
PostHiveCompanion/ios/PostHiveCompanion/Images.xcassets/AppIcon.appiconset/Icon-1024.png
```

## Quick Setup

1. **Prepare your 1024x1024 icon**:
   - Must be exactly 1024x1024 pixels
   - PNG format
   - **NO transparency/alpha channel** (this causes App Store validation errors)
   - Square format

2. **Generate all icon sizes automatically**:
   ```bash
   cd /Users/lorenzschaefer/POSTHIVE-IOS/PostHiveCompanion/ios
   ./generate_app_icons.sh /path/to/your/icon-1024.png
   ```

   This script will:
   - Remove any alpha channel from your icon
   - Generate all required sizes automatically
   - Place them in the correct location

## Required Icon Sizes

The script generates these sizes automatically:

| Size | Filename | Dimensions | Usage |
|------|----------|------------|-------|
| 20pt @2x | Icon-20@2x.png | 40x40 | Settings, Spotlight |
| 20pt @3x | Icon-20@3x.png | 60x60 | Settings, Spotlight |
| 29pt @2x | Icon-29@2x.png | 58x58 | Settings |
| 29pt @3x | Icon-29@3x.png | 87x87 | Settings |
| 40pt @2x | Icon-40@2x.png | 80x80 | Spotlight |
| 40pt @3x | Icon-40@3x.png | 120x120 | Spotlight |
| 60pt @2x | Icon-60@2x.png | 120x120 | App Icon (iPhone) |
| 60pt @3x | Icon-60@3x.png | 180x180 | App Icon (iPhone) |
| 1024x1024 | Icon-1024.png | 1024x1024 | App Store |

## Manual Setup (Alternative)

If you prefer to do it manually:

1. **Remove alpha channel from your 1024x1024 icon**:
   ```bash
   # Using sips (macOS)
   sips -s format png -s formatOptions normal your-icon.png --out Icon-1024-no-alpha.png
   
   # Or using ImageMagick
   convert your-icon.png -background white -alpha remove -alpha off Icon-1024-no-alpha.png
   ```

2. **Resize to all sizes**:
   ```bash
   cd PostHiveCompanion/Images.xcassets/AppIcon.appiconset
   
   sips -z 40 40 Icon-1024-no-alpha.png --out Icon-20@2x.png
   sips -z 60 60 Icon-1024-no-alpha.png --out Icon-20@3x.png
   sips -z 58 58 Icon-1024-no-alpha.png --out Icon-29@2x.png
   sips -z 87 87 Icon-1024-no-alpha.png --out Icon-29@3x.png
   sips -z 80 80 Icon-1024-no-alpha.png --out Icon-40@2x.png
   sips -z 120 120 Icon-1024-no-alpha.png --out Icon-40@3x.png
   sips -z 120 120 Icon-1024-no-alpha.png --out Icon-60@2x.png
   sips -z 180 180 Icon-1024-no-alpha.png --out Icon-60@3x.png
   cp Icon-1024-no-alpha.png Icon-1024.png
   ```

## Verify Icons

After generating, verify all icons are present:

```bash
cd PostHiveCompanion/Images.xcassets/AppIcon.appiconset
ls -la Icon-*.png
```

You should see all 9 icon files.

## Verify No Alpha Channel

Check that icons don't have alpha:

```bash
# Check if any icon has alpha channel
for icon in Icon-*.png; do
    alpha=$(sips -g hasAlpha "$icon" 2>/dev/null | grep "hasAlpha" | awk '{print $2}')
    if [ "$alpha" = "yes" ]; then
        echo "⚠️  $icon has alpha channel!"
    fi
done
```

## Troubleshooting

### Icon has transparency/alpha channel
**Error**: "Invalid large app icon. The large app icon in the asset catalog can't be transparent or contain an alpha channel."

**Solution**: 
- Use the `generate_app_icons.sh` script which automatically removes alpha
- Or manually remove alpha using an image editor (Photoshop, Preview, etc.)

### Icons look blurry
**Solution**: 
- Make sure your source icon is exactly 1024x1024
- Use high-quality source image
- Don't upscale a smaller image

### Icons not showing in Xcode
**Solution**:
- Clean build folder: Product → Clean Build Folder (⇧⌘K)
- Rebuild the project
- Check that `Contents.json` references all icon files correctly

## Next Steps

After setting up icons:
1. Open Xcode
2. Select your project → PostHiveCompanion target
3. Go to General tab
4. Verify AppIcon is selected in "App Icons and Launch Screen"
5. Build and archive your app

---

**The icon directory is located at:**
`PostHiveCompanion/ios/PostHiveCompanion/Images.xcassets/AppIcon.appiconset/`
