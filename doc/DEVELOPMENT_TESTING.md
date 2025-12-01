# 🧪 Testing Deep Links During Development

## ✅ What Works RIGHT NOW (No Hosting Required)

### Custom Scheme Links Work Immediately!

You can test deep linking **right now** without any web server setup using custom scheme links.

---

## 🚀 Quick Test Instructions

### Method 1: Command Line (Easiest)

**On iOS Simulator:**
```bash
xcrun simctl openurl booted "mobile://posts/YOUR_POST_ID_HERE"
```

**On Android Device/Emulator:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "mobile://posts/YOUR_POST_ID_HERE"
```

Replace `YOUR_POST_ID_HERE` with an actual post ID from your app.

---

### Method 2: Test from Your App

1. **Open your app** and find a post
2. **Share the post** → Copy the link
3. The copied link will be: `https://phanrise.com/posts/{postId}`
4. **Change it to:** `mobile://posts/{postId}`
5. **Send it to yourself** via:
   - WhatsApp
   - SMS
   - Email
   - Notes app
6. **Click the link** → It opens in your app! ✅

---

### Method 3: Using a QR Code (Fun!)

1. Create a QR code for: `mobile://posts/YOUR_POST_ID`
2. Use any QR code generator: https://www.qr-code-generator.com/
3. Scan with your phone
4. Opens in your app! ✅

---

## 📱 What Link Formats Work?

### ✅ Works Now (Custom Schemes)

- `mobile://posts/{postId}` ✅
- `mobile://{username}` ✅ (for user profiles)

**These work immediately, no hosting needed!**

### ⚠️ Needs Hosting (Universal Links)

- `https://phanrise.com/posts/{postId}` ⚠️ (needs AASA file)
- `https://www.phanrise.com/posts/{postId}` ⚠️ (needs AASA file)

**These require web server setup first (see DEEP_LINKING_SETUP.md)**

---

## 🔍 How to Get a Post ID

### Option 1: From the App

1. Open your app
2. Find any post in the feed
3. Share it → Copy link
4. The URL contains the post ID: `https://phanrise.com/posts/abc-123-def`
   - Post ID is: `abc-123-def`

### Option 2: From Console Logs

1. Open your app in development
2. Share a post
3. Check console logs - you'll see the post ID

### Option 3: From Database

If you have access to your database:
```sql
SELECT id FROM feed_posts LIMIT 1;
```

---

## 🎯 Testing Scenarios

### Test 1: Opening Post from Link

1. Get a post ID
2. Send yourself: `mobile://posts/{postId}`
3. Click it
4. **Expected:** App opens → Shows post detail screen ✅

### Test 2: Opening Post While Logged Out

1. Log out of your app
2. Send yourself: `mobile://posts/{postId}`
3. Click it
4. **Expected:** App opens → Shows login screen → After login, shows post ✅

### Test 3: Opening Post While App is Closed

1. Close your app completely
2. Send yourself: `mobile://posts/{postId}`
3. Click it
4. **Expected:** App launches → Shows post detail screen ✅

### Test 4: Opening Post While App is Running

1. Open your app (on feed screen)
2. Send yourself: `mobile://posts/{postId}`
3. Click it
4. **Expected:** App navigates to post detail screen ✅

---

## 🛠️ Development Testing Checklist

- [ ] Test custom scheme link opens app
- [ ] Test post detail screen loads correctly
- [ ] Test authentication redirect works
- [ ] Test link works when app is closed
- [ ] Test link works when app is running
- [ ] Test link works when logged out (redirects to login)
- [ ] Test link works when logged in (shows post directly)

---

## 💡 Pro Tips

1. **Use Shortcuts App (iOS):**
   - Create a shortcut that opens `mobile://posts/{postId}`
   - Add to home screen for quick testing

2. **Use Tasker/Automation (Android):**
   - Create automation to open deep links
   - Great for repeated testing

3. **Bookmark Test Links:**
   - Save test links in browser bookmarks
   - Quick access during development

4. **Create Test Post IDs:**
   - Keep a list of known post IDs for testing
   - Makes testing faster

---

## 🚨 Common Issues

### Link Not Opening App?

1. **Check app is installed:**
   - Make sure your app is installed on the device

2. **Check custom scheme:**
   - Verify the link format: `mobile://posts/{postId}` (not `mobile://posts/{postId}/`)

3. **Check app.config.js:**
   - Make sure `scheme: 'mobile'` is set

4. **Rebuild app:**
   - If you changed app.config.js, rebuild: `npx expo run:ios` or `npx expo run:android`

### App Opens But Shows Wrong Screen?

1. **Check console logs:**
   - Look for deep link handler logs
   - Verify post ID is being parsed correctly

2. **Check route exists:**
   - Verify `/posts/[postId].tsx` file exists

3. **Check authentication:**
   - Make sure you're logged in (or test with logged out flow)

---

## 🎉 Next Steps

Once you're ready to test with real universal links:

1. Set up hosting (see DEEP_LINKING_SETUP.md)
2. Create AASA file (iOS)
3. Create Asset Links file (Android)
4. Test with `https://phanrise.com/posts/{postId}` links

**But for now, custom schemes work perfectly for development and testing!** 🚀
