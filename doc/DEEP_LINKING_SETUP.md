# 🔗 Deep Linking Setup Guide

## Overview

Your mobile app now supports **Universal Links** (iOS) and **App Links** (Android). When users share a feed post link (e.g., `https://phanrise.com/posts/123`), it will:

1. **Open in the mobile app** if the app is installed
2. **Open in the web browser** if the app is not installed

This works just like Facebook, Instagram, Twitter, etc.

---

## ✅ What's Already Done

### Mobile App Configuration

1. **Universal Links Configured** (`app.config.js`)
   - iOS: `associatedDomains` configured for `phanrise.com`
   - Android: `intentFilters` configured for deep links

2. **Deep Link Handler** (`app/_layout.tsx`)
   - Handles incoming universal links
   - Routes to `/posts/[postId]` for post links
   - Handles authentication redirects

3. **Post Detail Route** (`app/posts/[postId].tsx`)
   - Full-screen post detail view
   - Handles deep links to specific posts

4. **Share Links** (`components/ShareModal.tsx`)
   - Already generates correct universal links: `https://phanrise.com/posts/{postId}`

---

## 🔧 What You Need to Do (Backend/Web Setup)

To make universal links work properly, you need to set up files on your web server:

### 1. **Apple App Site Association (AASA) File**

Create this file on your web server:
- **URL:** `https://phanrise.com/.well-known/apple-app-site-association`
- **Content Type:** `application/json` (NO `.json` extension!)
- **Content:**

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.phanrise.app",
        "paths": [
          "/posts/*",
          "/posts/*/"
        ]
      }
    ]
  }
}
```

**⚠️ Important:**
- Replace `TEAM_ID` with your Apple Developer Team ID
- File must be served with `Content-Type: application/json`
- File must be accessible via HTTPS
- No redirects allowed (must be a direct file)

**How to get your Team ID:**
1. Go to https://developer.apple.com/account
2. Click on "Membership"
3. Your Team ID is shown there (e.g., `ABC123DEF4`)

---

### 2. **Android Asset Links File**

Create this file on your web server:
- **URL:** `https://phanrise.com/.well-known/assetlinks.json`
- **Content Type:** `application/json`
- **Content:**

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.phanrise.app",
      "sha256_cert_fingerprints": [
        "YOUR_SHA256_FINGERPRINT_HERE"
      ]
    }
  }
]
```

**How to get SHA256 fingerprint:**
1. After building your app with EAS Build, Expo will provide the keystore
2. Extract the SHA256 fingerprint using:
   ```bash
   keytool -list -v -keystore your-keystore.jks -alias your-key-alias
   ```
3. Or check in EAS Build dashboard after your first build

---

### 3. **Web Redirect Logic (Optional but Recommended)**

On your web server, when someone visits `https://phanrise.com/posts/{postId}`, you can:

**Option A:** Show the post on web (recommended)
- Display the post in your web app
- Show a banner: "View in app" that opens the mobile app

**Option B:** Auto-redirect to app store
- Detect mobile device
- If app not installed, redirect to App Store/Play Store
- If app installed, the universal link will open it automatically

**Example web redirect code (for your frontend):**

```typescript
// In your React/Vue web app
useEffect(() => {
  const userAgent = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
  
  if (isMobile) {
    // Try to open the app (will work if app is installed)
    window.location.href = `mobile://posts/${postId}`;
    
    // Fallback: after a short delay, show web version
    setTimeout(() => {
      // User is still here, app not installed - show web version
    }, 500);
  }
}, [postId]);
```

---

## 📝 Laravel Backend Setup (If Needed)

If you want to serve the AASA and Asset Links files from Laravel:

### Create Routes

Add to `routes/web.php`:

```php
// Apple App Site Association
Route::get('/.well-known/apple-app-site-association', function () {
    $content = json_encode([
        'applinks' => [
            'apps' => [],
            'details' => [
                [
                    'appID' => env('APPLE_TEAM_ID', 'TEAM_ID') . '.com.phanrise.app',
                    'paths' => ['/posts/*', '/posts/*/']
                ]
            ]
        ]
    ]);
    
    return response($content)
        ->header('Content-Type', 'application/json')
        ->header('Access-Control-Allow-Origin', '*');
})->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);

// Android Asset Links
Route::get('/.well-known/assetlinks.json', function () {
    $content = json_encode([
        [
            'relation' => ['delegate_permission/common.handle_all_urls'],
            'target' => [
                'namespace' => 'android_app',
                'package_name' => 'com.phanrise.app',
                'sha256_cert_fingerprints' => [
                    env('ANDROID_SHA256_FINGERPRINT', 'YOUR_FINGERPRINT_HERE')
                ]
            ]
        ]
    ]);
    
    return response($content)
        ->header('Content-Type', 'application/json')
        ->header('Access-Control-Allow-Origin', '*');
})->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
```

### Add to `.env`

```env
APPLE_TEAM_ID=YOUR_TEAM_ID_HERE
ANDROID_SHA256_FINGERPRINT=YOUR_SHA256_FINGERPRINT_HERE
```

---

## 🧪 Testing Deep Links

### ✅ Testing During Development (No Hosting Required!)

**Good news!** You can test deep linking RIGHT NOW, even without hosting. Here's what works:

#### Custom Scheme Links (Works Immediately)

These work **without any web server setup** and can be tested right away:

**iOS Simulator/Device:**
```bash
xcrun simctl openurl booted "mobile://posts/YOUR_POST_ID"
```

**Android Device/Emulator:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "mobile://posts/YOUR_POST_ID"
```

**Or test from your app:**
1. Share a post in your app
2. Copy the link (will be `https://phanrise.com/posts/...`)
3. Change it to `mobile://posts/YOUR_POST_ID`
4. Open it in any browser or app that can open links
5. It will open directly in your app! ✅

#### Testing in Expo Go (Development)

During development with Expo Go:
1. Share a post → Copy the link
2. Change URL from `https://phanrise.com/posts/123` to `mobile://posts/123`
3. Send it to yourself via WhatsApp/SMS/Email
4. Click the link → Opens in your app! ✅

**Note:** Custom scheme links (`mobile://`) work immediately and don't require hosting.

---

### 🌐 Testing Universal Links (Requires Hosting)

Universal links (`https://phanrise.com/posts/123`) require:
- ✅ Your app installed on device
- ⚠️ Web server with AASA/Asset Links files
- ⚠️ HTTPS domain accessible

**So these WON'T work yet** until you set up hosting.

---

### Test on iOS Simulator/Device

1. **Test Universal Link (requires hosting):**
   ```bash
   # Open Safari on device/simulator
   # Navigate to: https://phanrise.com/posts/SOME_POST_ID
   # It should open in your app if installed
   ```

2. **Test Custom Scheme (works NOW!):**
   ```bash
   xcrun simctl openurl booted "mobile://posts/SOME_POST_ID"
   ```

### Test on Android Device/Emulator

1. **Test App Link (requires hosting):**
   ```bash
   adb shell am start -W -a android.intent.action.VIEW -d "https://phanrise.com/posts/SOME_POST_ID"
   ```

2. **Test Custom Scheme (works NOW!):**
   ```bash
   adb shell am start -W -a android.intent.action.VIEW -d "mobile://posts/SOME_POST_ID"
   ```

### Quick Test: Share Feature

1. Open your app
2. Find a post
3. Tap Share → Copy Link
4. The link will be: `https://phanrise.com/posts/{postId}`
5. **For testing now:** Change it to `mobile://posts/{postId}`
6. Send it to yourself and click it
7. It opens in your app! ✅

**💡 Tip:** Once you have hosting set up, you can keep using `https://phanrise.com/posts/...` links and they'll work automatically!

---

## 📱 Supported Link Formats

Your app now handles these link formats:

1. **Universal Links (Recommended):**
   - `https://phanrise.com/posts/{postId}`
   - `https://www.phanrise.com/posts/{postId}`

2. **Custom Scheme (Fallback):**
   - `mobile://posts/{postId}`

3. **User Profile Links:**
   - `https://phanrise.com/{username}`
   - Opens user profile screen

---

## 🔍 Troubleshooting

### Links not opening in app?

1. **Check AASA file is accessible:**
   - Visit: `https://phanrise.com/.well-known/apple-app-site-association`
   - Should return JSON, not HTML

2. **Verify Android Asset Links:**
   - Visit: `https://phanrise.com/.well-known/assetlinks.json`
   - Should return JSON array

3. **Check app.config.js:**
   - Verify `associatedDomains` and `intentFilters` are correct
   - Rebuild the app after changes

4. **Clear app data:**
   - iOS: Uninstall and reinstall app
   - Android: Clear app data, reinstall

5. **Verify domain association:**
   - iOS: Check Settings > Developer > Universal Links
   - Android: Check app info > Open by default

---

## 🎯 Next Steps

1. ✅ Get your Apple Team ID
2. ✅ Build your app with EAS Build (to get Android keystore)
3. ✅ Extract SHA256 fingerprint from Android keystore
4. ✅ Create AASA file on web server
5. ✅ Create Asset Links file on web server
6. ✅ Test deep links on real devices
7. ✅ (Optional) Add web redirect logic

---

## 📚 Resources

- [Apple Universal Links Documentation](https://developer.apple.com/ios/universal-links/)
- [Android App Links Documentation](https://developer.android.com/training/app-links)
- [Expo Linking Documentation](https://docs.expo.dev/guides/linking/)
- [AASA File Validator](https://branch.io/resources/aasa-validator/)
- [Asset Links Validator](https://developers.google.com/digital-asset-links/tools/generator)

---

**Need Help?** Check the troubleshooting section above or refer to the Expo documentation for deep linking.
