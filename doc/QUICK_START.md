# Quick Start Guide - FanCoin Mobile App

## 🚀 Get Started in 3 Steps

### Step 1: Configure Your Backend URL

Create a `.env` file in the `mobile` folder:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

**Important for Physical Device Testing:**
If you're testing on a real phone (not emulator), replace `localhost` with your computer's IP address:

1. Find your computer's IP:
   - Windows: Open Command Prompt and type `ipconfig`, look for "IPv4 Address"
   - Mac/Linux: Open Terminal and type `ifconfig` or `ip addr`

2. Update `.env`:
   ```env
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.XXX:8000/api
   ```

### Step 2: Start Your Backend

Make sure your Laravel backend is running:

```bash
cd backend
php artisan serve
```

The backend should be running on `http://localhost:8000`

### Step 3: Start the Mobile App

```bash
cd mobile
npm start
```

This will:
- Start the Expo development server
- Open a browser with a QR code
- Show options to run on iOS/Android/Web

### Step 4: Test on Your Phone

1. **Install Expo Go** from App Store (iOS) or Google Play (Android)

2. **Scan the QR code** shown in the terminal or browser

3. **Wait for the app to load** - it may take a minute the first time

4. **Test the app:**
   - Try registering a new account
   - Login with your credentials
   - View your dashboard

## ✅ What's Working

- ✅ User Registration
- ✅ User Login
- ✅ Secure Token Storage
- ✅ Protected Routes (auto-redirects to login if not authenticated)
- ✅ Dashboard with user profile
- ✅ Logout functionality
- ✅ Toast notifications for feedback

## 🔧 Troubleshooting

### "Network Error" or "Can't connect to API"
- Make sure your backend is running (`php artisan serve`)
- Check that your `.env` file has the correct API URL
- For physical device: Use your computer's IP instead of `localhost`
- Make sure your phone and computer are on the same WiFi network

### "Token not found" or Auth issues
- Try logging out and logging back in
- Clear app data: In Expo Go, shake your device → "Reload"

### App won't load
- Clear Expo cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### Backend CORS errors
Make sure your Laravel backend allows requests from your mobile app. Check `backend/config/cors.php` or add to your `.env`:

```env
SANCTUM_STATEFUL_DOMAINS=localhost,127.0.0.1,your-ip-address
```

## 📱 Next Features to Build

- [ ] Wallet screen with coin balance
- [ ] Connect social accounts (Instagram, TikTok, etc.)
- [ ] View social media posts
- [ ] Track engagements
- [ ] Earn and redeem coins

## 🎉 You're Ready!

Your mobile app is now connected to your backend API. Start building more features!

