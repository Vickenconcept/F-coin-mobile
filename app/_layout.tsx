import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';

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
    // Handle initial URL (app opened from a link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
      
      // Handle custom scheme links: mobile://posts/{postId}
      if (parsed.scheme === 'mobile') {
        const pathSegments = parsed.path?.split('/').filter(Boolean) || [];
        
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
    <AuthProvider>
      <SidebarProvider>
        <RootLayoutNav />
        <GlobalSidebar />
      </SidebarProvider>
    </AuthProvider>
  );
}
