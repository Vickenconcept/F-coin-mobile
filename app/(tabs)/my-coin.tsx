import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { apiClient } from '../../lib/apiClient';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
// @ts-ignore - expo-linear-gradient types
import { LinearGradient } from 'expo-linear-gradient';

type CreatorCoin = {
  id: string;
  symbol: string;
  name: string | null;
  description: string | null;
  balance: number;
  created_at?: string | null;
  value_usd?: number;
  value_updated_at?: string | null;
};

type RewardRules = {
  base_amount: number;
  per_type: {
    like: number;
    comment: number;
    share: number;
    watch: number;
    [key: string]: number;
  };
};

type WalletData = {
  balance: number;
  primary_coin: string;
  currency?: string;
  primary_coin_value_usd: number;
  conversion_rate?: number;
};

export default function MyCoinScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [coins, setCoins] = useState<CreatorCoin[]>([]);
  const [isCoinsLoading, setIsCoinsLoading] = useState(false);
  const [rewardRules, setRewardRules] = useState<RewardRules>({
    base_amount: 0,
    per_type: {
      like: 5,
      comment: 15,
      share: 25,
      watch: 10,
    },
  });
  const [localRules, setLocalRules] = useState<RewardRules>(rewardRules);
  const [isRewardRulesLoading, setIsRewardRulesLoading] = useState(false);
  const [isRewardRulesSaving, setIsRewardRulesSaving] = useState(false);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isTopUpModalVisible, setIsTopUpModalVisible] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<CreatorCoin | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [isLaunchCoinModalVisible, setIsLaunchCoinModalVisible] = useState(false);
  const [newCoinSymbol, setNewCoinSymbol] = useState('');
  const [isCreatingCoin, setIsCreatingCoin] = useState(false);

  const loadCoins = useCallback(async () => {
    setIsCoinsLoading(true);
    try {
      const response = await apiClient.get<{ coins: CreatorCoin[] }>('/v1/coins');
      if (response.ok && response.data?.coins) {
        setCoins(response.data.coins);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to load coins',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Load coins error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load coins',
        visibilityTime: 3000,
      });
    } finally {
      setIsCoinsLoading(false);
    }
  }, []);

  const loadRewardRules = useCallback(async () => {
    setIsRewardRulesLoading(true);
    try {
      const response = await apiClient.get<{ rules: RewardRules }>('/v1/reward-rules');
      if (response.ok && response.data?.rules) {
        const loadedRules = {
          base_amount: response.data.rules.base_amount || 0,
          per_type: {
            like: response.data.rules.per_type?.like || 5,
            comment: response.data.rules.per_type?.comment || 15,
            share: response.data.rules.per_type?.share || 25,
            watch: response.data.rules.per_type?.watch || 10,
          },
        };
        setRewardRules(loadedRules);
        setLocalRules(loadedRules);
      }
    } catch (error) {
      console.error('Load reward rules error:', error);
    } finally {
      setIsRewardRulesLoading(false);
    }
  }, []);

  const loadWallet = useCallback(async () => {
    try {
      const response = await apiClient.get<WalletData>('/v1/wallets/me');
      if (response.ok && response.data) {
        setWallet(response.data);
      }
    } catch (error) {
      console.error('Load wallet error:', error);
    }
  }, []);

  const loadFollowerCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await apiClient.get<any[]>(`/v1/users/${user.id}/followers`);
      const count = Array.isArray(response.data)
        ? response.data.length
        : (response as any)?.meta?.pagination?.total || 0;
      setFollowerCount(count);
    } catch (error) {
      console.error('Load follower count error:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCoins();
    loadRewardRules();
    loadWallet();
    loadFollowerCount();
  }, [loadCoins, loadRewardRules, loadWallet, loadFollowerCount]);

  useEffect(() => {
    setLocalRules(rewardRules);
  }, [rewardRules]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadCoins(), loadRewardRules(), loadWallet(), loadFollowerCount(), refreshUser()]);
    setRefreshing(false);
  }, [loadCoins, loadRewardRules, loadWallet, loadFollowerCount, refreshUser]);

  const handleSaveRewardRules = async () => {
    setIsRewardRulesSaving(true);
    try {
      const response = await apiClient.put('/v1/reward-rules', {
        base_amount: localRules.base_amount,
        per_type: localRules.per_type,
      });

      if (response.ok) {
        setRewardRules(localRules);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Reward settings saved',
          visibilityTime: 2000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to save reward rules',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Save reward rules error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save reward rules',
        visibilityTime: 3000,
      });
    } finally {
      setIsRewardRulesSaving(false);
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const formatCoinValue = (value: number): string => {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 });
  };

  const primaryCoinSymbol = (user?.default_coin_symbol || wallet?.currency || wallet?.primary_coin || 'FCN').toUpperCase();
  const primaryCoin = coins.find((coin) => coin.symbol === primaryCoinSymbol) ?? null;
  const primaryCoinBalance = primaryCoin?.balance ?? wallet?.balance ?? 0;
  const conversionRate = wallet?.conversion_rate ?? 1;
  const primaryCoinValueUsd = wallet?.primary_coin_value_usd ?? 0;

  const sortedCoins = [...coins].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const hasCoins = sortedCoins.length > 0;

  // Handle Android back button for Top Up Modal
  useEffect(() => {
    if (!isTopUpModalVisible) return;

    const backAction = () => {
      setIsTopUpModalVisible(false);
      setSelectedCoin(null);
      setTopUpAmount('');
      return true; // Prevent default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [isTopUpModalVisible]);

  // Handle Android back button for Launch Coin Modal
  useEffect(() => {
    if (!isLaunchCoinModalVisible) return;

    const backAction = () => {
      setIsLaunchCoinModalVisible(false);
      return true; // Prevent default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [isLaunchCoinModalVisible]);

  const openTopUpModal = (coin: CreatorCoin) => {
    setSelectedCoin(coin);
    setTopUpAmount('');
    setIsTopUpModalVisible(true);
  };

  const handleTopUp = async () => {
    if (!selectedCoin) return;

    const amountValue = parseFloat(topUpAmount);
    if (!topUpAmount || isNaN(amountValue) || amountValue <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Amount',
        text2: 'Please enter a valid amount',
        visibilityTime: 3000,
      });
      return;
    }

    if (amountValue < 1) {
      Toast.show({
        type: 'error',
        text1: 'Minimum Amount',
        text2: 'Minimum top-up amount is $1 USD',
        visibilityTime: 3000,
      });
      return;
    }

    setIsTopUpLoading(true);
    try {
      // Use a valid HTTP URL for return_url (backend validation requires valid URL)
      // Get the base URL from environment, removing /api suffix if present
      const apiBaseUrl = 
        Constants.expoConfig?.extra?.apiBaseUrl?.replace(/\/api\/?$/, '') ||
        process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/api\/?$/, '') ||
        'http://localhost:8000';
      const returnUrl = `${apiBaseUrl}/dashboard/my-coin?payment=success`;
      const response = await apiClient.post<{ checkout_url: string }>('/v1/wallets/topups', {
        amount: amountValue,
        coin_symbol: selectedCoin.symbol,
        return_url: returnUrl,
      });

      if (response.ok && response.data?.checkout_url) {
        // Open Stripe checkout in browser
        const canOpen = await Linking.canOpenURL(response.data.checkout_url);
        if (canOpen) {
          await Linking.openURL(response.data.checkout_url);
          setIsTopUpModalVisible(false);
          Toast.show({
            type: 'info',
            text1: 'Redirecting to Payment',
            text2: 'Complete payment in the browser',
            visibilityTime: 3000,
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Unable to open payment page',
            visibilityTime: 3000,
          });
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to create payment',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Top up error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Something went wrong. Please try again.',
        visibilityTime: 3000,
      });
    } finally {
      setIsTopUpLoading(false);
    }
  };

  const handleCreateCoin = async () => {
    const trimmedSymbol = newCoinSymbol.trim().toUpperCase();
    
    if (!trimmedSymbol) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a coin symbol',
        visibilityTime: 3000,
      });
      return;
    }

    // Validate coin symbol format (uppercase letters and numbers only, max 10 chars)
    const symbolRegex = /^[A-Z0-9]{1,10}$/;
    if (!symbolRegex.test(trimmedSymbol)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Symbol',
        text2: 'Coin symbol must be 1-10 uppercase letters and numbers only',
        visibilityTime: 3000,
      });
      return;
    }

    setIsCreatingCoin(true);
    try {
      const response = await apiClient.post('/v1/coins/create', {
        coin_symbol: trimmedSymbol,
      });

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Coin created successfully!',
          visibilityTime: 3000,
        });
        setNewCoinSymbol('');
        setIsLaunchCoinModalVisible(false);
        await Promise.all([loadCoins(), refreshUser()]);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to create coin',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Create coin error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Something went wrong. Please try again.',
        visibilityTime: 3000,
      });
    } finally {
      setIsCreatingCoin(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        {!hasCoins ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <FontAwesome name="money" size={48} color="#fff" />
            </View>
            <Text style={styles.emptyTitle}>Launch Your First Coin</Text>
            <Text style={styles.emptyText}>
              Create a branded coin to reward your community. Fund it instantly and start allocating rewards tied to engagement.
            </Text>
            <TouchableOpacity
              style={styles.launchButton}
              onPress={() => {
                setNewCoinSymbol('');
                setIsLaunchCoinModalVisible(true);
              }}
            >
              <FontAwesome name="money" size={20} color="#fff" />
              <Text style={styles.launchButtonText}>Launch a Coin</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Primary Coin Card */}
            <LinearGradient
              colors={['#FF6B00', '#FF8C42']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryCoinCard}
            >
              <View style={styles.primaryCoinContent}>
                <View style={styles.primaryCoinHeader}>
                  <View>
                    <Text style={styles.primaryCoinLabel}>Primary Coin</Text>
                    <Text style={styles.primaryCoinSymbol}>{primaryCoinSymbol}</Text>
                    <View style={styles.primaryCoinStats}>
                      <View style={styles.primaryCoinStat}>
                        <Text style={styles.primaryCoinStatLabel}>Current Pool</Text>
                        <Text style={styles.primaryCoinStatValue}>{formatNumber(primaryCoinBalance)}</Text>
                      </View>
                      <View style={styles.primaryCoinStat}>
                        <Text style={styles.primaryCoinStatLabel}>Followers</Text>
                        <Text style={styles.primaryCoinStatValue}>{formatNumber(followerCount)}</Text>
                      </View>
                      <View style={styles.primaryCoinStat}>
                        <Text style={styles.primaryCoinStatLabel}>Conversion</Text>
                        <Text style={styles.primaryCoinStatValue}>1 USD = {conversionRate} {primaryCoinSymbol}</Text>
                      </View>
                      <View style={styles.primaryCoinStat}>
                        <Text style={styles.primaryCoinStatLabel}>Coin Value</Text>
                        <Text style={styles.primaryCoinStatValue}>
                          1 {primaryCoinSymbol} = ${formatCoinValue(primaryCoinValueUsd)} USD
                        </Text>
                      </View>
                    </View>
                  </View>
                  {primaryCoin && (
                    <TouchableOpacity
                      style={styles.fundButton}
                      onPress={() => openTopUpModal(primaryCoin)}
                    >
                      <FontAwesome name="money" size={16} color="#FF6B00" />
                      <Text style={styles.fundButtonText}>Fund {primaryCoin.symbol}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </LinearGradient>

            {/* Your Coins */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Your Coins</Text>
                  <Text style={styles.sectionSubtitle}>
                    Manage every coin you've launched. Fund pools and monitor balances in one place.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => {
                    setNewCoinSymbol('');
                    setIsLaunchCoinModalVisible(true);
                  }}
                >
                  <Text style={styles.createButtonText}>Create New Coin</Text>
                </TouchableOpacity>
              </View>
              {isCoinsLoading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="small" color="#FF6B00" />
                  <Text style={styles.loadingText}>Loading coins…</Text>
                </View>
              ) : (
                <View style={styles.coinsGrid}>
                  {sortedCoins.map((coin) => (
                    <View key={coin.id} style={styles.coinCard}>
                      <View style={styles.coinCardHeader}>
                        <View>
                          <Text style={styles.coinSymbol}>{coin.symbol}</Text>
                          {coin.name && <Text style={styles.coinName}>{coin.name}</Text>}
                        </View>
                        <View style={styles.coinBalance}>
                          <FontAwesome name="star" size={20} color="#FF6B00" />
                          <Text style={styles.coinBalanceText}>{formatNumber(coin.balance)}</Text>
                        </View>
                      </View>
                      {coin.description && (
                        <Text style={styles.coinDescription}>{coin.description}</Text>
                      )}
                      <Text style={styles.coinValue}>
                        1 {coin.symbol} = ${formatCoinValue(coin.value_usd ?? 0)} USD
                      </Text>
                      <View style={styles.coinActions}>
                        <TouchableOpacity
                          style={styles.coinActionButton}
                          onPress={() => openTopUpModal(coin)}
                        >
                          <Text style={styles.coinActionButtonText}>Fund {coin.symbol}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.coinActionButtonOutline}
                          onPress={() => {
                            Toast.show({
                              type: 'info',
                              text1: 'Coming Soon',
                              text2: 'Allocate rewards feature will be available soon',
                              visibilityTime: 3000,
                            });
                          }}
                        >
                          <Text style={styles.coinActionButtonTextOutline}>Allocate Rewards</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Reward Distribution Settings */}
            <View style={styles.sectionCard}>
              <View style={styles.settingsHeader}>
                <Text style={styles.sectionTitle}>Reward Distribution Settings</Text>
                <Text style={styles.sectionSubtitle}>
                  Decide how many coins you send for each verified engagement across your campaigns.
                </Text>
              </View>

              <View style={styles.settingsForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Base Reward (fallback)</Text>
                  <TextInput
                    style={styles.input}
                    value={String(localRules.base_amount)}
                    onChangeText={(text) => {
                      const value = Number(text) || 0;
                      setLocalRules((prev) => ({ ...prev, base_amount: Math.max(0, value) }));
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#999"
                    editable={!isRewardRulesLoading && !isRewardRulesSaving}
                  />
                </View>

                <View style={styles.rewardTypesGrid}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Per Like</Text>
                    <TextInput
                      style={styles.input}
                      value={String(localRules.per_type.like)}
                      onChangeText={(text) => {
                        const value = Number(text) || 0;
                        setLocalRules((prev) => ({
                          ...prev,
                          per_type: { ...prev.per_type, like: Math.max(0, value) },
                        }));
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#999"
                      editable={!isRewardRulesLoading && !isRewardRulesSaving}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Per Comment</Text>
                    <TextInput
                      style={styles.input}
                      value={String(localRules.per_type.comment)}
                      onChangeText={(text) => {
                        const value = Number(text) || 0;
                        setLocalRules((prev) => ({
                          ...prev,
                          per_type: { ...prev.per_type, comment: Math.max(0, value) },
                        }));
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#999"
                      editable={!isRewardRulesLoading && !isRewardRulesSaving}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Per Share</Text>
                    <TextInput
                      style={styles.input}
                      value={String(localRules.per_type.share)}
                      onChangeText={(text) => {
                        const value = Number(text) || 0;
                        setLocalRules((prev) => ({
                          ...prev,
                          per_type: { ...prev.per_type, share: Math.max(0, value) },
                        }));
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#999"
                      editable={!isRewardRulesLoading && !isRewardRulesSaving}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Per Full Watch</Text>
                    <TextInput
                      style={styles.input}
                      value={String(localRules.per_type.watch)}
                      onChangeText={(text) => {
                        const value = Number(text) || 0;
                        setLocalRules((prev) => ({
                          ...prev,
                          per_type: { ...prev.per_type, watch: Math.max(0, value) },
                        }));
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#999"
                      editable={!isRewardRulesLoading && !isRewardRulesSaving}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, (isRewardRulesLoading || isRewardRulesSaving) && styles.saveButtonDisabled]}
                  onPress={handleSaveRewardRules}
                  disabled={isRewardRulesLoading || isRewardRulesSaving}
                >
                  {isRewardRulesSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Settings</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Top Up Modal */}
      <Modal
        visible={isTopUpModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsTopUpModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsTopUpModalVisible(false)}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => {
              e.stopPropagation();
            }}
          >
            <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 16) }]}>
              <Text style={styles.modalTitle}>Fund {selectedCoin?.symbol || 'Coin'}</Text>
              <TouchableOpacity onPress={() => setIsTopUpModalVisible(false)}>
                <FontAwesome name="times" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalLabel}>Amount (USD)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={topUpAmount}
                    onChangeText={(text) => {
                      // Only allow numbers and one decimal point
                      const cleaned = text.replace(/[^0-9.]/g, '');
                      const parts = cleaned.split('.');
                      if (parts.length > 2) return; // Only one decimal point
                      if (parts[1] && parts[1].length > 2) return; // Max 2 decimal places
                      setTopUpAmount(cleaned);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="10.00"
                    placeholderTextColor="#999"
                    editable={!isTopUpLoading}
                  />
                  <Text style={styles.modalHint}>Minimum: $1.00 USD</Text>
                </View>

                {selectedCoin && topUpAmount && !isNaN(parseFloat(topUpAmount)) && parseFloat(topUpAmount) > 0 && (
                  <View style={styles.modalSummary}>
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>You will pay:</Text>
                      <Text style={styles.modalSummaryValue}>${parseFloat(topUpAmount).toFixed(2)} USD</Text>
                    </View>
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>You will receive:</Text>
                      <Text style={styles.modalSummaryValue}>
                        {(parseFloat(topUpAmount) * conversionRate).toFixed(2)} {selectedCoin.symbol}
                      </Text>
                    </View>
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummarySubtext}>Conversion rate:</Text>
                      <Text style={styles.modalSummarySubtext}>
                        1 USD ≈ {conversionRate.toFixed(2)} {selectedCoin.symbol}
                      </Text>
                    </View>
                    {primaryCoinValueUsd > 0 && (
                      <View style={styles.modalSummaryRow}>
                        <Text style={styles.modalSummarySubtext}>Coin value:</Text>
                        <Text style={styles.modalSummarySubtext}>
                          1 {selectedCoin.symbol} ≈ ${formatCoinValue(primaryCoinValueUsd)} USD
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={[styles.modalButtonContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                  <TouchableOpacity
                    style={[styles.modalSubmitButton, (!topUpAmount || parseFloat(topUpAmount) < 1 || isTopUpLoading) && styles.modalSubmitButtonDisabled]}
                    onPress={handleTopUp}
                    disabled={!topUpAmount || parseFloat(topUpAmount) < 1 || isTopUpLoading}
                    activeOpacity={0.7}
                  >
                    {isTopUpLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalSubmitButtonText}>Continue to Payment</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Launch Coin Modal */}
      <Modal
        visible={isLaunchCoinModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLaunchCoinModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsLaunchCoinModalVisible(false)}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => {
              e.stopPropagation();
            }}
          >
            <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 16) }]}>
              <Text style={styles.modalTitle}>Create Your Coin</Text>
              <TouchableOpacity onPress={() => setIsLaunchCoinModalVisible(false)}>
                <FontAwesome name="times" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalLabel}>Coin Symbol</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newCoinSymbol}
                    onChangeText={(text) => {
                      // Only allow uppercase letters and numbers, max 10 chars
                      const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                      setNewCoinSymbol(cleaned);
                    }}
                    placeholder="e.g., SARAH, DAVID, MYCOIN"
                    placeholderTextColor="#999"
                    maxLength={10}
                    editable={!isCreatingCoin}
                    autoCapitalize="characters"
                  />
                  <Text style={styles.modalHint}>
                    Choose a unique symbol for your coin (1-10 uppercase letters and numbers only)
                  </Text>
                </View>

                <View style={styles.modalInfoBox}>
                  <Text style={styles.modalInfoTitle}>Important</Text>
                  <Text style={styles.modalInfoText}>
                    • Coin symbols must be unique across all users{'\n'}
                    • Once created, your coin symbol cannot be changed{'\n'}
                    • Your coin symbol will be used to track distributions
                  </Text>
                </View>

                <View style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
                  <TouchableOpacity
                    style={[styles.modalSubmitButton, (!newCoinSymbol.trim() || isCreatingCoin) && styles.modalSubmitButtonDisabled]}
                    onPress={handleCreateCoin}
                    disabled={!newCoinSymbol.trim() || isCreatingCoin}
                  >
                    {isCreatingCoin ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalSubmitButtonText}>Create Coin</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  content: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE5D4',
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  launchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  launchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryCoinCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  primaryCoinContent: {
    flex: 1,
  },
  primaryCoinHeader: {
    flexDirection: 'column',
  },
  primaryCoinLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 4,
  },
  primaryCoinSymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  primaryCoinStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  primaryCoinStat: {
    marginBottom: 8,
  },
  primaryCoinStatLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 4,
  },
  primaryCoinStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  fundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
    width: '100%',
    maxWidth: 200,
  },
  fundButtonText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FFE5D4',
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  createButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  coinsGrid: {
    gap: 12,
  },
  coinCard: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE5D4',
  },
  coinCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  coinSymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  coinName: {
    fontSize: 13,
    color: '#666',
  },
  coinBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinBalanceText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF6B00',
  },
  coinDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  coinValue: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  coinActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  coinActionButton: {
    flex: 1,
    backgroundColor: '#FF6B00',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 100,
  },
  coinActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  coinActionButtonOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#FF6B00',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 100,
  },
  coinActionButtonTextOutline: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsHeader: {
    marginBottom: 20,
  },
  settingsForm: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#FFE5D4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },
  rewardTypesGrid: {
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    minHeight: 450,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  modalBody: {
    flex: 1,
  },
  modalInputGroup: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#FFE5D4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 12,
    color: '#999',
  },
  modalSummary: {
    backgroundColor: '#FFF4ED',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE5D4',
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalSummaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  modalSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B00',
  },
  modalSummarySubtext: {
    fontSize: 12,
    color: '#999',
  },
  modalInfoBox: {
    backgroundColor: '#FFF4ED',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE5D4',
  },
  modalInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  modalInfoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  modalButtonContainer: {
    width: '100%',
    marginTop: 8,
  },
  modalSubmitButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 48,
  },
  modalSubmitButtonDisabled: {
    opacity: 0.6,
  },
  modalSubmitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

