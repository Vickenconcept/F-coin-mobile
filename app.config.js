// app.config.js - Expo configuration with environment variables
const path = require('path');
const result = require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Debug: Log what was loaded
if (result.error) {
  console.warn('⚠️  Error loading .env file:', result.error);
} else {
  console.log('✅ Loaded .env file:', Object.keys(result.parsed || {}).length, 'variables');
}

// Get API URL from env or use default
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';
console.log('🔗 API Base URL from config:', apiBaseUrl);

module.exports = {
  expo: {
    name: 'mobile',
    slug: 'mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'mobile',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: ['expo-router'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      apiBaseUrl: apiBaseUrl,
    },
  },
};

