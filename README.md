# FanCoin Mobile App

React Native mobile app built with Expo for the FanCoin platform.

## Prerequisites

- Node.js (LTS version)
- Expo CLI installed globally: `npm install -g expo-cli`
- Expo Go app installed on your phone (from App Store/Google Play)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API URL:**
   
   Create a `.env` file in the `mobile` directory:
   ```env
   EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api
   ```
   
   For production, update this to your backend API URL:
   ```env
   EXPO_PUBLIC_API_BASE_URL=https://your-domain.com/api
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Run on your phone:**
   - Open Expo Go app on your phone
   - Scan the QR code shown in the terminal/browser
   - The app will load on your phone

## Project Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx     # Dashboard screen
│   │   └── _layout.tsx   # Tab navigation layout
│   ├── login.tsx          # Login screen
│   ├── register.tsx       # Registration screen
│   └── _layout.tsx        # Root layout with auth
├── lib/                   # Core utilities
│   ├── apiClient.ts      # API client for backend
│   └── auth.ts           # Authentication service
├── context/               # React contexts
│   └── AuthContext.tsx   # Authentication context
└── components/            # Reusable components
```

## Features

- ✅ User authentication (Login/Register)
- ✅ Secure token storage using Expo SecureStore
- ✅ Protected routes (redirects to login if not authenticated)
- ✅ Toast notifications for user feedback
- ✅ Dashboard screen with user profile
- ✅ API integration with Laravel backend

## API Configuration

The app connects to your Laravel backend API. Make sure:

1. Your backend is running (default: `http://localhost:8000`)
2. CORS is configured to allow requests from your mobile app
3. The API endpoints match the expected format:
   - `POST /api/v1/auth/login`
   - `POST /api/v1/auth/register`
   - `GET /api/v1/auth/me`
   - `POST /api/v1/auth/logout`

## Development

### Running on iOS Simulator
```bash
npm run ios
```

### Running on Android Emulator
```bash
npm run android
```

### Running on Web
```bash
npm run web
```

## Next Steps

- [ ] Connect social accounts (Instagram, TikTok, Facebook, YouTube)
- [ ] Wallet screen with coin balance
- [ ] Social media post feed
- [ ] Engagement tracking
- [ ] Reward system
- [ ] Profile management

## Troubleshooting

**Issue: Can't connect to backend API**
- Make sure your backend is running
- Check that `EXPO_PUBLIC_API_BASE_URL` is correct
- For physical device testing, use your computer's IP address instead of `localhost`:
  ```env
  EXPO_PUBLIC_API_BASE_URL=http://192.168.1.XXX:8000/api
  ```

**Issue: Token not persisting**
- Make sure `expo-secure-store` is properly installed
- Check device permissions for secure storage

**Issue: App crashes on startup**
- Clear Expo cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

