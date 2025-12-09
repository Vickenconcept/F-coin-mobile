import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';

/**
 * Catch-all route for payment callbacks: mobile://payment/callback
 * This prevents expo-router from showing "ops screen doesn't exist"
 */
export default function PaymentCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const { status, message, session_id } = params;

    // Show toast (already shown in _layout, but show again for safety)
    if (status === 'success') {
      Toast.show({
        type: 'success',
        text1: 'Payment Successful',
        text2: (message as string) || 'Your payment was completed successfully',
      });
    } else if (status === 'error' || status === 'cancel') {
      Toast.show({
        type: status === 'cancel' ? 'info' : 'error',
        text1: status === 'cancel' ? 'Payment Cancelled' : 'Payment Failed',
        text2: (message as string) || (status === 'cancel' ? 'Payment was cancelled' : 'Payment failed'),
      });
    }

    // Navigate to my-coin screen to show updated balance
    if (isAuthenticated) {
      // Small delay to ensure toast is visible
      setTimeout(() => {
        router.replace('/(tabs)/my-coin');
      }, 1500);
    } else {
      // If not authenticated, redirect to login, then my-coin
      router.replace({
        pathname: '/login',
        params: { redirect: '/(tabs)/my-coin' },
      });
    }
  }, [params, isAuthenticated, loading, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF6B00" />
      <Text style={styles.text}>
        {params.status === 'success' ? 'Processing payment...' : 'Payment cancelled'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: '#333',
  },
});

