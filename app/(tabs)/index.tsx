import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient';

type WalletData = {
  balance: number;
  primary_coin: string;
  primary_coin_value_usd: number;
  coin_balances?: Array<{
    coin_symbol: string;
    balance: number;
    fiat_value_usd: number;
  }>;
};

type UserStats = {
  followers_count?: number;
  following_count?: number;
};

export default function DashboardScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [walletResponse, followersResponse, followingResponse] = await Promise.all([
        apiClient.get<WalletData>('/v1/wallets/me'),
        user?.id ? apiClient.get<any[]>(`/v1/users/${user.id}/followers`) : Promise.resolve({ ok: false, data: [] }),
        user?.id ? apiClient.get<any[]>(`/v1/users/${user.id}/following`) : Promise.resolve({ ok: false, data: [] }),
      ]);

      if (walletResponse.ok && walletResponse.data) {
        setWallet(walletResponse.data);
      }

      // Extract counts from responses
      const followersCount = Array.isArray(followersResponse.data) 
        ? followersResponse.data.length 
        : followersResponse.meta?.pagination?.total || 0;
      const followingCount = Array.isArray(followingResponse.data) 
        ? followingResponse.data.length 
        : followingResponse.meta?.pagination?.total || 0;

      setUserStats({
        followers_count: followersCount,
        following_count: followingCount,
      });
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refreshUser()]);
    setRefreshing(false);
  }, [loadData, refreshUser]);

  const handleLogout = async () => {
    await logout();
    Toast.show({
      type: 'success',
      text1: 'Logged Out',
      text2: 'You have been logged out successfully',
    });
    router.replace('/login');
  };

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Welcome back!</Text>
        <Text style={styles.subtitle}>Hello, {user?.name || 'User'}!</Text>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FF6B00" />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        ) : (
          <>
            {/* Stats Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {wallet?.balance?.toFixed(2) || '0.00'}
                </Text>
                <Text style={styles.statLabel}>
                  {wallet?.primary_coin || 'FCN'}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {formatNumber(userStats?.followers_count)}
                </Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {formatNumber(userStats?.following_count)}
                </Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quick Actions</Text>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/discover')}
              >
                <Text style={styles.actionButtonText}>🔍 Discover Creators</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/(tabs)/two')}
              >
                <Text style={styles.actionButtonText}>💳 View Wallet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/profile')}
              >
                <Text style={styles.actionButtonText}>⚙️ Connect Accounts</Text>
              </TouchableOpacity>
            </View>

            {/* Profile Info */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your Profile</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Role:</Text>
                <Text style={styles.infoValue}>{user?.role?.toUpperCase()}</Text>
              </View>
              {wallet?.primary_coin_value_usd && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Coin Value:</Text>
                  <Text style={styles.infoValue}>
                    ${wallet.primary_coin_value_usd.toFixed(4)} USD
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
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
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    color: '#000',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B00',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: '#FF6B00',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  actionButtonText: {
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
  logoutButton: {
    backgroundColor: '#ff4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
