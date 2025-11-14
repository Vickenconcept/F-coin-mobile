import { StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient';

type WalletData = {
  id: number;
  balance: number;
  primary_coin: string;
  primary_coin_value_usd: number;
  coin_balances?: Array<{
    coin_symbol: string;
    balance: number;
    value_usd: number;
    fiat_value_usd: number;
  }>;
  transactions?: Array<{
    id: number;
    type: string;
    amount: number;
    currency: string;
    created_at: string;
  }>;
};

export default function WalletScreen() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<WalletData>('/v1/wallets/me');
      
      if (response.ok && response.data) {
        setWallet(response.data);
      } else {
        setError(response.errors?.[0]?.detail || 'Failed to load wallet');
      }
    } catch (err) {
      setError('An error occurred while loading wallet');
      console.error('Wallet load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>My Wallet</Text>
        
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>{wallet?.balance?.toFixed(2) || '0.00'}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>Primary Coin: {wallet?.primary_coin || 'FCN'}</Text>
          <Text style={styles.infoText}>
            Coin Value: ${wallet?.primary_coin_value_usd?.toFixed(4) || '0.0000'} USD
          </Text>
        </View>

        {wallet?.coin_balances && wallet.coin_balances.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coin Balances</Text>
            {wallet.coin_balances.map((coinBalance, index) => (
              <View key={index} style={styles.coinCard}>
                <View style={styles.coinHeader}>
                  <Text style={styles.coinName}>{coinBalance.coin_symbol}</Text>
                </View>
                <View style={styles.coinDetails}>
                  <Text style={styles.coinBalance}>
                    {coinBalance.balance.toFixed(2)} {coinBalance.coin_symbol}
                  </Text>
                  <Text style={styles.coinValue}>
                    ${coinBalance.fiat_value_usd.toFixed(2)} USD
                  </Text>
                </View>
                <Text style={styles.coinValuePerUnit}>
                  ${coinBalance.value_usd.toFixed(4)} per {coinBalance.coin_symbol}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No coins yet</Text>
            <Text style={styles.emptySubtext}>
              Connect social accounts and engage with creators to earn coins!
            </Text>
          </View>
        )}
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 24,
  },
  balanceCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  coinCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  coinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  coinName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  coinSymbol: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  coinDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coinBalance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B00',
  },
  coinValue: {
    fontSize: 14,
    color: '#666',
  },
  coinValuePerUnit: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    textAlign: 'center',
    padding: 20,
  },
});
