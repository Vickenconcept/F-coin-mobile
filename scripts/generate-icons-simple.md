# 🎯 Simplest Icon Generation (Choose One Method)

## Method 1: Use Online Tool (Easiest - 2 Minutes)

1. **Create your icon**:
   - Use Canva.com or any image editor
   - Size: 1024×1024 pixels
   - Orange background (#FF6B00)
   - White "P" letter (bold)

2. **Generate all sizes**:
   - Go to: https://appicon.co/
   - Upload your 1024×1024 PNG
   - Download the ZIP
   - Extract and copy to `mobile/assets/images/`

3. **Rebuild**:
   ```bash
   cd mobile
   npx expo prebuild --clean
   eas build --platform android
   ```

Done! ✅

---

## Method 2: Use HTML Generator (No Design Needed)

1. Open `mobile/scripts/generate-icons.html` in your browser
2. Click "Download All Icons" button
3. Move downloaded files to `mobile/assets/images/`
4. Rebuild the app

Done! ✅

---

## Method 3: Use Node.js Script (If You Have Node)

1. Install sharp:
   ```bash
   cd mobile
   npm install sharp --save-dev
   ```

2. Run generator:
   ```bash
   node scripts/generate-icons.js
   ```

3. Rebuild:
   ```bash
   npx expo prebuild --clean
   eas build --platform android
   ```

Done! ✅

---

## Quick Design Guide

**Logo Elements:**
- Large white "P" letter
- Orange (#FF6B00) background
- Optional: Small coin/star icon

**Template:**
```
┌─────────────────┐
│                 │
│       P         │  ← White, bold letter
│                 │
│        🪙       │  ← Optional coin icon
│                 │
└─────────────────┘
  Orange background
```

---

## Files Needed

Place these in `mobile/assets/images/`:
- ✅ `icon.png` (1024×1024)
- ✅ `adaptive-icon.png` (1024×1024)
- ✅ `splash-icon.png` (2048×2048)
- ✅ `favicon.png` (48×48)

---

## Already Done ✅

- ✅ Splash screen background color updated to orange
- ✅ Adaptive icon background color updated to orange
- ✅ Icon paths configured in app.config.js

Just add the icon files and rebuild!

