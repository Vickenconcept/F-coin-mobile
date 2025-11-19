import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { apiClient } from '../../lib/apiClient';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';

type WalletCoinBalance = {
  coin_symbol: string;
  balance: number;
  value_usd: number;
  fiat_value_usd: number;
  value_updated_at?: string | null;
};

type Transaction = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
  balance_before: number;
  balance_after: number;
  reference?: string | null;
  created_at: string;
};

type WalletData = {
  id: string;
  primary_coin: string;
  balance: number;
  conversion_rate: number;
  primary_coin_value_usd: number;
  coin_balances: WalletCoinBalance[];
  transactions: Transaction[];
};

type UsernameLookupResult = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

export default function WalletScreen() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'balances' | 'transactions' | 'send'>('balances');
  
  // Send/Transfer states
  const [isSendModalVisible, setIsSendModalVisible] = useState(false);
  const [transferUsername, setTransferUsername] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferCoinSymbol, setTransferCoinSymbol] = useState('FCN');
  const [transferNote, setTransferNote] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [usernameInfo, setUsernameInfo] = useState<UsernameLookupResult | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const usernameCheckTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const fetchWallet = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<WalletData>('/v1/wallets/me');

      if (response.ok && response.data) {
        setWallet(response.data);
        if (response.data.coin_balances && response.data.coin_balances.length > 0) {
          const primaryCoin = response.data.primary_coin || 'FCN';
          const hasCoin = response.data.coin_balances.some(
            (b) => b.coin_symbol.toUpperCase() === primaryCoin.toUpperCase()
          );
          setTransferCoinSymbol(hasCoin ? primaryCoin.toUpperCase() : response.data.coin_balances[0].coin_symbol);
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to load wallet',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Error fetching wallet:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Unable to load wallet details',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWallet();
  }, [fetchWallet]);

  // Username validation
  useEffect(() => {
    if (!isSendModalVisible) {
      return;
    }

    const trimmed = transferUsername.trim();

    if (!trimmed) {
      setUsernameCheck('idle');
      setUsernameInfo(null);
      setUsernameError(null);
      return;
    }

    // Client-side validation: username must be at least 3 characters
    if (trimmed.length < 3) {
      setUsernameCheck('invalid');
      setUsernameInfo(null);
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    setUsernameCheck('checking');
    setUsernameError(null);

    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }

    usernameCheckTimeoutRef.current = setTimeout(async () => {
      // Double-check the username hasn't changed
      const currentTrimmed = transferUsername.trim();
      if (currentTrimmed !== trimmed || currentTrimmed.length < 3) {
        return;
      }

      try {
        const response = await apiClient.get<UsernameLookupResult>(
          `/v1/users/lookup?username=${encodeURIComponent(trimmed)}`
        );

        // Check again if username changed during the API call
        if (transferUsername.trim() !== trimmed) {
          return;
        }

        if (response.ok && response.data) {
          setUsernameCheck('valid');
          setUsernameInfo(response.data);
          setUsernameError(null);
        } else {
          setUsernameCheck('invalid');
          setUsernameInfo(null);
          // Extract user-friendly error message from API response
          const errorDetail = response.errors?.[0]?.detail;
          if (errorDetail) {
            // Handle validation errors from backend
            if (errorDetail.includes('at least 3 characters')) {
              setUsernameError('Username must be at least 3 characters');
            } else if (errorDetail.includes('not found') || errorDetail.includes('does not exist')) {
              setUsernameError('User not found');
            } else {
              setUsernameError(errorDetail);
            }
          } else {
            setUsernameError('User not found');
          }
        }
      } catch (error: any) {
        console.error('Username validation error:', error);
        // Check again if username changed during the error
        if (transferUsername.trim() !== trimmed) {
          return;
        }
        setUsernameCheck('invalid');
        setUsernameInfo(null);
        
        // Extract error message from Axios error response
        const errorMessage = error?.response?.data?.errors?.[0]?.detail 
          || error?.message 
          || 'Unable to verify username';
        
        // Handle validation errors
        if (errorMessage.includes('at least 3 characters')) {
          setUsernameError('Username must be at least 3 characters');
        } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
          setUsernameError('User not found');
        } else {
          setUsernameError(errorMessage);
        }
      }
    }, 400);

    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
      }
    };
  }, [transferUsername, isSendModalVisible]);

  const resetTransferForm = useCallback(() => {
    setTransferUsername('');
    setTransferAmount('');
    setTransferNote('');
    setUsernameCheck('idle');
    setUsernameInfo(null);
    setUsernameError(null);
  }, []);

  const handleSend = useCallback(async () => {
    if (!wallet || !transferUsername.trim() || !transferAmount.trim()) {
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Amount',
        text2: 'Please enter a valid amount',
        visibilityTime: 3000,
      });
      return;
    }

    if (usernameCheck !== 'valid' || !usernameInfo) {
      Toast.show({
        type: 'error',
        text1: 'Invalid User',
        text2: 'Please enter a valid username',
        visibilityTime: 3000,
      });
      return;
    }

    const selectedBalance = wallet.coin_balances.find(
      (b) => b.coin_symbol.toUpperCase() === transferCoinSymbol.toUpperCase()
    );

    if (!selectedBalance || selectedBalance.balance < amount) {
      Toast.show({
        type: 'error',
        text1: 'Insufficient Balance',
        text2: `You only have ${selectedBalance?.balance || 0} ${transferCoinSymbol}`,
        visibilityTime: 4000,
      });
      return;
    }

    setIsTransferring(true);
    try {
      const response = await apiClient.post('/v1/wallets/transfers', {
        recipient_username: transferUsername.trim(),
        amount: amount,
        coin_symbol: transferCoinSymbol,
        note: transferNote.trim() || undefined,
      });

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Sent ${amount} ${transferCoinSymbol} to @${transferUsername.trim()}`,
          visibilityTime: 3000,
        });
        setIsSendModalVisible(false);
        resetTransferForm();
        await fetchWallet(); // Refresh wallet data
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to send coins',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Transfer error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send coins',
        visibilityTime: 3000,
      });
    } finally {
      setIsTransferring(false);
    }
  }, [wallet, transferUsername, transferAmount, transferCoinSymbol, transferNote, usernameCheck, usernameInfo, resetTransferForm, fetchWallet]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getTransactionIcon = (type: string) => {
    if (type.includes('credit') || type.includes('reward') || type.includes('top_up')) {
      return { name: 'arrow-down' as const, color: '#25D366' };
    }
    if (type.includes('debit') || type.includes('transfer')) {
      return { name: 'arrow-up' as const, color: '#E91E63' };
    }
    return { name: 'exchange' as const, color: '#666' };
  };

  const getTransactionLabel = (type: string) => {
    if (type.includes('reward')) return 'Reward';
    if (type.includes('top_up')) return 'Top-up';
    if (type.includes('transfer')) return 'Transfer';
    if (type.includes('credit')) return 'Received';
    if (type.includes('debit')) return 'Sent';
    return 'Transaction';
  };

  if (isLoading && !wallet) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </View>
    );
  }

  if (!wallet) {
    return (
      <View style={styles.centerContainer}>
        <FontAwesome name="exclamation-circle" size={48} color="#999" />
        <Text style={styles.errorText}>Unable to load wallet</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchWallet}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalValueUsd = wallet.coin_balances.reduce((sum, balance) => sum + balance.fiat_value_usd, 0);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wallet</Text>
        </View>

        {/* Total Balance Card */}
        <View style={styles.totalBalanceCard}>
          <Text style={styles.totalBalanceLabel}>Total Value</Text>
          <Text style={styles.totalBalanceAmount}>${totalValueUsd.toFixed(2)}</Text>
          <Text style={styles.totalBalanceSubtext}>
            {wallet.balance.toFixed(2)} {wallet.primary_coin}
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'balances' && styles.tabActive]}
            onPress={() => setActiveTab('balances')}
          >
            <Text style={[styles.tabText, activeTab === 'balances' && styles.tabTextActive]}>
              Balances
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'transactions' && styles.tabActive]}
            onPress={() => setActiveTab('transactions')}
          >
            <Text style={[styles.tabText, activeTab === 'transactions' && styles.tabTextActive]}>
              Transactions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'send' && styles.tabActive]}
            onPress={() => setActiveTab('send')}
          >
            <Text style={[styles.tabText, activeTab === 'send' && styles.tabTextActive]}>
              Send
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'balances' && (
          <View style={styles.tabContent}>
            {wallet.coin_balances.length === 0 ? (
              <View style={styles.emptyContainer}>
                <FontAwesome name="wallet" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No coins in wallet</Text>
                <Text style={styles.emptySubtext}>Start earning or top up to add coins</Text>
              </View>
            ) : (
              wallet.coin_balances.map((balance) => (
                <View key={balance.coin_symbol} style={styles.balanceCard}>
                  <View style={styles.balanceHeader}>
                    <View style={styles.coinIcon}>
                      <FontAwesome name="coins" size={24} color="#FF6B00" />
                    </View>
                    <View style={styles.balanceInfo}>
                      <Text style={styles.coinSymbol}>{balance.coin_symbol}</Text>
                      <Text style={styles.balanceAmount}>
                        {balance.balance.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.balanceValue}>
                      <Text style={styles.valueUsd}>${balance.fiat_value_usd.toFixed(2)}</Text>
                      <Text style={styles.valueRate}>
                        ${balance.value_usd.toFixed(4)} per coin
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'transactions' && (
          <View style={styles.tabContent}>
            {wallet.transactions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <FontAwesome name="list" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySubtext}>Your transaction history will appear here</Text>
              </View>
            ) : (
              wallet.transactions.map((transaction) => {
                const icon = getTransactionIcon(transaction.type);
                const isCredit = transaction.type.includes('credit') || transaction.type.includes('reward') || transaction.type.includes('top_up');
                
                return (
                  <View key={transaction.id} style={styles.transactionCard}>
                    <View style={styles.transactionIcon}>
                      <FontAwesome name={icon.name} size={20} color={icon.color} />
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionType}>
                        {getTransactionLabel(transaction.type)}
                      </Text>
                      <Text style={styles.transactionTime}>
                        {formatTime(transaction.created_at)}
                      </Text>
                      {transaction.reference && (
                        <Text style={styles.transactionReference}>
                          {String(transaction.reference)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.transactionAmount}>
                      <Text style={[
                        styles.transactionAmountText,
                        isCredit ? styles.transactionAmountCredit : styles.transactionAmountDebit
                      ]}>
                        {isCredit ? '+' : '-'}{Math.abs(transaction.amount).toFixed(2)}
                      </Text>
                      <Text style={styles.transactionCurrency}>{transaction.currency}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'send' && (
          <View style={styles.tabContent}>
            <TouchableOpacity
              style={styles.sendButton}
              onPress={() => setIsSendModalVisible(true)}
            >
              <FontAwesome name="paper-plane" size={20} color="#fff" />
              <Text style={styles.sendButtonText}>Send Coins</Text>
            </TouchableOpacity>
            <Text style={styles.sendInfoText}>
              Send coins to other users by entering their username
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Send Modal */}
      <Modal
        visible={isSendModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setIsSendModalVisible(false);
          resetTransferForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Coins</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsSendModalVisible(false);
                  resetTransferForm();
                }}
              >
                <FontAwesome name="times" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Recipient Username */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Recipient Username</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    usernameCheck === 'valid' && styles.formInputValid,
                    usernameCheck === 'invalid' && styles.formInputInvalid,
                  ]}
                  value={transferUsername}
                  onChangeText={(text) => {
                    setTransferUsername(text.replace(/[^a-zA-Z0-9_.]/g, ''));
                    setUsernameCheck('idle');
                  }}
                  placeholder="@username"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {usernameCheck === 'checking' && (
                  <View style={styles.usernameStatus}>
                    <ActivityIndicator size="small" color="#FF6B00" />
                    <Text style={styles.usernameStatusText}>Checking...</Text>
                  </View>
                )}
                {usernameCheck === 'valid' && usernameInfo && (
                  <View style={styles.usernameStatus}>
                    <FontAwesome name="check-circle" size={16} color="#25D366" />
                    <Text style={[styles.usernameStatusText, styles.usernameStatusValid]}>
                      {usernameInfo.display_name || usernameInfo.username}
                    </Text>
                  </View>
                )}
                {usernameCheck === 'invalid' && usernameError && (
                  <View style={styles.usernameStatus}>
                    <FontAwesome name="times-circle" size={16} color="#E91E63" />
                    <Text style={[styles.usernameStatusText, styles.usernameStatusInvalid]}>
                      {usernameError}
                    </Text>
                  </View>
                )}
              </View>

              {/* Coin Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Coin</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coinSelector}>
                  {wallet.coin_balances.map((balance) => (
                    <TouchableOpacity
                      key={balance.coin_symbol}
                      style={[
                        styles.coinOption,
                        transferCoinSymbol.toUpperCase() === balance.coin_symbol.toUpperCase() &&
                          styles.coinOptionActive,
                      ]}
                      onPress={() => setTransferCoinSymbol(balance.coin_symbol.toUpperCase())}
                    >
                      <Text
                        style={[
                          styles.coinOptionText,
                          transferCoinSymbol.toUpperCase() === balance.coin_symbol.toUpperCase() &&
                            styles.coinOptionTextActive,
                        ]}
                      >
                        {balance.coin_symbol} ({balance.balance.toFixed(2)})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Amount */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Amount</Text>
                <TextInput
                  style={styles.formInput}
                  value={transferAmount}
                  onChangeText={(text) => {
                    // Allow only numbers and one decimal point
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    const parts = cleaned.split('.');
                    if (parts.length > 2) return;
                    if (parts[1] && parts[1].length > 8) return;
                    setTransferAmount(cleaned);
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.formHint}>
                  Available: {wallet.coin_balances.find(
                    (b) => b.coin_symbol.toUpperCase() === transferCoinSymbol.toUpperCase()
                  )?.balance.toFixed(2) || '0.00'} {transferCoinSymbol}
                </Text>
              </View>

              {/* Note (Optional) */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Note (Optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMultiline]}
                  value={transferNote}
                  onChangeText={setTransferNote}
                  placeholder="Add a note..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.modalSendButton,
                (isTransferring ||
                  !transferUsername.trim() ||
                  !transferAmount.trim() ||
                  usernameCheck !== 'valid') &&
                  styles.modalSendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={
                isTransferring ||
                !transferUsername.trim() ||
                !transferAmount.trim() ||
                usernameCheck !== 'valid'
              }
            >
              {isTransferring ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <FontAwesome name="paper-plane" size={16} color="#fff" />
                  <Text style={styles.modalSendButtonText}>Send</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FF6B00',
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
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
  totalBalanceCard: {
    backgroundColor: '#FF6B00',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  totalBalanceLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 8,
  },
  totalBalanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  totalBalanceSubtext: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
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
  tabContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff3e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  balanceInfo: {
    flex: 1,
  },
  coinSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  balanceValue: {
    alignItems: 'flex-end',
  },
  valueUsd: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  valueRate: {
    fontSize: 12,
    color: '#666',
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  transactionTime: {
    fontSize: 13,
    color: '#666',
  },
  transactionReference: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  transactionAmountCredit: {
    color: '#25D366',
  },
  transactionAmountDebit: {
    color: '#E91E63',
  },
  transactionCurrency: {
    fontSize: 12,
    color: '#666',
  },
  sendButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sendInfoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
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
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  modalBody: {
    padding: 16,
    maxHeight: 500,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  formInputValid: {
    borderColor: '#25D366',
  },
  formInputInvalid: {
    borderColor: '#E91E63',
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  usernameStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  usernameStatusText: {
    fontSize: 14,
  },
  usernameStatusValid: {
    color: '#25D366',
  },
  usernameStatusInvalid: {
    color: '#E91E63',
  },
  coinSelector: {
    marginTop: 8,
  },
  coinOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
    marginRight: 8,
  },
  coinOptionActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  coinOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  coinOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  modalSendButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  modalSendButtonDisabled: {
    opacity: 0.6,
  },
  modalSendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

