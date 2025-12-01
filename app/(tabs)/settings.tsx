import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import Toast from 'react-native-toast-message';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

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

type NotificationPreferences = {
  email: {
    top_up: boolean;
    wallet_transfer: boolean;
    reward: boolean;
  };
  in_app: {
    top_up: boolean;
    wallet_transfer: boolean;
    reward: boolean;
  };
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser, logout } = useAuth();
  const router = useRouter();
  
  // Social accounts state
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Notification preferences state
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    email: {
      top_up: true,
      wallet_transfer: true,
      reward: false,
    },
    in_app: {
      top_up: true,
      wallet_transfer: true,
      reward: true,
    },
  });
  const [isSavingNotificationPrefs, setIsSavingNotificationPrefs] = useState(false);
  const [notificationPrefsDirty, setNotificationPrefsDirty] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'social' | 'notifications' | 'account'>('social');

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
    if (activeTab === 'social') {
      loadAccounts();
    }
  }, [activeTab, loadAccounts]);

  // Listen for deep links (OAuth callbacks)
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

  // Track initial preferences to detect changes and prevent reversion
  const [initialNotificationPrefs, setInitialNotificationPrefs] = useState<NotificationPreferences | null>(null);

  // Load notification preferences from user object (only when user changes and we don't have initial prefs)
  useEffect(() => {
    if (user && !initialNotificationPrefs) {
      const raw = (user as any)?.notification_preferences ?? {};
      const loadedPrefs = {
        email: {
          top_up: typeof raw?.email?.['top_up.completed'] === 'boolean' ? raw.email['top_up.completed'] : true,
          wallet_transfer: typeof raw?.email?.['wallet.transfer'] === 'boolean' ? raw.email['wallet.transfer'] : true,
          reward: typeof raw?.email?.['reward.awarded'] === 'boolean' ? raw.email['reward.awarded'] : false,
        },
        in_app: {
          top_up: typeof raw?.in_app?.['top_up.completed'] === 'boolean' ? raw.in_app['top_up.completed'] : true,
          wallet_transfer: typeof raw?.in_app?.['wallet.transfer'] === 'boolean' ? raw.in_app['wallet.transfer'] : true,
          reward: typeof raw?.in_app?.['reward.awarded'] === 'boolean' ? raw.in_app['reward.awarded'] : true,
        },
      };
      setNotificationPreferences(loadedPrefs);
      setInitialNotificationPrefs(loadedPrefs);
      setNotificationPrefsDirty(false);
    }
  }, [user, initialNotificationPrefs]);

  const connectAccount = async (provider: string) => {
    if (isConnecting[provider]) return;

    setIsConnecting((prev) => ({ ...prev, [provider]: true }));

    try {
      // Get the login URL from backend
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
        enableBarCollapsing: false,
      });

      // After browser closes, check if connection was successful
      if (result.type === 'cancel') {
        Toast.show({
          type: 'info',
          text1: 'Cancelled',
          text2: 'Connection cancelled',
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Processing...',
          text2: 'Checking connection status...',
        });
        
        // Poll for account updates
        setTimeout(() => {
          loadAccounts();
        }, 2000);
        
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

  const handleUpdateNotificationPreference = (
    channel: 'email' | 'in_app',
    key: 'top_up' | 'wallet_transfer' | 'reward',
    value: boolean
  ) => {
    setNotificationPreferences((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [key]: value,
      },
    }));
    setNotificationPrefsDirty(true);
  };

  const handleSaveNotificationPreferences = async () => {
    setIsSavingNotificationPrefs(true);
    try {
      // Backend expects simple keys (top_up, wallet_transfer, reward)
      // It will map them internally to dot notation (top_up.completed, etc.)
      const payload = {
        email: {
          top_up: notificationPreferences.email.top_up,
          wallet_transfer: notificationPreferences.email.wallet_transfer,
          reward: notificationPreferences.email.reward,
        },
        in_app: {
          top_up: notificationPreferences.in_app.top_up,
          wallet_transfer: notificationPreferences.in_app.wallet_transfer,
          reward: notificationPreferences.in_app.reward,
        },
      };

      const response = await apiClient.request('/v1/profile/notifications', {
        method: 'PUT',
        data: payload as any,
      });

      if (response.ok) {
        // Update initial preferences BEFORE refreshUser to prevent reversion
        // This matches the frontend pattern: setInitialPreferences(preferences) before refreshUser()
        setInitialNotificationPrefs(notificationPreferences);
        setNotificationPrefsDirty(false);
        
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Notification preferences saved',
          visibilityTime: 2000,
        });
        
        // Refresh user to sync with backend (useEffect won't overwrite because initialNotificationPrefs is set)
        await refreshUser();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to save preferences',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Save notification preferences error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save preferences',
        visibilityTime: 3000,
      });
    } finally {
      setIsSavingNotificationPrefs(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            Toast.show({
              type: 'success',
              text1: 'Logged Out',
              text2: 'You have been logged out successfully',
            });
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'social' && styles.tabActive]}
          onPress={() => setActiveTab('social')}
        >
          <Text style={[styles.tabText, activeTab === 'social' && styles.tabTextActive]}>
            Social
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notifications' && styles.tabActive]}
          onPress={() => setActiveTab('notifications')}
        >
          <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>
            Notifications
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'account' && styles.tabActive]}
          onPress={() => setActiveTab('account')}
        >
          <Text style={[styles.tabText, activeTab === 'account' && styles.tabTextActive]}>
            Account
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          refreshControl={activeTab === 'social' ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
        >
          {activeTab === 'social' && (
            <View style={styles.tabContent}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Connected Accounts</Text>
                <Text style={styles.sectionSubtext}>
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
          )}

          {activeTab === 'notifications' && (
            <View style={styles.tabContent}>
              <View style={styles.section}>
                <View style={styles.notificationHeader}>
                  <View style={styles.notificationHeaderText}>
                    <Text style={styles.sectionTitle}>Notification Preferences</Text>
                    <Text style={styles.sectionSubtext}>
                      Decide where you want alerts for top-ups, transfers, and rewards to appear
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    styles.saveButtonFullWidth,
                    (!notificationPrefsDirty || isSavingNotificationPrefs) && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSaveNotificationPreferences}
                  disabled={!notificationPrefsDirty || isSavingNotificationPrefs}
                >
                  {isSavingNotificationPrefs ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Preferences</Text>
                  )}
                </TouchableOpacity>

                {/* Email Alerts */}
                <View style={styles.notificationSubsection}>
                  <Text style={styles.subsectionTitle}>Email Alerts</Text>
                  <Text style={styles.subsectionDescription}>
                    Keep your inbox in the loop for important wallet activity
                  </Text>
                  <View style={styles.notificationOptions}>
                    {[
                      { key: 'top_up' as const, label: 'Wallet top-ups', description: 'Alert when your wallet balance increases after a top-up' },
                      { key: 'wallet_transfer' as const, label: 'Peer transfers', description: 'Notify when you send or receive coins from another user' },
                      { key: 'reward' as const, label: 'Reward payouts', description: 'Let me know when engagement rewards are delivered' },
                    ].map((option) => (
                      <View key={option.key} style={styles.notificationOption}>
                        <View style={styles.notificationOptionInfo}>
                          <Text style={styles.notificationOptionLabel}>{option.label}</Text>
                          <Text style={styles.notificationOptionDescription}>{option.description}</Text>
                        </View>
                        <Switch
                          value={notificationPreferences.email[option.key]}
                          onValueChange={(value) => handleUpdateNotificationPreference('email', option.key, value)}
                          trackColor={{ false: '#e0e0e0', true: '#FF6B00' }}
                          thumbColor="#fff"
                        />
                      </View>
                    ))}
                  </View>
                </View>

                {/* In-App Notifications */}
                <View style={styles.notificationSubsection}>
                  <Text style={styles.subsectionTitle}>In-App Notifications</Text>
                  <Text style={styles.subsectionDescription}>
                    Show activity updates inside the notifications stream
                  </Text>
                  <View style={styles.notificationOptions}>
                    {[
                      { key: 'top_up' as const, label: 'Wallet top-ups', description: 'Alert when your wallet balance increases after a top-up' },
                      { key: 'wallet_transfer' as const, label: 'Peer transfers', description: 'Notify when you send or receive coins from another user' },
                      { key: 'reward' as const, label: 'Reward payouts', description: 'Let me know when engagement rewards are delivered' },
                    ].map((option) => (
                      <View key={option.key} style={styles.notificationOption}>
                        <View style={styles.notificationOptionInfo}>
                          <Text style={styles.notificationOptionLabel}>{option.label}</Text>
                          <Text style={styles.notificationOptionDescription}>{option.description}</Text>
                        </View>
                        <Switch
                          value={notificationPreferences.in_app[option.key]}
                          onValueChange={(value) => handleUpdateNotificationPreference('in_app', option.key, value)}
                          trackColor={{ false: '#e0e0e0', true: '#FF6B00' }}
                          thumbColor="#fff"
                        />
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'account' && (
            <View style={styles.tabContent}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account</Text>
                
                <View style={styles.accountInfoContainer}>
                  <View style={styles.accountInfoRow}>
                    <Text style={styles.accountInfoLabel}>Email</Text>
                    <Text style={styles.accountInfoValue}>{user?.email || 'Not set'}</Text>
                  </View>
                  <View style={styles.accountInfoRow}>
                    <Text style={styles.accountInfoLabel}>User ID</Text>
                    <Text style={styles.accountInfoValue}>{user?.id || 'N/A'}</Text>
                  </View>
                  <View style={styles.accountInfoRow}>
                    <Text style={styles.accountInfoLabel}>Default Coin</Text>
                    <Text style={styles.accountInfoValue}>{user?.default_coin_symbol || 'FCN'}</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                  <FontAwesome name="sign-out" size={16} color="#fff" />
                  <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B00',
  },
  tabText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  sectionSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: -12,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  inputValid: {
    borderColor: '#25D366',
  },
  inputInvalid: {
    borderColor: '#E91E63',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  statusText: {
    fontSize: 13,
  },
  statusTextValid: {
    color: '#25D366',
  },
  statusTextInvalid: {
    color: '#E91E63',
  },
  linksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addLinkText: {
    fontSize: 13,
    color: '#FF6B00',
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  linkLabelInput: {
    flex: 0.4,
  },
  linkUrlInput: {
    flex: 0.55,
  },
  removeLinkButton: {
    padding: 8,
  },
  saveButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonSmall: {
    padding: 8,
    paddingHorizontal: 16,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  previewSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF6B00',
  },
  copyButtonText: {
    fontSize: 13,
    color: '#FF6B00',
    fontWeight: '600',
  },
  previewCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  previewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  previewAvatarImage: {
    width: '100%',
    height: '100%',
  },
  previewAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B00',
    backgroundColor: '#fff',
  },
  avatarUploadButtonText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
  },
  previewInfo: {
    flex: 1,
  },
  previewNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  previewName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  previewBadge: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  previewBadgeText: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '600',
  },
  previewLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  previewLocation: {
    fontSize: 13,
    color: '#666',
  },
  previewCoin: {
    fontSize: 12,
    color: '#999',
  },
  previewBio: {
    fontSize: 14,
    color: '#333',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    lineHeight: 20,
  },
  previewLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  previewLinkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff3e0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewLinkText: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '600',
  },
  notificationHeader: {
    marginBottom: 20,
  },
  notificationHeaderText: {
    flex: 1,
  },
  saveButtonFullWidth: {
    width: '100%',
    marginTop: 8,
  },
  notificationSubsection: {
    marginBottom: 24,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  subsectionDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  notificationOptions: {
    gap: 12,
  },
  notificationOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  notificationOptionInfo: {
    flex: 1,
    marginRight: 12,
  },
  notificationOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  notificationOptionDescription: {
    fontSize: 12,
    color: '#666',
  },
  accountInfoContainer: {
    marginBottom: 20,
  },
  accountInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  accountInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  accountInfoValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#E91E63',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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

