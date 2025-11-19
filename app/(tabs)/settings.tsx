import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import Toast from 'react-native-toast-message';
import FontAwesome from '@expo/vector-icons/FontAwesome';
// @ts-ignore - expo-clipboard types
import * as Clipboard from 'expo-clipboard';

type EditableProfileLink = {
  id: string;
  label: string;
  url: string;
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

const generateLinkId = () => Math.random().toString(36).slice(2, 11);

const toEditableLinks = (links?: Array<{ label?: string; url?: string }>): EditableProfileLink[] =>
  (links ?? []).map((link, index) => ({
    id: `${link.label ?? 'link'}-${index}-${generateLinkId()}`,
    label: link.label ?? '',
    url: link.url ?? '',
  }));

export default function SettingsScreen() {
  const { user, refreshUser, logout } = useAuth();
  const router = useRouter();
  
  // Profile state
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [profileBio, setProfileBio] = useState((user as any)?.profile_bio ?? '');
  const [profileLocation, setProfileLocation] = useState((user as any)?.profile_location ?? '');
  const [profileLinks, setProfileLinks] = useState<EditableProfileLink[]>(toEditableLinks((user as any)?.profile_links));
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'self' | 'unavailable' | 'error'>('idle');
  const [usernameStatusMessage, setUsernameStatusMessage] = useState<string>('');
  const usernameCheckTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'social' | 'account'>('profile');

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name ?? '');
      setUsername(user.username ?? '');
      setAvatarUrl(user.avatar_url ?? '');
      setProfileBio((user as any)?.profile_bio ?? '');
      setProfileLocation((user as any)?.profile_location ?? '');
      setProfileLinks(toEditableLinks((user as any)?.profile_links));
      setUsernameStatus('idle');
      setUsernameStatusMessage('');
    }
  }, [user?.display_name, user?.username, user?.avatar_url, (user as any)?.profile_bio, (user as any)?.profile_location, (user as any)?.profile_links]);

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

  // Username validation
  useEffect(() => {
    const trimmed = username.trim();
    const originalUsername = user?.username ?? '';

    if (!trimmed) {
      setUsernameStatus('unavailable');
      setUsernameStatusMessage('Username is required.');
      return;
    }

    if (trimmed === originalUsername) {
      setUsernameStatus('idle');
      setUsernameStatusMessage('');
      return;
    }

    setUsernameStatus('checking');
    setUsernameStatusMessage('');

    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }

    usernameCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await apiClient.get<{ id: string; username: string }>(
          `/v1/users/lookup?username=${encodeURIComponent(trimmed)}`
        );

        if (username.trim() !== trimmed) {
          return;
        }

        if (response.ok && response.data) {
          if (String(response.data.id) === String(user?.id)) {
            setUsernameStatus('self');
            setUsernameStatusMessage('This is already your username.');
          } else {
            setUsernameStatus('unavailable');
            setUsernameStatusMessage('That username is already taken.');
          }
        } else if (response.status === 404) {
          setUsernameStatus('available');
          setUsernameStatusMessage('Great — that username is available.');
        } else {
          setUsernameStatus('error');
          setUsernameStatusMessage(response.errors?.[0]?.detail || 'Unable to verify username.');
        }
      } catch (error) {
        console.error('Username lookup error:', error);
        if (username.trim() !== trimmed) {
          return;
        }
        setUsernameStatus('error');
        setUsernameStatusMessage('Unable to verify username right now.');
      }
    }, 400);

    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
      }
    };
  }, [username, user?.id, user?.username]);

  const hasProfileChanges = useCallback(() => {
    const originalDisplayName = user?.display_name ?? '';
    const originalUsername = user?.username ?? '';
    const originalAvatarUrl = user?.avatar_url ?? '';
    const originalBio = (user as any)?.profile_bio ?? '';
    const originalLocation = (user as any)?.profile_location ?? '';
    const originalLinks = (user as any)?.profile_links ?? [];

    const trimmedDisplayName = displayName.trim();
    const trimmedUsername = username.trim();
    const trimmedAvatarUrl = avatarUrl.trim();
    const trimmedBio = profileBio.trim();
    const trimmedLocation = profileLocation.trim();
    const sanitizedLinks = profileLinks
      .map((link) => ({
        label: link.label.trim(),
        url: link.url.trim(),
      }))
      .filter((link) => link.label && link.url);

    return (
      trimmedDisplayName !== originalDisplayName ||
      trimmedUsername !== originalUsername ||
      trimmedAvatarUrl !== originalAvatarUrl ||
      trimmedBio !== originalBio ||
      trimmedLocation !== originalLocation ||
      JSON.stringify(sanitizedLinks) !== JSON.stringify(originalLinks)
    );
  }, [user, displayName, username, avatarUrl, profileBio, profileLocation, profileLinks]);

  const handleSaveProfile = async () => {
    if (!hasProfileChanges()) {
      Toast.show({
        type: 'info',
        text1: 'No Changes',
        text2: 'Nothing to update',
        visibilityTime: 2000,
      });
      return;
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Username is required',
        visibilityTime: 3000,
      });
      return;
    }

    if (
      trimmedUsername !== (user?.username ?? '') &&
      (usernameStatus === 'checking' || usernameStatus === 'unavailable' || usernameStatus === 'error')
    ) {
      const message =
        usernameStatus === 'checking'
          ? 'Please wait while we verify your username.'
          : usernameStatusMessage || 'Choose a different username and try again.';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: message,
        visibilityTime: 3000,
      });
      return;
    }

    setIsSavingProfile(true);

    try {
      const payload: Record<string, string | null | undefined | Array<{ label: string; url: string }>> = {};

      const trimmedDisplayName = displayName.trim();
      const trimmedAvatarUrl = avatarUrl.trim();
      const trimmedBio = profileBio.trim();
      const trimmedLocation = profileLocation.trim();
      const sanitizedLinks = profileLinks
        .map((link) => ({
          label: link.label.trim(),
          url: link.url.trim(),
        }))
        .filter((link) => link.label && link.url);

      if (trimmedDisplayName !== (user?.display_name ?? '')) {
        payload.display_name = trimmedDisplayName || null;
      }

      if (trimmedUsername !== (user?.username ?? '')) {
        payload.username = trimmedUsername;
      }

      if (trimmedAvatarUrl !== (user?.avatar_url ?? '')) {
        payload.avatar_url = trimmedAvatarUrl || null;
      }

      if (trimmedBio !== ((user as any)?.profile_bio ?? '')) {
        payload.profile_bio = trimmedBio || null;
      }

      if (trimmedLocation !== ((user as any)?.profile_location ?? '')) {
        payload.profile_location = trimmedLocation || null;
      }

      if (JSON.stringify(sanitizedLinks) !== JSON.stringify((user as any)?.profile_links ?? [])) {
        payload.profile_links = sanitizedLinks;
      }

      const response = await apiClient.patch('/v1/profile', payload);

      if (!response.ok) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Unable to update profile',
          visibilityTime: 3000,
        });
        return;
      }

      await refreshUser();
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Profile updated successfully',
        visibilityTime: 2000,
      });
      setUsernameStatus('idle');
      setUsernameStatusMessage('');
    } catch (error) {
      console.error('Update profile error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update profile',
        visibilityTime: 3000,
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAddLink = () => {
    if (profileLinks.length >= 5) return;
    setProfileLinks((prev) => [...prev, { id: generateLinkId(), label: '', url: '' }]);
  };

  const handleLinkChange = (id: string, field: 'label' | 'url', value: string) => {
    setProfileLinks((prev) =>
      prev.map((link) => (link.id === id ? { ...link, [field]: value } : link))
    );
  };

  const handleRemoveLink = (id: string) => {
    setProfileLinks((prev) => prev.filter((link) => link.id !== id));
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

  const handleCopyProfileLink = async () => {
    const profileUrl = user?.username ? `https://fcoin.app/${user.username}` : '';
    if (!profileUrl) return;
    
    await Clipboard.setStringAsync(profileUrl);
    Toast.show({
      type: 'success',
      text1: 'Copied',
      text2: 'Profile link copied to clipboard',
      visibilityTime: 2000,
    });
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

  const profilePublicUrl = user?.username ? `/${user.username}` : '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
            Profile
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
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {activeTab === 'profile' && (
            <View style={styles.tabContent}>
              {/* Profile Information */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Profile Information</Text>
                
                {/* Profile Image Upload */}
                <View style={styles.avatarSection}>
                  <View style={styles.avatarContainer}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarPlaceholderText}>
                          {(displayName || username || 'FC').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {isUploadingAvatar && (
                      <View style={styles.avatarOverlay}>
                        <ActivityIndicator size="small" color="#fff" />
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.avatarUploadButton}
                    onPress={async () => {
                      try {
                        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (!permissionResult.granted) {
                          Toast.show({
                            type: 'error',
                            text1: 'Permission Required',
                            text2: 'Please allow access to your media library',
                            visibilityTime: 3000,
                          });
                          return;
                        }

                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Images,
                          allowsEditing: true,
                          aspect: [1, 1],
                          quality: 0.8,
                        });

                        if (!result.canceled && result.assets[0]) {
                          const file = result.assets[0];
                          if (file.fileSize && file.fileSize > 5 * 1024 * 1024) {
                            Toast.show({
                              type: 'error',
                              text1: 'File Too Large',
                              text2: 'Image size must be less than 5MB',
                              visibilityTime: 3000,
                            });
                            return;
                          }

                          setIsUploadingAvatar(true);
                          try {
                            const formData = new FormData();
                            formData.append('file', {
                              uri: file.uri,
                              type: 'image/jpeg',
                              name: 'avatar.jpg',
                            } as any);

                            const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/api\/?$/, '') || 'http://localhost:8000';
                            const token = apiClient.getToken();
                            const response = await fetch(`${API_BASE_URL}/api/v1/upload`, {
                              method: 'POST',
                              headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'multipart/form-data',
                              },
                              body: formData,
                            });

                            const data = await response.json();
                            if (response.ok && data.data?.url) {
                              setAvatarUrl(data.data.url);
                              // Immediately save the avatar_url to the profile
                              try {
                                const saveResponse = await apiClient.patch('/v1/profile', {
                                  avatar_url: data.data.url,
                                });
                                if (saveResponse.ok) {
                                  await refreshUser();
                                  Toast.show({
                                    type: 'success',
                                    text1: 'Success',
                                    text2: 'Profile image uploaded and saved successfully',
                                    visibilityTime: 2000,
                                  });
                                } else {
                                  Toast.show({
                                    type: 'error',
                                    text1: 'Warning',
                                    text2: 'Image uploaded but failed to save. Please try saving again.',
                                    visibilityTime: 3000,
                                  });
                                }
                              } catch (saveError) {
                                console.error('Save avatar error:', saveError);
                                Toast.show({
                                  type: 'error',
                                  text1: 'Warning',
                                  text2: 'Image uploaded but failed to save. Please try saving again.',
                                  visibilityTime: 3000,
                                });
                              }
                            } else {
                              Toast.show({
                                type: 'error',
                                text1: 'Error',
                                text2: data.errors?.[0]?.detail || 'Failed to upload image',
                                visibilityTime: 3000,
                              });
                            }
                          } catch (error) {
                            console.error('Avatar upload error:', error);
                            Toast.show({
                              type: 'error',
                              text1: 'Error',
                              text2: 'Failed to upload image',
                              visibilityTime: 3000,
                            });
                          } finally {
                            setIsUploadingAvatar(false);
                          }
                        }
                      } catch (error) {
                        console.error('Image picker error:', error);
                        Toast.show({
                          type: 'error',
                          text1: 'Error',
                          text2: 'Failed to select image',
                          visibilityTime: 3000,
                        });
                      }
                    }}
                    disabled={isUploadingAvatar}
                  >
                    <FontAwesome name="camera" size={16} color="#FF6B00" />
                    <Text style={styles.avatarUploadButtonText}>
                      {isUploadingAvatar ? 'Uploading...' : 'Change Photo'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Display Name</Text>
                  <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Display name"
                    placeholderTextColor="#999"
                    maxLength={120}
                    editable={!isSavingProfile}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Username</Text>
                  <TextInput
                    style={[
                      styles.input,
                      usernameStatus === 'available' && styles.inputValid,
                      (usernameStatus === 'unavailable' || usernameStatus === 'error') && styles.inputInvalid,
                    ]}
                    value={username}
                    onChangeText={(text) => {
                      // Only allow alphanumeric, underscore, and period
                      const cleaned = text.replace(/[^a-zA-Z0-9_.]/g, '');
                      setUsername(cleaned);
                    }}
                    placeholder="username"
                    placeholderTextColor="#999"
                    maxLength={50}
                    autoCapitalize="none"
                    editable={!isSavingProfile}
                  />
                  {usernameStatus === 'checking' && (
                    <View style={styles.statusRow}>
                      <ActivityIndicator size="small" color="#FF6B00" />
                      <Text style={styles.statusText}>Checking availability...</Text>
                    </View>
                  )}
                  {usernameStatus === 'available' && (
                    <View style={styles.statusRow}>
                      <FontAwesome name="check-circle" size={14} color="#25D366" />
                      <Text style={[styles.statusText, styles.statusTextValid]}>
                        {usernameStatusMessage}
                      </Text>
                    </View>
                  )}
                  {(usernameStatus === 'unavailable' || usernameStatus === 'error') && (
                    <View style={styles.statusRow}>
                      <FontAwesome name="times-circle" size={14} color="#E91E63" />
                      <Text style={[styles.statusText, styles.statusTextInvalid]}>
                        {usernameStatusMessage}
                      </Text>
                    </View>
                  )}
                  {usernameStatus === 'idle' && (
                    <Text style={styles.hintText}>Choose a unique username for your profile</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Bio</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={profileBio}
                    onChangeText={setProfileBio}
                    placeholder="Tell fans about your community..."
                    placeholderTextColor="#999"
                    maxLength={1000}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    editable={!isSavingProfile}
                  />
                  <Text style={styles.charCount}>{profileBio.length}/1000</Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Location</Text>
                  <TextInput
                    style={styles.input}
                    value={profileLocation}
                    onChangeText={setProfileLocation}
                    placeholder="City, Country"
                    placeholderTextColor="#999"
                    maxLength={120}
                    editable={!isSavingProfile}
                  />
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.linksHeader}>
                    <Text style={styles.label}>Links</Text>
                    {profileLinks.length < 5 && (
                      <TouchableOpacity
                        style={styles.addLinkButton}
                        onPress={handleAddLink}
                        disabled={isSavingProfile}
                      >
                        <FontAwesome name="plus" size={14} color="#FF6B00" />
                        <Text style={styles.addLinkText}>Add link</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {profileLinks.length === 0 && (
                    <Text style={styles.hintText}>Share your website or top socials</Text>
                  )}
                  {profileLinks.map((link) => (
                    <View key={link.id} style={styles.linkRow}>
                      <TextInput
                        style={[styles.input, styles.linkLabelInput]}
                        value={link.label}
                        onChangeText={(value) => handleLinkChange(link.id, 'label', value)}
                        placeholder="Label (e.g., Website)"
                        placeholderTextColor="#999"
                        maxLength={40}
                        editable={!isSavingProfile}
                      />
                      <TextInput
                        style={[styles.input, styles.linkUrlInput]}
                        value={link.url}
                        onChangeText={(value) => handleLinkChange(link.id, 'url', value)}
                        placeholder="https://example.com"
                        placeholderTextColor="#999"
                        maxLength={255}
                        autoCapitalize="none"
                        keyboardType="url"
                        editable={!isSavingProfile}
                      />
                      <TouchableOpacity
                        style={styles.removeLinkButton}
                        onPress={() => handleRemoveLink(link.id)}
                        disabled={isSavingProfile}
                      >
                        <FontAwesome name="times" size={16} color="#999" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    (!hasProfileChanges() || isSavingProfile ||
                      !username.trim() ||
                      (username.trim() !== (user?.username ?? '') &&
                        (usernameStatus === 'checking' || usernameStatus === 'unavailable' || usernameStatus === 'error'))) &&
                      styles.saveButtonDisabled,
                  ]}
                  onPress={handleSaveProfile}
                  disabled={
                    !hasProfileChanges() ||
                    isSavingProfile ||
                    !username.trim() ||
                    (username.trim() !== (user?.username ?? '') &&
                      (usernameStatus === 'checking' || usernameStatus === 'unavailable' || usernameStatus === 'error'))
                  }
                >
                  {isSavingProfile ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Profile Preview */}
              <View style={styles.section}>
                <View style={styles.previewHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Public Profile Preview</Text>
                    <Text style={styles.previewSubtext}>
                      Fans see this at {profilePublicUrl || 'your profile link'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.copyButton} onPress={handleCopyProfileLink}>
                    <FontAwesome name="copy" size={14} color="#FF6B00" />
                    <Text style={styles.copyButtonText}>Copy link</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.previewCard}>
                  <View style={styles.previewAvatar}>
                    {(avatarUrl || user?.avatar_url) ? (
                      <Image source={{ uri: avatarUrl || user?.avatar_url || '' }} style={styles.previewAvatarImage} />
                    ) : (
                      <Text style={styles.previewAvatarText}>
                        {(displayName || username || 'FC').slice(0, 2).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.previewInfo}>
                    <View style={styles.previewNameRow}>
                      <Text style={styles.previewName}>
                        {displayName || user?.display_name || username || user?.username}
                      </Text>
                      <View style={styles.previewBadge}>
                        <Text style={styles.previewBadgeText}>@{username || user?.username}</Text>
                      </View>
                    </View>
                    {profileLocation && (
                      <View style={styles.previewLocationRow}>
                        <FontAwesome name="map-marker" size={12} color="#666" />
                        <Text style={styles.previewLocation}>{profileLocation}</Text>
                      </View>
                    )}
                    <Text style={styles.previewCoin}>
                      Default coin: {user?.default_coin_symbol || 'FCN'}
                    </Text>
                  </View>
                </View>
                {profileBio && (
                  <Text style={styles.previewBio}>{profileBio}</Text>
                )}
                {profileLinks.filter((l) => l.label && l.url).length > 0 && (
                  <View style={styles.previewLinks}>
                    {profileLinks
                      .filter((l) => l.label && l.url)
                      .map((link, index) => (
                        <View key={index} style={styles.previewLinkBadge}>
                          <FontAwesome name="link" size={10} color="#FF6B00" />
                          <Text style={styles.previewLinkText}>{link.label}</Text>
                        </View>
                      ))}
                  </View>
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
                
                <View style={styles.accountInfo}>
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
  accountInfo: {
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
});

