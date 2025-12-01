# Generate Phanrise App Icons

This guide will help you generate all required icon sizes for the Phanrise mobile app.

## Quick Option: Use Online Tools

### Option 1: AppIcon.co (Recommended - Free)
1. Go to: https://appicon.co/
2. Upload the logo SVG or a 1024x1024 PNG
3. Download the generated icon set
4. Extract and place files in `mobile/assets/images/`

### Option 2: MakeAppIcon (Free)
1. Go to: https://www.makeappicon.com/
2. Upload a 1024x1024 PNG icon
3. Download the generated icons
4. Extract and place in `mobile/assets/images/`

## Required Icon Files

You need to generate these files:

1. **icon.png** - 1024x1024px (iOS App Icon)
2. **adaptive-icon.png** - 1024x1024px (Android Adaptive Icon - foreground)
3. **splash-icon.png** - 2048x2048px (Splash Screen)
4. **favicon.png** - 48x48px (Web favicon)

## Manual Generation (Using Image Editor)

### Design Guidelines:
- **Brand Color**: #FF6B00 (Orange)
- **Text Color**: White
- **Background**: Solid #FF6B00 or gradient
- **Logo**: "P" letter + coin/star icon
- **Style**: Modern, clean, recognizable at small sizes

### Steps:
1. Create a 1024x1024px canvas
2. Fill background with #FF6B00
3. Add white "P" letter (Phanrise logo)
4. Add coin/star icon
5. Export as PNG with transparency

### Recommended Logo Design:
- Large "P" letter in white
- Coin/star symbol representing rewards
- Clean, bold typography
- Works at small sizes (app icon)

## Using the SVG Logo

The `logo.svg` file provided can be converted to PNG using:

### Online Converters:
- https://convertio.co/svg-png/
- https://cloudconvert.com/svg-to-png

### Command Line (with ImageMagick):
```bash
convert -background none -resize 1024x1024 logo.svg icon.png
convert -background none -resize 1024x1024 logo.svg adaptive-icon.png
convert -background none -resize 2048x2048 logo.svg splash-icon.png
convert -background none -resize 48x48 logo.svg favicon.png
```

## After Generating Icons

1. Place all PNG files in `mobile/assets/images/`
2. Update `app.config.js` if file names changed
3. Run `npx expo prebuild --clean` to regenerate native files
4. Rebuild the app: `eas build --platform android`

## Brand Colors for Reference

- **Primary**: #FF6B00 (Orange)
- **Background**: #FFFFFF (White)
- **Text**: #000000 (Black) or #FFFFFF (White)

