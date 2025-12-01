# 🎨 Phanrise App Icon Generation Guide

## Quick Solution - Use Online Tool (5 Minutes)

### Step 1: Create Your Icon
1. Go to: **https://appicon.co/** (Free, no signup)
2. Or: **https://www.makeappicon.com/** (Also free)

### Step 2: Design Requirements
- **Size**: 1024×1024 pixels
- **Background**: Solid #FF6B00 (Orange) or transparent
- **Logo**: White "P" letter + coin/star icon
- **Style**: Simple, bold, recognizable at small sizes

### Step 3: Generate Icons
1. Upload your 1024×1024 PNG
2. Download the generated icon set
3. Extract the ZIP file

### Step 4: Place Files
Copy these files to `mobile/assets/images/`:
- `icon.png` (1024×1024)
- `adaptive-icon.png` (1024×1024) 
- `favicon.png` (48×48 or 192×192)

For splash screen:
- Create `splash-icon.png` (2048×2048) - same design as icon

---

## Alternative: Use the HTML Generator

1. Open `mobile/scripts/generate-icons.html` in your browser
2. Click "Download All Icons"
3. Files will download automatically
4. Move them to `mobile/assets/images/`

---

## Simple Logo Design

### Option 1: Letter "P" Only
- White "P" on orange (#FF6B00) background
- Bold, modern font
- Rounded corners

### Option 2: "P" + Coin Icon
- White "P" letter
- Small coin/star icon next to it
- Clean, minimalist design

### Option 3: Coin Symbol Only
- Large coin/star icon
- White on orange background
- Modern, app-icon style

---

## After Adding Icons

1. **Verify files are in place**:
   ```
   mobile/assets/images/
   ├── icon.png (1024×1024)
   ├── adaptive-icon.png (1024×1024)
   ├── splash-icon.png (2048×2048)
   └── favicon.png (48×48)
   ```

2. **Clean and rebuild**:
   ```bash
   cd mobile
   npx expo prebuild --clean
   ```

3. **Build new APK**:
   ```bash
   eas build --platform android --profile preview
   ```

---

## Design Tips

✅ **Do:**
- Use bold, simple shapes
- Ensure it looks good at 20×20 pixels (smallest size)
- Use high contrast (white on orange)
- Keep it centered
- Use solid colors (avoid gradients for icons)

❌ **Don't:**
- Add too much detail
- Use thin lines (they disappear at small sizes)
- Use photos or complex images
- Add text (letter "P" is enough)

---

## Quick Test

After generating icons, you can test them:
1. Open `mobile/scripts/generate-icons.html` in browser
2. Check if the preview looks good
3. Download and replace files

---

## Need Help?

If you don't have a design tool, you can:
1. Use Canva (free): https://www.canva.com/
2. Use Figma (free): https://www.figma.com/
3. Hire a designer on Fiverr ($5-20)

**Template**: Create 1024×1024 canvas, orange background (#FF6B00), add white "P" letter in bold font.

