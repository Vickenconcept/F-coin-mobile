import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SidebarProvider } from '../context/SidebarContext';
import { GlobalSidebar } from '../components/GlobalSidebar';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Handle deep linking
  useEffect(() => {
    // Global payment callback handler
    const handlePaymentCallback = (url: string) => {
      console.log('💳 _layout: Checking URL for payment callback:', url);
      
      // Check if it's a payment callback
      const isPaymentCallback = 
        url.startsWith('mobile://payment/') || 
        (url.includes('payment') && url.includes('/callback'));
      
      if (isPaymentCallback) {
        console.log('💳 _layout: Payment callback detected, navigating to payment route:', url);
        
        try {
          // Parse query parameters manually
          const queryString = url.split('?')[1];
          const params: Record<string, string> = {};
          
          if (queryString) {
            queryString.split('&').forEach((param) => {
              const [key, value] = param.split('=');
              if (key && value) {
                params[key] = decodeURIComponent(value);
              }
            });
          }
          
          const status = params.status;
          const message = params.message;
          const sessionId = params.session_id;
          
          // Show toast
          if (status === 'success') {
            Toast.show({
              type: 'success',
              text1: 'Payment Successful',
              text2: message || 'Your payment was completed successfully',
            });
          } else if (status === 'error' || status === 'cancel') {
            Toast.show({
              type: status === 'cancel' ? 'info' : 'error',
              text1: status === 'cancel' ? 'Payment Cancelled' : 'Payment Failed',
              text2: message || (status === 'cancel' ? 'Payment was cancelled' : 'Payment failed'),
            });
          }
          
          // Navigate to payment callback route
          if (isAuthenticated && !loading) {
            router.replace({
              pathname: '/payment/[...params]',
              params: params,
            } as any);
          }
        } catch (error) {
          console.error('Error parsing payment callback:', error);
          // Fallback: navigate to my-coin screen
          if (isAuthenticated && !loading) {
            router.replace('/(tabs)/my-coin');
          }
        }
        
        return true; // Indicate we handled it
      }
      return false;
    };

    // Global OAuth callback handler (works even if settings screen isn't mounted)
    const handleOAuthCallback = (url: string) => {
      console.log('🔐 _layout: Checking URL for OAuth callback:', url);
      
      // Check if it's an OAuth callback - be more specific to avoid false positives
      const isOAuthCallback = 
        url.startsWith('mobile://oauth/') || 
        (url.includes('oauth') && (url.includes('/callback') || url.includes('oauth-callback')));
      
      if (isOAuthCallback) {
        console.log('🔐 _layout: OAuth callback detected, navigating to oauth route:', url);
        
        try {
          // Parse query parameters manually (mobile:// scheme doesn't work with URL constructor)
          const queryString = url.split('?')[1];
          const params: Record<string, string> = {};
          
          if (queryString) {
            queryString.split('&').forEach((param) => {
              const [key, value] = param.split('=');
              if (key && value) {
                params[key] = decodeURIComponent(value);
              }
            });
          }
          
          const status = params.status;
          const message = params.message;
          const provider = params.provider || 'account';
          
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
          
          // Navigate to OAuth callback route (catch-all route will handle it)
          // This prevents expo-router from showing "ops screen doesn't exist"
          if (isAuthenticated && !loading) {
            // Use replace to prevent back navigation
            router.replace({
              pathname: '/oauth/[...params]',
              params: params,
            } as any);
          }
        } catch (error) {
          console.error('Error parsing OAuth callback:', error);
          // Fallback: just navigate to settings
          if (isAuthenticated && !loading) {
            router.replace('/(tabs)/settings');
          }
        }
        
        return true; // Indicate we handled it
      }
      return false;
    };

    // Handle initial URL (app opened from a link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 _layout: Initial URL:', url);
        // Check payment callback first, then OAuth, then general deep links
        if (!handlePaymentCallback(url) && !handleOAuthCallback(url)) {
          handleDeepLink(url);
        }
      }
    });

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('🔗 _layout: Deep link event received:', event.url);
      // Check payment callback first, then OAuth, then general deep links
      if (!handlePaymentCallback(event.url) && !handleOAuthCallback(event.url)) {
        handleDeepLink(event.url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, loading, router]);

  const handleDeepLink = (url: string) => {
    console.log('🔗 Deep link received:', url);
    
    try {
      const parsed = Linking.parse(url);
      console.log('🔗 Parsed deep link:', parsed);
      
      // Handle universal links: https://phanrise.com/posts/{postId}
      if (parsed.hostname === 'phanrise.com' || parsed.hostname === 'www.phanrise.com') {
        const pathSegments = parsed.path?.split('/').filter(Boolean) || [];
        
        if (pathSegments[0] === 'posts' && pathSegments[1]) {
          const postId = pathSegments[1];
          console.log('📱 Opening post:', postId);
          
          // Wait for auth to be ready, then navigate
          if (!loading) {
            if (isAuthenticated) {
              router.push(`/posts/${postId}`);
            } else {
              // Store the postId to navigate after login
              router.replace({
                pathname: '/login',
                params: { redirect: `/posts/${postId}` },
              });
            }
          }
          return;
        }
        
        // Handle user profile links: https://phanrise.com/{username}
        if (pathSegments.length === 1 && pathSegments[0]) {
          const username = pathSegments[0];
          console.log('👤 Opening profile:', username);
          
          if (!loading) {
            if (isAuthenticated) {
              router.push(`/${username}`);
            } else {
              router.replace({
                pathname: '/login',
                params: { redirect: `/${username}` },
              });
            }
          }
          return;
        }
      }
      
      // Handle custom scheme links: mobile://posts/{postId} or mobile://oauth/*
      if (parsed.scheme === 'mobile') {
        const pathSegments = parsed.path?.split('/').filter(Boolean) || [];
        
        // Handle OAuth callbacks: mobile://oauth/{provider}/callback
        // Don't navigate - let the settings screen's listener handle it
        if (pathSegments[0] === 'oauth') {
          console.log('🔐 OAuth callback deep link detected in _layout - letting settings screen handle it');
          // Return early without navigating - the settings screen's Linking listener will catch it
          return;
        }
        
        if (pathSegments[0] === 'posts' && pathSegments[1]) {
          const postId = pathSegments[1];
          console.log('📱 Opening post via custom scheme:', postId);
          
          if (!loading) {
            if (isAuthenticated) {
              router.push(`/posts/${postId}`);
            } else {
              router.replace({
                pathname: '/login',
                params: { redirect: `/posts/${postId}` },
              });
            }
          }
          return;
        }
      }
    } catch (error) {
      console.error('❌ Error handling deep link:', error);
    }
  };

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';
    const inTabsGroup = segments[0] === '(tabs)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to feed tab if authenticated and on auth screen
      router.replace('/(tabs)/feed');
    }
  }, [isAuthenticated, loading, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="discover" 
          options={{ 
            title: 'Discover Creators',
            headerShown: true,
            presentation: 'card',
          }} 
        />
        <Stack.Screen 
          name="profile" 
          options={{ 
            title: 'Profile',
            headerShown: true,
            presentation: 'card',
          }} 
        />
        <Stack.Screen 
          name="[username]" 
          options={{ 
            headerShown: false,
            presentation: 'card',
          }} 
        />
        <Stack.Screen 
          name="posts/[postId]" 
          options={{ 
            headerShown: false,
            presentation: 'card',
          }} 
        />
        <Stack.Screen 
          name="engagements" 
          options={{ 
            headerShown: false,
            presentation: 'card',
          }} 
        />
        <Stack.Screen 
          name="messaging" 
          options={{ 
            headerShown: false,
            presentation: 'card',
          }} 
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <Toast />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SidebarProvider>
          <RootLayoutNav />
          <GlobalSidebar />
        </SidebarProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
