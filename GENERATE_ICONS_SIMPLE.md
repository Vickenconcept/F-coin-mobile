# ⚡ Generate Phanrise Icons - Super Simple!

## 🎯 Fastest Method (2 Minutes)

### Option 1: Use HTML Generator (No Design Skills Needed!)

1. **Open this file in your browser**:
   ```
   mobile/scripts/generate-icons.html
   ```
   (Just double-click it - it opens in Chrome/Firefox)

2. **Click the button**:
   - Click "Download All Icons"
   - 4 files will download automatically

3. **Move files**:
   - Copy all 4 downloaded files to: `mobile/assets/images/`

4. **Rebuild**:
   ```bash
   cd mobile
   npx expo prebuild --clean
   eas build --platform android
   ```

✅ Done! Your APK will have orange Phanrise icons!

---

### Option 2: Use Online Tool (If HTML doesn't work)

1. Go to: **https://appicon.co/**
2. Create a simple icon:
   - 1024×1024 pixels
   - Orange background (#FF6B00)
   - White "P" letter
3. Upload and download
4. Copy files to `mobile/assets/images/`
5. Rebuild

---

## ✅ Already Fixed for You

- ✅ Splash screen: Now orange background
- ✅ Adaptive icon: Now orange background
- ✅ Config files: All updated

**You just need the PNG icon files!**

---

## 📁 Where Files Go

```
mobile/assets/images/
├── icon.png (1024×1024)
├── adaptive-icon.png (1024×1024)
├── splash-icon.png (2048×2048)
└── favicon.png (48×48)
```

---

## 🎨 Logo Design (Super Simple)

Just need:
- **Orange circle** (#FF6B00)
- **White "P" letter** (bold)

That's it! The HTML generator creates this automatically.

---

## After Adding Icons

Rebuild your APK:
```bash
cd mobile
npx expo prebuild --clean
eas build --platform android --profile preview
```

Your new APK will have the Phanrise icon! 🎉

