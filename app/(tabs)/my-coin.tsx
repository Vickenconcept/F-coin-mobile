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
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { apiClient } from '../../lib/apiClient';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
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

  const openTopUpModal = (coin: CreatorCoin) => {
    setSelectedCoin(coin);
    setIsTopUpModalVisible(true);
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
                Toast.show({
                  type: 'info',
                  text1: 'Coming Soon',
                  text2: 'Coin launch feature will be available soon',
                  visibilityTime: 3000,
                });
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
                  <View style={styles.primaryCoinActions}>
                    <View style={styles.primaryCoinIcon}>
                      <FontAwesome name="money" size={40} color="#fff" />
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
                    Toast.show({
                      type: 'info',
                      text1: 'Coming Soon',
                      text2: 'Create new coin feature will be available soon',
                      visibilityTime: 3000,
                    });
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fund {selectedCoin?.symbol || 'Coin'}</Text>
              <TouchableOpacity onPress={() => setIsTopUpModalVisible(false)}>
                <FontAwesome name="times" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                Top-up functionality will be available soon. You'll be able to fund your coin pool directly from here.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsTopUpModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    gap: 16,
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
  primaryCoinActions: {
    alignItems: 'flex-end',
    gap: 12,
  },
  primaryCoinIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
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
    marginBottom: 20,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalCloseButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

