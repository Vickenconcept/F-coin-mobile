# 🚀 Quick Publish Checklist - Google Play

## ⚡ Fast Track Steps (For Testing)

### 1. **Prerequisites (Do These First!)**

- [ ] **Google Play Developer Account** ($25 one-time)
  - Sign up: https://play.google.com/console/signup
  - Wait for approval (can take 24-48 hours)

- [ ] **Expo Account** (Free)
  - Sign up: https://expo.dev/signup

- [ ] **Production Backend URL**
  - Your backend must be accessible via HTTPS
  - Create `.env` file in mobile folder with:
    ```
    EXPO_PUBLIC_API_BASE_URL=https://your-backend-url.com/api
    ```

---

## 📱 Build & Test Locally First

### Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

### Step 2: Login to Expo

```bash
eas login
```

### Step 3: Build APK (For Testing on Your Phone)

```bash
cd mobile
eas build --platform android --profile preview
```

**This builds an APK file** (takes 15-30 minutes)
- You'll get a download link
- Download to your Android phone
- Install it (enable "Unknown sources" in settings)
- Test everything works!

---

## 🏪 Publish to Google Play (For Public Release)

### Step 1: Build App Bundle (AAB)

```bash
eas build --platform android --profile production
```

**This creates an AAB file** needed for Google Play (takes 15-30 minutes)

### Step 2: Setup Google Play Console

1. Go to https://play.google.com/console
2. Create new app
3. Fill in:
   - App name: **Phanrise**
   - Category: Social or Entertainment
   - Free app

### Step 3: Complete Store Listing

**Required items:**
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] App icon (1024x1024)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (at least 2)
- [ ] Privacy Policy URL
- [ ] Content rating (complete questionnaire)

### Step 4: Upload Your App

1. Go to **Release > Production**
2. Create new release
3. Upload the `.aab` file from Expo
4. Add release notes
5. Submit for review

**First release takes 1-7 days for Google review.**

---

## ⚠️ Important Notes

### Before Building:

1. **Update app name** ✅ Already done ("Phanrise")
2. **Set production API URL** in `.env` file
3. **Test locally first** with APK before publishing
4. **Make sure backend is accessible** from mobile devices

### Security:

- ✅ Use HTTPS for API URL (required)
- ✅ Backend CORS must allow mobile app
- ✅ Check SSL certificate is valid

---

## 🎯 Quick Commands Reference

```bash
# Install EAS
npm install -g eas-cli

# Login
eas login

# Build APK (testing)
eas build --platform android --profile preview

# Build AAB (Google Play)
eas build --platform android --profile production

# Check build status
eas build:list
```

---

## ❓ Need Help?

**Full detailed guide:** See `GOOGLE_PLAY_PUBLISHING_GUIDE.md`

**Common issues:**
- Build fails → Check Expo dashboard for errors
- App crashes → Verify API URL is correct
- Can't install APK → Enable "Unknown sources" in Android settings

---

## ✅ Pre-Launch Checklist

- [ ] Google Play Developer account created ($25)
- [ ] Expo account created
- [ ] Production API URL configured in `.env`
- [ ] App builds successfully (APK)
- [ ] Tested on your phone (APK works)
- [ ] Store listing prepared
- [ ] Privacy policy URL ready
- [ ] Screenshots ready
- [ ] App bundle (AAB) built
- [ ] Ready to upload!

**Once all checked, you're ready to publish! 🚀**

