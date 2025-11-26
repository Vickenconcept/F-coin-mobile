import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  BackHandler,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../lib/apiClient';
import Toast from 'react-native-toast-message';
import { FeedMediaGrid } from './FeedMediaGrid';
import { MentionInput } from './MentionInput';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import axios from 'axios';

type PostComposerProps = {
  visible: boolean;
  onClose: () => void;
  onPostCreated: () => void;
  userId: string;
  defaultCoinSymbol: string;
};

export function PostComposer({ 
  visible, 
  onClose, 
  onPostCreated, 
  userId, 
  defaultCoinSymbol 
}: PostComposerProps) {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [rewardPool, setRewardPool] = useState<number>(0);
  const [rewardLikeAmount, setRewardLikeAmount] = useState<number>(1);
  const [rewardCommentAmount, setRewardCommentAmount] = useState<number>(2);
  const [rewardShareAmount, setRewardShareAmount] = useState<number>(3);
  const [rewardPerUserCap, setRewardPerUserCap] = useState<number>(10);
  const [rewardCoinSymbol, setRewardCoinSymbol] = useState<string>(defaultCoinSymbol.toUpperCase());
  const [walletCoins, setWalletCoins] = useState<Array<{ coin_symbol: string; balance: number }>>([]);
  const [isWalletCoinsLoading, setIsWalletCoinsLoading] = useState(false);
  const [rewardToggleLoading, setRewardToggleLoading] = useState<string | null>(null);
  const [postCreationStep, setPostCreationStep] = useState<1 | 2 | 3>(1);
  const [uploadedMedia, setUploadedMedia] = useState<Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail_url?: string;
    metadata?: Record<string, unknown>;
  }>>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = useCallback(() => {
    setContent('');
    setVisibility('public');
    setRewardEnabled(false);
    setRewardPool(0);
    setRewardLikeAmount(1);
    setRewardCommentAmount(2);
    setRewardShareAmount(3);
    setRewardPerUserCap(10);
    setRewardCoinSymbol(defaultCoinSymbol.toUpperCase());
    setUploadedMedia([]);
    setPostCreationStep(1);
  }, [defaultCoinSymbol]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleMediaPicker = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Permission Required',
        text2: 'Please allow access to your media library',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets) {
      setIsUploading(true);
      
      try {
        // Upload each file individually to track progress
        for (const asset of result.assets.slice(0, 10 - uploadedMedia.length)) {
          await handleUploadMedia(asset);
        }
      } catch (error) {
        console.error('Pick media error:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to pick media',
        });
      } finally {
        setIsUploading(false);
      }
    }
  }, [uploadedMedia.length]);

  // Handle individual media upload
  const handleUploadMedia = useCallback(async (asset: ImagePicker.ImagePickerAsset) => {
    const fileId = `${asset.uri}-${Date.now()}`;
    setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

    try {
      const formData = new FormData();
      const fileUri = asset.uri;
      const filename = fileUri.split('/').pop() || 'file';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // React Native FormData format
      formData.append('file', {
        uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
        type: asset.type === 'video' ? 'video/mp4' : type,
        name: filename,
      } as any);

      // Use axios directly for file upload with progress tracking
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:8000/api';
      const uploadUrl = `${API_BASE_URL}/v1/upload`;
      const token = apiClient.getToken();

      const response = await axios.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: token ? `Bearer ${token}` : '',
        },
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const percentComplete = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress((prev) => ({ ...prev, [fileId]: percentComplete }));
          }
        },
      });

      if (response.data?.data) {
        const mediaWithId = {
          ...response.data.data,
          id: response.data.data.id || `media_${Date.now()}_${Math.random()}`,
        };
        setUploadedMedia((prev) => [...prev, mediaWithId]);
        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      } else {
        throw new Error('Upload response missing data');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: error.response?.data?.errors?.[0]?.detail || 'Failed to upload media',
      });
      setUploadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
    }
  }, []);

  // Fetch wallet coins for reward configuration
  const fetchWalletCoins = useCallback(async () => {
    setIsWalletCoinsLoading(true);
    try {
      const response = await apiClient.request<{
        coin_balances?: Array<{ coin_symbol?: string; balance?: number }>;
      }>('/v1/wallets/me', {
        method: 'GET',
      });

      if (response.ok && response.data?.coin_balances) {
        const coins = response.data.coin_balances
          .filter((c) => c.coin_symbol && (c.balance ?? 0) > 0)
          .map((c) => ({
            coin_symbol: c.coin_symbol!,
            balance: c.balance ?? 0,
          }));
        setWalletCoins(coins);
        if (coins.length > 0 && !coins.find((c) => c.coin_symbol === rewardCoinSymbol)) {
          setRewardCoinSymbol(coins[0].coin_symbol);
        }
      }
    } catch (error) {
      console.error('Fetch wallet coins error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load wallet coins',
      });
    } finally {
      setIsWalletCoinsLoading(false);
    }
  }, [rewardCoinSymbol]);

  // Load wallet coins when modal opens and reward is enabled
  useEffect(() => {
    if (visible && rewardEnabled && walletCoins.length === 0) {
      fetchWalletCoins();
    }
  }, [visible, rewardEnabled, walletCoins.length, fetchWalletCoins]);

  // Handle Android back button
  useEffect(() => {
    if (!visible) return;

    const backAction = () => {
      handleClose();
      return true; // Prevent default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [visible, handleClose]);

  const selectedRewardCoinBalance = walletCoins.find(
    (coin) => coin.coin_symbol === rewardCoinSymbol
  )?.balance ?? 0;

  const handleCreatePost = useCallback(async () => {
    if (!content.trim() && uploadedMedia.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please add some content or media',
      });
      return;
    }

    // Validate reward configuration
    if (rewardEnabled) {
      if (!rewardCoinSymbol || walletCoins.length === 0) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Select a reward coin',
        });
        return;
      }

      if (rewardPool <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Pool amount must be greater than 0',
        });
        return;
      }

      if (rewardPool > selectedRewardCoinBalance) {
        Toast.show({
          type: 'error',
          text1: 'Insufficient Balance',
          text2: `You only have ${selectedRewardCoinBalance} ${rewardCoinSymbol} available.`,
          visibilityTime: 4000,
        });
        return;
      }
    }

    setIsCreating(true);
    try {
      const postData = {
        content: content.trim() || null,
        visibility,
        media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
        reward_enabled: rewardEnabled,
        ...(rewardEnabled && {
          reward_pool: rewardPool,
          reward_coin_symbol: rewardCoinSymbol,
          reward_rule: {
            per_type: {
              like: rewardLikeAmount,
              comment: rewardCommentAmount,
              share: rewardShareAmount,
            },
            per_user_cap: rewardPerUserCap,
          },
        }),
      };

      const response = await apiClient.request('/v1/feed/posts', {
        method: 'POST',
        data: postData,
      });

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Post created successfully',
        });
        handleClose();
        onPostCreated();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to create post',
        });
      }
    } catch (error) {
      console.error('Create post error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create post',
      });
    } finally {
      setIsCreating(false);
    }
  }, [content, visibility, uploadedMedia, rewardEnabled, rewardPool, rewardCoinSymbol, rewardLikeAmount, rewardCommentAmount, rewardShareAmount, rewardPerUserCap, handleClose, onPostCreated]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Create Post</Text>
          <TouchableOpacity 
            onPress={handleCreatePost}
            disabled={isCreating}
            style={[styles.postButton, isCreating && styles.postButtonDisabled]}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Step 1: Content */}
          {postCreationStep === 1 && (
            <>
              <MentionInput
                value={content}
                onChangeText={setContent}
                placeholder="What's on your mind?"
                multiline
                style={styles.textInput}
              />

              {uploadedMedia.length > 0 && (
                <FeedMediaGrid 
                  media={uploadedMedia}
              onRemove={(index: number) => {
                setUploadedMedia(prev => prev.filter((_, i) => i !== index));
              }}
                />
              )}

              {/* Upload Progress */}
              {Object.keys(uploadProgress).length > 0 && (
                <View style={styles.uploadProgressContainer}>
                  {Object.entries(uploadProgress).map(([uploadId, progress]) => (
                    <View key={uploadId} style={styles.progressItem}>
                      <Text style={styles.progressText}>Uploading... {progress}%</Text>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity 
                  onPress={handleMediaPicker} 
                  style={styles.actionButton}
                  disabled={isUploading}
                >
                  <FontAwesome name="camera" size={20} color={isUploading ? "#ccc" : "#666"} />
                  <Text style={[styles.actionText, isUploading && styles.disabledText]}>
                    {isUploading ? 'Uploading...' : 'Add Media'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setPostCreationStep(2)} 
                  style={styles.actionButton}
                >
                  <FontAwesome name="cog" size={20} color="#666" />
                  <Text style={styles.actionText}>Settings</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Step 2: Settings */}
          {postCreationStep === 2 && (
            <>
              <View style={styles.settingsSection}>
                <Text style={styles.sectionTitle}>Post Settings</Text>
                
                {/* Visibility */}
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Visibility</Text>
                  <View style={styles.visibilityOptions}>
                    {(['public', 'followers', 'private'] as const).map((vis) => (
                      <TouchableOpacity
                        key={vis}
                        style={[
                          styles.visibilityOption,
                          visibility === vis && styles.visibilityOptionActive
                        ]}
                        onPress={() => setVisibility(vis)}
                      >
                        <FontAwesome 
                          name={vis === 'public' ? 'globe' : vis === 'followers' ? 'users' : 'lock'} 
                          size={16} 
                          color={visibility === vis ? '#fff' : '#666'} 
                        />
                        <Text style={[
                          styles.visibilityOptionText,
                          visibility === vis && styles.visibilityOptionTextActive
                        ]}>
                          {vis.charAt(0).toUpperCase() + vis.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Rewards */}
                <View style={styles.settingItem}>
                  <View style={styles.settingHeader}>
                    <Text style={styles.settingLabel}>Enable Rewards</Text>
                    <Switch
                      value={rewardEnabled}
                      onValueChange={setRewardEnabled}
                      trackColor={{ false: '#ccc', true: '#FF6B00' }}
                      thumbColor={rewardEnabled ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                  {rewardEnabled && (
                    <View style={styles.rewardSettings}>
                      <View style={styles.rewardInput}>
                        <Text style={styles.rewardLabel}>Pool Amount</Text>
                        <TextInput
                          style={[
                            styles.rewardTextInput,
                            rewardPool > selectedRewardCoinBalance && rewardPool > 0 && styles.rewardTextInputError
                          ]}
                          value={rewardPool.toString()}
                          onChangeText={(text) => {
                            const amount = parseFloat(text) || 0;
                            setRewardPool(amount);
                            
                            // Show validation toast if amount exceeds balance
                            if (amount > selectedRewardCoinBalance && amount > 0) {
                              Toast.show({
                                type: 'error',
                                text1: 'Insufficient Balance',
                                text2: `You only have ${selectedRewardCoinBalance.toLocaleString()} ${rewardCoinSymbol} available.`,
                                visibilityTime: 3000,
                              });
                            }
                          }}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                        {rewardPool > selectedRewardCoinBalance && rewardPool > 0 && (
                          <Text style={styles.errorText}>
                            Exceeds available balance ({selectedRewardCoinBalance.toLocaleString()} {rewardCoinSymbol})
                          </Text>
                        )}
                      </View>
                      <View style={styles.rewardInput}>
                        <Text style={styles.rewardLabel}>Reward Coin</Text>
                        {walletCoins.length === 0 && !isWalletCoinsLoading ? (
                          <View style={styles.warningBox}>
                            <FontAwesome name="exclamation-triangle" size={16} color="#ff9800" />
                            <Text style={styles.warningText}>
                              You need to launch a creator coin and have balance before you can enable rewards.
                            </Text>
                            <TouchableOpacity
                              style={styles.retryButton}
                              onPress={fetchWalletCoins}
                            >
                              <Text style={styles.retryButtonText}>Retry</Text>
                            </TouchableOpacity>
                          </View>
                        ) : isWalletCoinsLoading ? (
                          <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#FF6B00" />
                            <Text style={styles.coinsLoadingText}>Loading coins...</Text>
                          </View>
                        ) : walletCoins.length > 0 ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coinSelector}>
                            {walletCoins.map((coin) => (
                              <TouchableOpacity
                                key={coin.coin_symbol}
                                style={[
                                  styles.coinOption,
                                  rewardCoinSymbol === coin.coin_symbol && styles.coinOptionActive,
                                ]}
                                onPress={() => setRewardCoinSymbol(coin.coin_symbol)}
                              >
                                <Text style={[
                                  styles.coinOptionSymbol,
                                  rewardCoinSymbol === coin.coin_symbol && styles.coinOptionSymbolActive,
                                ]}>
                                  {coin.coin_symbol}
                                </Text>
                                <Text style={[
                                  styles.coinOptionBalance,
                                  rewardCoinSymbol === coin.coin_symbol && styles.coinOptionBalanceActive,
                                ]}>
                                  {coin.balance.toLocaleString()}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        ) : null}
                      </View>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.stepActions}>
                <TouchableOpacity 
                  onPress={() => setPostCreationStep(1)} 
                  style={styles.backButton}
                >
                  <FontAwesome name="arrow-left" size={16} color="#666" />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cancelButton: {
    color: '#666',
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  postButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  postButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  textInput: {
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  actionText: {
    color: '#666',
    fontSize: 14,
  },
  disabledText: {
    color: '#ccc',
  },
  uploadProgressContainer: {
    marginVertical: 16,
  },
  progressItem: {
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B00',
    borderRadius: 2,
  },
  settingsSection: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  settingItem: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 12,
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  visibilityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    gap: 6,
  },
  visibilityOptionActive: {
    backgroundColor: '#FF6B00',
  },
  visibilityOptionText: {
    fontSize: 14,
    color: '#666',
  },
  visibilityOptionTextActive: {
    color: '#fff',
  },
  rewardSettings: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    gap: 16,
  },
  rewardInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rewardLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  rewardTextInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
    minWidth: 100,
  },
  stepActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  coinsLoadingText: {
    fontSize: 14,
    color: '#666',
  },
  coinSelector: {
    maxHeight: 80,
  },
  coinOption: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  coinOptionActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  coinOptionSymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  coinOptionSymbolActive: {
    color: '#fff',
  },
  coinOptionBalance: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  coinOptionBalanceActive: {
    color: '#fff',
  },
  rewardTextInputError: {
    borderColor: '#ff4757',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#ff4757',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
