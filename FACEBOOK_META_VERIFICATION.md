# Facebook/Meta Android App Verification Guide

This guide helps you get the required information for Facebook/Meta app verification.

## 1. Class Name (Main Activity)

For **Expo managed workflow**, the main activity class name is:

```
host.exp.exponent.MainActivity
```

**Alternative** (if you've built a standalone APK/AAB):
```
com.fancoin.app.MainActivity
```

### How to verify:
1. Build a standalone APK/AAB using EAS Build or `expo build:android`
2. Extract the APK and check `AndroidManifest.xml` inside
3. Look for the `<activity>` tag with `android.intent.action.MAIN`

**For Facebook/Meta verification, use:**
```
host.exp.exponent.MainActivity
```

---

## 2. Key Hashes

Meta requires key hashes to verify your Android app. You need **both debug and release** key hashes.

### Option A: Using Expo (Recommended)

#### For Debug Key Hash:
```bash
# On Windows (PowerShell)
keytool -exportcert -alias androiddebugkey -keystore %USERPROFILE%\.android\debug.keystore -storepass android -keypass android | openssl sha1 -binary | openssl base64

# On macOS/Linux
keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android | openssl sha1 -binary | openssl base64
```

#### For Release Key Hash:
If you're using EAS Build, you can get your release keystore info:
```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Login to Expo
eas login

# Get credentials
eas credentials
```

Then use the keystore path and alias:
```bash
keytool -exportcert -alias YOUR_RELEASE_ALIAS -keystore PATH_TO_YOUR_RELEASE_KEYSTORE -storepass YOUR_STORE_PASS | openssl sha1 -binary | openssl base64
```

### Option B: Using Facebook's Key Hash Tool

1. Install the Facebook SDK in your app temporarily
2. Use Facebook's `FacebookSdk.getApplicationSignature()` method
3. Log the key hash in your app

### Option C: Generate from APK

If you have a built APK:
```bash
# Extract certificate from APK
keytool -printcert -jarfile your-app.apk | openssl sha1 -binary | openssl base64
```

---

## 3. Install Referrer Decryption Key (Optional)

This is **only required** if you're using Google Play Install Referrer API for attribution.

### How to get it:
1. Go to [Google Play Console](https://play.google.com/console)
2. Navigate to your app → **Setup** → **App integrity**
3. Under **App signing**, find **"App signing key certificate"**
4. Copy the **SHA-256 certificate fingerprint**
5. This is your Install Referrer Decryption Key

**Note:** If you're not using install referrer tracking, you can skip this field in Facebook's verification form.

---

## Quick Checklist for Facebook/Meta Verification

- [ ] **Package Name**: `com.fancoin.app` ✅ (Already configured)
- [ ] **Class Name**: `host.exp.exponent.MainActivity`
- [ ] **Debug Key Hash**: (Generate using commands above)
- [ ] **Release Key Hash**: (Generate using commands above)
- [ ] **Install Referrer Key**: (Optional - only if using Google Play Install Referrer API)

---

## Testing Your Key Hashes

After adding key hashes to Facebook Developer Console:

1. Build a debug APK: `expo build:android -t apk` or use EAS Build
2. Install on a device
3. Test Facebook login/API calls
4. Check Facebook Developer Console → **Tools** → **Debugging** → **Key Hash Tool** for validation

---

## Troubleshooting

### "There was a problem verifying this package name" Error

**This is the most common issue!** Facebook tries to verify your package name by checking if it exists on Google Play Store.

#### Solution 1: Use "Use This Package Name" Option (Recommended for Development)

If your app isn't published on Google Play yet:

1. In Facebook Developer Console, when you see the verification error
2. Look for a link or button that says **"Use this package name"** or **"Continue without verification"**
3. Click it to proceed without Google Play verification
4. You can verify it later once your app is published

#### Solution 2: Publish to Google Play (For Production)

1. Build your app using EAS Build:
   ```bash
   eas build --platform android
   ```

2. Upload the AAB to Google Play Console
3. Publish to **Internal Testing** or **Closed Testing** track (doesn't need to be public)
4. Once published, Facebook can verify the package name automatically

#### Solution 3: Skip Package Name Verification (Temporary)

For development/testing purposes:
- You can skip the package name verification step
- Add your key hashes instead (they're more important for authentication)
- Complete package name verification later when you publish to Play Store

**Important Notes:**
- Package name verification is **not required** for Facebook login to work
- Key hashes are **more critical** for authentication
- You can always verify the package name later after publishing

### "Invalid Key Hash" Error
- Make sure you're using the **correct keystore** (debug vs release)
- For production, always use the **release keystore** hash
- Facebook requires **both** debug and release hashes for testing and production

### "Class Name Not Found"
- Verify you're using `host.exp.exponent.MainActivity` for Expo managed workflow
- If using bare workflow, check your `AndroidManifest.xml` for the actual main activity

---

## Additional Resources

- [Facebook Android SDK Setup](https://developers.facebook.com/docs/android/getting-started)
- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)

