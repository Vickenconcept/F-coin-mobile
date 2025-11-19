import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import Toast from 'react-native-toast-message';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import FontAwesome from '@expo/vector-icons/FontAwesome';

type SocialAccount = {
  id: string;
  provider: string;
  provider_user_id: string | null;
  provider_username: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
};

const PROVIDER_INFO: Record<string, { name: string; color: string; icon: keyof typeof FontAwesome.glyphMap }> = {
  facebook: { name: 'Facebook', color: '#1877F2', icon: 'facebook' },
  instagram: { name: 'Instagram', color: '#E4405F', icon: 'instagram' },
  tiktok: { name: 'TikTok', color: '#000000', icon: 'music' },
  youtube: { name: 'YouTube', color: '#FF0000', icon: 'youtube' },
  tiktok_fan: { name: 'TikTok Fan', color: '#000000', icon: 'user' },
};

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<SocialAccount[]>('/v1/oauth/accounts');
      if (response.ok && Array.isArray(response.data)) {
        setAccounts(response.data);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Unable to load connected accounts',
        });
      }
    } catch (error) {
      console.error('Load accounts error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load accounts',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Listen for deep links (OAuth callbacks) - optional enhancement
  // For now, we rely on browser close detection and polling
  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      const { url } = event;
      console.log('Deep link received:', url);
      
      // Check if it's an OAuth callback
      if (url.includes('oauth-callback') || url.includes('oauth')) {
        // Reload accounts after OAuth callback
        setTimeout(() => {
          loadAccounts();
        }, 1000);
      }
    });

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url && (url.includes('oauth-callback') || url.includes('oauth'))) {
        setTimeout(() => {
          loadAccounts();
        }, 1000);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadAccounts]);

  const connectAccount = async (provider: string) => {
    if (isConnecting[provider]) return;

    setIsConnecting((prev) => ({ ...prev, [provider]: true }));

    try {
      // Get the login URL from backend
      // Use a valid HTTP URL for origin (backend validation requires valid URL)
      // For mobile, we'll detect browser close and refresh accounts
      const apiBaseUrl = 
        Constants.expoConfig?.extra?.apiBaseUrl || 
        process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') || 
        'http://localhost:8000/api';
      const apiOrigin = apiBaseUrl.replace(/\/api\/?$/, ''); // Remove /api to get origin
      const origin = `${apiOrigin}/mobile-oauth-callback`; // Valid URL for backend validation
      
      const response = await apiClient.get<{ url: string }>(
        `/v1/oauth/${provider}/login-url?origin=${encodeURIComponent(origin)}`
      );

      if (!response.ok || !response.data?.url) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: `Unable to start ${provider} connection`,
        });
        return;
      }

      // Open the OAuth URL in browser
      const result = await WebBrowser.openBrowserAsync(response.data.url, {
        // Enable toolbar for better UX
        enableBarCollapsing: false,
      });

      // After browser closes, check if connection was successful
      // The backend processes the OAuth callback, so we refresh accounts
      if (result.type === 'cancel') {
        Toast.show({
          type: 'info',
          text1: 'Cancelled',
          text2: 'Connection cancelled',
        });
      } else {
        // Wait a bit for backend to process, then refresh accounts
        Toast.show({
          type: 'info',
          text1: 'Processing...',
          text2: 'Checking connection status...',
        });
        
        // Poll for account updates (backend might take a moment)
        setTimeout(() => {
          loadAccounts();
        }, 2000);
        
        // Also check again after a longer delay
        setTimeout(() => {
          loadAccounts();
        }, 5000);
      }
    } catch (error) {
      console.error('Connect account error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `Failed to connect ${provider}`,
      });
    } finally {
      setIsConnecting((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const disconnectAccount = async (provider: string) => {
    try {
      const response = await apiClient.delete(`/v1/oauth/${provider}`);
      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Disconnected',
          text2: `${PROVIDER_INFO[provider]?.name || provider} account disconnected`,
        });
        loadAccounts();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to disconnect account',
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'An error occurred',
      });
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadAccounts(), refreshUser()]);
    setRefreshing(false);
  }, [loadAccounts, refreshUser]);

  const accountsMap = accounts.reduce<Record<string, SocialAccount>>((acc, account) => {
    acc[account.provider] = account;
    return acc;
  }, {});

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        {/* User Info */}
        <View style={styles.userCard}>
          {user?.avatar_url ? (
            <Image
              source={{ uri: user.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.display_name || user?.name || user?.username)?.[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          <Text style={styles.userName}>{user?.display_name || user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase() || 'USER'}</Text>
          </View>
        </View>

        {/* Social Accounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Accounts</Text>
          <Text style={styles.sectionSubtitle}>
            Connect your social media accounts to sync posts and track engagement
          </Text>

          {isLoading && accounts.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#FF6B00" />
              <Text style={styles.loadingText}>Loading accounts...</Text>
            </View>
          ) : (
            <>
              {['facebook', 'instagram', 'tiktok', 'youtube'].map((provider) => {
                const account = accountsMap[provider];
                const info = PROVIDER_INFO[provider];
                const isConnectingProvider = isConnecting[provider];

                return (
                  <View key={provider} style={styles.accountCard}>
                    <View style={styles.accountHeader}>
                      <View style={styles.accountInfo}>
                        <View style={[styles.accountIconContainer, { backgroundColor: `${info.color}20` }]}>
                          <FontAwesome
                            name={info.icon}
                            size={24}
                            color={info.color}
                          />
                        </View>
                        <View>
                          <Text style={styles.accountName}>{info.name}</Text>
                          {account ? (
                            <Text style={styles.accountStatus}>
                              Connected as @{account.provider_username || 'user'}
                            </Text>
                          ) : (
                            <Text style={styles.accountStatus}>Not connected</Text>
                          )}
                        </View>
                      </View>
                      {account && (
                        <View style={styles.connectedBadge}>
                          <FontAwesome name="check" size={14} color="#fff" />
                        </View>
                      )}
                    </View>

                    {account && (
                      <View style={styles.accountDetails}>
                        <Text style={styles.detailText}>
                          Connected: {formatDate(account.connected_at)}
                        </Text>
                        {account.last_synced_at && (
                          <Text style={styles.detailText}>
                            Last synced: {formatDate(account.last_synced_at)}
                          </Text>
                        )}
                      </View>
                    )}

                    <View style={styles.accountActions}>
                      {account ? (
                        <TouchableOpacity
                          style={styles.disconnectButton}
                          onPress={() => disconnectAccount(provider)}
                        >
                          <Text style={styles.disconnectButtonText}>Disconnect</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.connectButton,
                            isConnectingProvider && styles.buttonDisabled,
                          ]}
                          onPress={() => connectAccount(provider)}
                          disabled={isConnectingProvider}
                        >
                          {isConnectingProvider ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.connectButtonText}>Connect</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
  },
  userCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  accountCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  accountStatus: {
    fontSize: 12,
    color: '#666',
  },
  connectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  accountDetails: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  accountActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  connectButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  disconnectButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disconnectButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});

