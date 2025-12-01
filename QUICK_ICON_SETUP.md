# 🚀 Quick Icon Setup for Phanrise

## The Fastest Way (5 Minutes)

### Step 1: Create Your Icon Design

**Design:**
- 1024×1024 pixels
- Orange background (#FF6B00)
- White "P" letter (bold, large)
- Simple and clean

**You can:**
- Use Canva.com (free) - Create 1024×1024 design
- Use the HTML generator: Open `mobile/scripts/generate-icons.html` in browser
- Use any image editor (Paint, Photoshop, etc.)

### Step 2: Generate All Icon Sizes

1. Go to: **https://appicon.co/**
2. Upload your 1024×1024 PNG icon
3. Download the generated ZIP
4. Extract it

### Step 3: Copy Files

Copy these files to `mobile/assets/images/`:
- `AppIcon-1024.png` → rename to `icon.png`
- `AppIcon-1024.png` → copy as `adaptive-icon.png`
- Create `splash-icon.png` (same as icon, but 2048×2048)
- `favicon.png` (smallest size)

### Step 4: Rebuild

```bash
cd mobile
npx expo prebuild --clean
eas build --platform android
```

---

## Using the HTML Generator (No Design Needed!)

1. Open `mobile/scripts/generate-icons.html` in Chrome/Firefox
2. Click "Download All Icons"
3. Move downloaded files to `mobile/assets/images/`
4. Rebuild the app

---

## What Changed

✅ Splash screen background is now **orange (#FF6B00)** instead of white
✅ Adaptive icon background is now **orange (#FF6B00)**
✅ All icon paths are configured correctly

---

## Need a Simple Logo?

**Design Idea:**
```
[Orange Circle Background]
  Large White "P"
  Small Coin/Star Icon
```

That's it! Simple and recognizable.

