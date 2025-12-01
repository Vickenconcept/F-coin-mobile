# 📱 Google Play Publishing Guide - Phanrise Mobile App

## 🎯 Overview

This guide will walk you through publishing your Phanrise mobile app to Google Play Store so you can download and test it on your Android device.

**Estimated Time:** 2-4 hours (first time)  
**Cost:** $25 one-time Google Play Developer fee

---

## ✅ Prerequisites

### 1. **Google Play Developer Account**
- Go to https://play.google.com/console/signup
- Pay the $25 one-time registration fee
- Complete your developer profile
- ✅ **DO THIS FIRST** (can take 24-48 hours for approval)

### 2. **Expo Account** (Free)
- Sign up at https://expo.dev/signup
- You'll use Expo's EAS Build service to build your app

### 3. **Production Backend URL**
- Your backend API should be hosted (e.g., `https://api.phanrise.com` or your current backend URL)
- Make sure CORS is configured correctly
- SSL certificate must be valid

---

## 📋 Step-by-Step Guide

### **STEP 1: Prepare App Configuration**

#### 1.1 Update App Name
Your app name is currently "mobile" - it should be "Phanrise":

✅ **Already configured:**
- Package name: `com.phanrise.app` ✅
- App icon: ✅
- Splash screen: ✅

#### 1.2 Create Production Environment File

Create `mobile/.env` file:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-backend-api-url.com/api
```

**Important:** Replace with your actual production backend URL!

#### 1.3 Update App Config

Make sure your `app.config.js` has the correct app name (we'll fix this).

---

### **STEP 2: Install EAS CLI**

EAS (Expo Application Services) is Expo's build service.

```bash
# Navigate to mobile directory
cd mobile

# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login
```

---

### **STEP 3: Configure EAS Build**

#### 3.1 Initialize EAS

```bash
# In mobile directory
eas build:configure
```

This creates `eas.json` file with build configuration.

#### 3.2 Configure eas.json

You'll need to edit `eas.json` to set up Android builds:

```json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

### **STEP 4: Build Your App**

#### Option A: Build APK (For Quick Testing)

**APK** = Install directly on your phone (faster, for testing)

```bash
# Build APK
eas build --platform android --profile preview
```

This will:
- Upload your code to Expo servers
- Build the Android APK (takes ~15-30 minutes)
- Give you a download link

**Download and install on your phone:**
1. Get the download link from Expo dashboard
2. Download APK on your Android phone
3. Enable "Install from unknown sources" in phone settings
4. Install the APK
5. Test!

#### Option B: Build App Bundle (For Google Play)

**AAB** = Required format for Google Play Store

```bash
# Build Android App Bundle (for Google Play)
eas build --platform android --profile production
```

This takes ~15-30 minutes and creates an `.aab` file.

---

### **STEP 5: Prepare Google Play Store Listing**

While your app is building, prepare your store listing:

#### 5.1 Create New App in Google Play Console

1. Go to https://play.google.com/console
2. Click "Create app"
3. Fill in:
   - **App name:** Phanrise
   - **Default language:** English (or your preferred)
   - **App or game:** App
   - **Free or paid:** Free
   - **Declarations:** Check all that apply (content rating, etc.)

#### 5.2 Complete Store Listing

Go to **Store presence > Main store listing**:

**Required:**
- ✅ **App name:** Phanrise
- ✅ **Short description:** (up to 80 characters)
  - Example: "Earn rewards by engaging with your favorite creators' content"
- ✅ **Full description:** (up to 4000 characters)
  - Describe your app's features, how it works, etc.
- ✅ **App icon:** Upload your icon (1024x1024 PNG)
- ✅ **Feature graphic:** (1024x500 PNG) - This is the banner at top
- ✅ **Screenshots:** At least 2 screenshots (minimum 1 phone, 1 tablet)
- ✅ **Categories:** Select appropriate category

**Optional but recommended:**
- Promo video
- Phone screenshots (2-8 images)
- Tablet screenshots
- TV screenshots
- Wear OS screenshots

#### 5.3 Set Up App Content

Go to **Policy > App content**:

- ✅ **Privacy Policy:** Required! Add your privacy policy URL
- ✅ **Content rating:** Complete the questionnaire
- ✅ **Target audience:** Select appropriate age group
- ✅ **Data safety:** Answer questions about data collection

---

### **STEP 6: Upload Your App Bundle**

#### 6.1 Go to Production Track

1. In Google Play Console, go to **Release > Production**
2. Click **Create new release**

#### 6.2 Upload AAB File

1. Download your `.aab` file from Expo dashboard (after build completes)
2. Upload it in Google Play Console
3. Add **Release notes:**
   ```
   Initial release of Phanrise
   - Creator coin launch
   - Social media integration
   - Reward distribution
   - Wallet system
   ```

#### 6.3 Review and Rollout

1. Click **Review release**
2. Fix any warnings/errors
3. Click **Start rollout to Production**

**Note:** First release might take 1-7 days for Google review.

---

### **STEP 7: Internal Testing (Optional but Recommended)**

Before public release, test with internal testers:

#### 7.1 Create Internal Testing Track

1. Go to **Release > Testing > Internal testing**
2. Click **Create new release**
3. Upload your AAB file
4. Add testers (email addresses)
5. Share testing link with them

#### 7.2 Test the App

- Testers can install from the link
- Test all features thoroughly
- Fix any critical bugs
- Then promote to production

---

## 🔧 Configuration Checklist

Before building, make sure:

### ✅ App Configuration
- [ ] App name is "Phanrise" (not "mobile")
- [ ] Package name: `com.phanrise.app`
- [ ] Version: `1.0.0` (or increment for updates)
- [ ] App icon exists: `assets/images/icon.png`
- [ ] Splash screen exists: `assets/images/splash-icon.png`
- [ ] Adaptive icon exists: `assets/images/adaptive-icon.png`

### ✅ Environment Configuration
- [ ] `.env` file created with production API URL
- [ ] API URL is HTTPS (not HTTP)
- [ ] Backend CORS configured for mobile app
- [ ] Backend is accessible from mobile devices

### ✅ Google Play Account
- [ ] Google Play Developer account created ($25 paid)
- [ ] Developer account approved
- [ ] Bank account/tax info added (for payments later)

---

## 🚨 Common Issues & Solutions

### Issue 1: Build Fails
**Solution:**
- Check `eas.json` configuration
- Verify all dependencies are in `package.json`
- Check Expo dashboard for error logs

### Issue 2: App Crashes on Launch
**Solution:**
- Check API URL is correct and accessible
- Verify SSL certificate is valid
- Check network permissions in app config
- Review logs: `adb logcat` (if testing locally)

### Issue 3: Google Play Rejects App
**Common reasons:**
- Missing privacy policy
- Content rating incomplete
- Screenshots missing
- App not functioning properly

### Issue 4: API Not Working
**Solution:**
- Verify API URL in `.env` file
- Check CORS settings on backend
- Ensure backend accepts mobile app requests
- Test API with Postman first

---

## 📱 Testing Your Published App

### Option 1: Internal Testing Track
- Fastest way to test
- Only visible to testers you add
- No Google review needed
- Share link with testers

### Option 2: Production Release
- Public release (after review)
- Available to everyone
- Takes 1-7 days for review
- Searchable on Play Store

---

## 🔄 Updating Your App

When you need to release an update:

1. **Update version number:**
   ```json
   // app.config.js
   version: '1.0.1'
   ```

2. **Build new version:**
   ```bash
   eas build --platform android --profile production
   ```

3. **Upload to Google Play:**
   - Go to Play Console
   - Create new release
   - Upload new AAB
   - Add release notes
   - Rollout

---

## 💡 Quick Start Commands

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login to Expo
eas login

# 3. Configure EAS
cd mobile
eas build:configure

# 4. Build APK for testing
eas build --platform android --profile preview

# 5. Build AAB for Google Play
eas build --platform android --profile production

# 6. Check build status
eas build:list
```

---

## 📞 Need Help?

- **Expo Docs:** https://docs.expo.dev/build/introduction/
- **Google Play Help:** https://support.google.com/googleplay/android-developer
- **EAS Build Status:** Check https://expo.dev

---

## ✅ Final Checklist Before Publishing

- [ ] Google Play Developer account created ($25 paid)
- [ ] App name updated to "Phanrise"
- [ ] Production API URL configured
- [ ] App builds successfully
- [ ] Tested on physical device (APK)
- [ ] Store listing complete
- [ ] Privacy policy added
- [ ] Content rating completed
- [ ] Screenshots uploaded
- [ ] App bundle (.aab) built
- [ ] Uploaded to Google Play Console
- [ ] Release created and submitted

---

**Good luck! 🚀**

