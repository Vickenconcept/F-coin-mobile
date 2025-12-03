import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';

/**
 * Catch-all route for OAuth callbacks: mobile://oauth/{provider}/callback
 * This prevents expo-router from showing "ops screen doesn't exist"
 */
export default function OAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    console.log('🔐 OAuth callback route hit with params:', params);
    
    // Extract status, message, provider from query params
    const status = params.status as string;
    const message = params.message as string;
    const provider = (params.provider as string) || 'account';
    
    // Show toast
    if (status === 'success') {
      Toast.show({
        type: 'success',
        text1: 'Connected',
        text2: message || `${provider} account connected successfully`,
      });
    } else if (status === 'error') {
      Toast.show({
        type: 'error',
        text1: 'Connection Failed',
        text2: message || 'Failed to connect account',
      });
    }
    
    // Navigate to settings screen after a short delay
    setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/(tabs)/settings');
      } else {
        router.replace('/login');
      }
    }, 1500);
  }, [params, isAuthenticated, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
      <ActivityIndicator size="large" color="#FF6B00" />
      <Text style={{ marginTop: 16, color: '#1f2937', fontSize: 16 }}>
        Processing connection...
      </Text>
    </View>
  );
}

