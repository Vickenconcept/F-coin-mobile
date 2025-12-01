# Network Troubleshooting Guide

## Common Network Errors

### Error: `ERR_NETWORK` or "Network Error"

This means the mobile app cannot reach your backend server. Follow these steps:

## Step 1: Verify Backend is Running

Make sure your Laravel backend is running:

```bash
cd backend
php artisan serve --host=0.0.0.0 --port=8000
```

**Important:** Use `--host=0.0.0.0` to allow connections from other devices on your network, not just localhost.

## Step 2: Check Your IP Address

1. **Windows:**
   ```cmd
   ipconfig
   ```
   Look for "IPv4 Address" under your active network adapter (usually WiFi or Ethernet)

2. **Mac/Linux:**
   ```bash
   ifconfig
   # or
   ip addr
   ```
   Look for your network interface (usually `en0` on Mac, `wlan0` on Linux)

3. **Update `.env` file:**
   ```env
   EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP_ADDRESS:8000/api
   ```
   Example: `http://192.168.8.48:8000/api`

## Step 3: Verify Network Connectivity

1. **Check if phone and computer are on the same WiFi network**
   - Both devices must be on the same local network

2. **Test from your phone's browser:**
   - Open browser on your phone
   - Navigate to: `http://YOUR_IP:8000/api/v1/auth/me`
   - You should see a JSON response (even if it's an error, it means the server is reachable)

3. **Check firewall:**
   - Windows: Allow port 8000 through Windows Firewall
   - Mac: Check System Preferences > Security & Privacy > Firewall

## Step 4: Restart Expo

After changing `.env` file:

```bash
# Stop the current Expo server (Ctrl+C)
# Then restart:
npm start
# Or clear cache:
npm start -- --clear
```

## Step 5: Verify Configuration

Check the console logs when the app starts. You should see:
```
🔗 API Base URL: http://192.168.8.48:8000/api
```

If it shows `localhost`, the `.env` file is not being read correctly.

## Quick Test

1. **From your computer's browser:**
   - Open: `http://localhost:8000/api/v1/auth/me`
   - Should work (backend is running)

2. **From your phone's browser (same WiFi):**
   - Open: `http://192.168.8.48:8000/api/v1/auth/me`
   - Should also work (backend is accessible)

3. **If phone browser works but app doesn't:**
   - Restart Expo with `npm start -- --clear`
   - Check that `.env` file exists in `mobile/` directory
   - Verify the IP address in `.env` matches your computer's IP

## Alternative: Use ngrok for Testing

If you can't get local network working, use ngrok:

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 8000
```

Then use the ngrok URL in your `.env`:
```env
EXPO_PUBLIC_API_BASE_URL=https://your-ngrok-url.ngrok.io/api
```

## Still Having Issues?

1. **Check backend CORS settings** - Make sure `config/cors.php` allows your mobile app origin
2. **Check Laravel logs** - `backend/storage/logs/laravel.log`
3. **Try using `localhost` for emulator** - If testing on Android/iOS emulator, use `http://10.0.2.2:8000/api` (Android) or `http://localhost:8000/api` (iOS)

