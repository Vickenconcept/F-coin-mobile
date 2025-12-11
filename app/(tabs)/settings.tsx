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
  Image,
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
  const [activeTab, setActiveTab] = useState<'notifications' | 'messaging' | 'account'>('notifications');

  // Messaging settings state
  const [messagingSettings, setMessagingSettings] = useState<Record<string, string>>({});
  const [isLoadingMessagingSettings, setIsLoadingMessagingSettings] = useState(false);
  const [isSavingMessagingSettings, setIsSavingMessagingSettings] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Array<{
    id: string;
    user: {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
    };
    blocked_at: string;
  }>>([]);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false);

  useEffect(() => {
    if (activeTab === 'messaging') {
      loadMessagingSettings();
      loadBlockedUsers();
    }
  }, [activeTab]);

  const loadMessagingSettings = useCallback(async () => {
    setIsLoadingMessagingSettings(true);
    try {
      const response = await apiClient.get<Record<string, string>>('/v1/settings');
      if (response.ok && response.data) {
        setMessagingSettings(response.data);
      }
    } catch (error) {
      console.error('Load messaging settings error:', error);
    } finally {
      setIsLoadingMessagingSettings(false);
    }
  }, []);

  const loadBlockedUsers = useCallback(async () => {
    setIsLoadingBlocks(true);
    try {
      const response = await apiClient.get<{
        data: Array<{
          id: string;
          user: {
            id: string;
            username: string;
            display_name: string;
            avatar_url: string | null;
          };
          blocked_at: string;
        }>;
      }>('/v1/blocks');
      if (response.ok && response.data) {
        setBlockedUsers(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error('Load blocked users error:', error);
    } finally {
      setIsLoadingBlocks(false);
    }
  }, []);

  const updateMessagingSetting = useCallback(async (key: string, value: string) => {
    setIsSavingMessagingSettings(true);
    try {
      const response = await apiClient.request(`/v1/settings/${key}`, {
        method: 'PUT',
        data: { value },
      });

      if (response.ok) {
        setMessagingSettings((prev) => ({ ...prev, [key]: value }));
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Setting updated',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail ?? 'Failed to update setting',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update setting',
      });
    } finally {
      setIsSavingMessagingSettings(false);
    }
  }, []);

  const handleUnblock = useCallback(async (userId: string) => {
    try {
      const response = await apiClient.delete(`/v1/blocks/${userId}`);
      if (response.ok) {
        setBlockedUsers((prev) => prev.filter((block) => block.user.id !== userId));
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'User unblocked',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail ?? 'Failed to unblock user',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to unblock user',
      });
    }
  }, []);

  const getSettingValue = (key: string, defaultValue = '0') => {
    return messagingSettings[key] || defaultValue;
  };

  const isSettingEnabled = (key: string) => {
    const value = getSettingValue(key);
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  };

  const toggleSetting = (key: string) => {
    const newValue = isSettingEnabled(key) ? '0' : '1';
    updateMessagingSetting(key, newValue);
  };


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
          style={[styles.tab, activeTab === 'notifications' && styles.tabActive]}
          onPress={() => setActiveTab('notifications')}
        >
          <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>
            Notifications
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'messaging' && styles.tabActive]}
          onPress={() => setActiveTab('messaging')}
        >
          <Text style={[styles.tabText, activeTab === 'messaging' && styles.tabTextActive]}>
            Messaging
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
        >
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

          {activeTab === 'messaging' && (
            <View style={styles.tabContent}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Messaging Preferences</Text>
                <Text style={styles.sectionSubtext}>
                  Control who can message you and manage your messaging settings
                </Text>

                {isLoadingMessagingSettings ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF6B00" />
                  </View>
                ) : (
                  <>
                    <View style={styles.settingOption}>
                      <View style={styles.settingOptionInfo}>
                        <Text style={styles.settingOptionLabel}>Disable Messaging</Text>
                        <Text style={styles.settingOptionDescription}>
                          When enabled, other users cannot send you messages. They will be notified that your account has messaging disabled.
                        </Text>
                      </View>
                      <Switch
                        value={isSettingEnabled('disable_messaging')}
                        onValueChange={() => toggleSetting('disable_messaging')}
                        disabled={isSavingMessagingSettings}
                        trackColor={{ false: '#e0e0e0', true: '#FF6B00' }}
                        thumbColor="#fff"
                      />
                    </View>

                    <View style={styles.settingOption}>
                      <View style={styles.settingOptionInfo}>
                        <Text style={styles.settingOptionLabel}>Messages from Followers Only</Text>
                        <Text style={styles.settingOptionDescription}>
                          Only allow messages from users who follow you. Others will need to follow you first.
                        </Text>
                      </View>
                      <Switch
                        value={isSettingEnabled('allow_messages_from_followers_only')}
                        onValueChange={() => toggleSetting('allow_messages_from_followers_only')}
                        disabled={isSavingMessagingSettings || isSettingEnabled('disable_messaging')}
                        trackColor={{ false: '#e0e0e0', true: '#FF6B00' }}
                        thumbColor="#fff"
                      />
                    </View>

                    {isSettingEnabled('disable_messaging') && (
                      <View style={styles.infoBox}>
                        <FontAwesome name="info-circle" size={16} color="#666" />
                        <Text style={styles.infoBoxText}>
                          Messaging is disabled. Other users will see a message that your account has blocked messaging when they try to contact you.
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Blocked Users</Text>
                <Text style={styles.sectionSubtext}>
                  Users you've blocked cannot see your posts, send you messages, or view your profile.
                </Text>

                {isLoadingBlocks ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF6B00" />
                  </View>
                ) : blockedUsers.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <FontAwesome name="ban" size={48} color="#999" />
                    <Text style={styles.emptyText}>No blocked users</Text>
                  </View>
                ) : (
                  <View style={styles.blockedUsersList}>
                    {blockedUsers.map((block) => (
                      <View key={block.id} style={styles.blockedUserItem}>
                        <View style={styles.blockedUserInfo}>
                          {block.user.avatar_url ? (
                            <Image
                              source={{ uri: block.user.avatar_url }}
                              style={styles.blockedUserAvatar}
                            />
                          ) : (
                            <View style={[styles.blockedUserAvatar, styles.avatarPlaceholder]}>
                              <Text style={styles.avatarText}>
                                {(block.user.display_name || block.user.username).slice(0, 2).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View>
                            <Text style={styles.blockedUserName}>
                              {block.user.display_name || block.user.username}
                            </Text>
                            <Text style={styles.blockedUserUsername}>@{block.user.username}</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.unblockButton}
                          onPress={() => handleUnblock(block.user.id)}
                        >
                          <Text style={styles.unblockButtonText}>Unblock</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
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
  settingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingOptionInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  settingOptionDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  blockedUsersList: {
    marginTop: 12,
  },
  blockedUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  blockedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  blockedUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  blockedUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  blockedUserUsername: {
    fontSize: 13,
    color: '#666',
  },
  unblockButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF6B00',
    backgroundColor: '#fff',
  },
  unblockButtonText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});

