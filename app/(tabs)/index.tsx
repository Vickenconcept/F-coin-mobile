import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, View, Text } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient } from '../../lib/apiClient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
// @ts-ignore - expo-linear-gradient types
import { LinearGradient } from 'expo-linear-gradient';

type WalletData = {
  balance: number;
  primary_coin: string;
  currency?: string;
  primary_coin_value_usd: number;
  conversion_rate?: number;
  coin_balances?: Array<{
    coin_symbol: string;
    balance: number;
    fiat_value_usd: number;
  }>;
  transactions?: Array<{
    id: string;
    amount: number;
    currency?: string;
    type?: string;
    created_at?: string;
    metadata?: {
      action?: string;
      distributed_by_creator_name?: string;
      from_display_name?: string;
      from_username?: string;
      created_at?: string;
      transacted_at?: string;
    };
    reference?: string;
  }>;
};

type UserStats = {
  followers_count?: number;
  following_count?: number;
};

type RecentEngagement = {
  id: string;
  fanName: string;
  fanUsername: string | null;
  platform: string;
  postTitle: string | null;
  type: string;
  loggedAt: string | null;
  rewardGiven: boolean;
  rewardAmount: number | null;
};

type EarnedCoinEntry = {
  id: string;
  coinSymbol: string;
  displayAmount: string;
  amount: number;
  creatorName: string;
  createdAt: string | null;
};

export default function DashboardScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [recentEngagements, setRecentEngagements] = useState<RecentEngagement[]>([]);
  const [isEngagementsLoading, setIsEngagementsLoading] = useState(false);
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
        : (followersResponse as any)?.meta?.pagination?.total || 0;
      const followingCount = Array.isArray(followingResponse.data) 
        ? followingResponse.data.length 
        : (followingResponse as any)?.meta?.pagination?.total || 0;

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

  const loadRecentEngagements = useCallback(async () => {
    setIsEngagementsLoading(true);
    try {
      const response = await apiClient.get<{ data: any[] }>('/v1/engagements/recent?limit=6');
      
      if (response.ok && Array.isArray(response.data)) {
        const mapped: RecentEngagement[] = response.data.map((item) => {
          const fanName =
            item?.fan?.display_name ??
            item?.fan?.username ??
            item?.metadata?.user?.name ??
            'Fan supporter';

          const platform = (item?.post?.platform ?? item?.provider ?? 'unknown')
            .toString()
            .toLowerCase();

          const fallbackId = `${item?.post?.id ?? 'post'}-${item?.fan?.id ?? Math.random()
            .toString(36)
            .slice(2, 8)}`;

          return {
            id: typeof item?.id === 'string' && item.id.length > 0 ? item.id : fallbackId,
            fanName,
            fanUsername: item?.fan?.username ?? null,
            platform,
            postTitle: item?.post?.title ?? null,
            type: (item?.type ?? '').toString().toUpperCase(),
            loggedAt: item?.logged_at ?? null,
            rewardGiven: Boolean(item?.reward_given),
            rewardAmount:
              typeof item?.reward_amount === 'number'
                ? item.reward_amount
                : item?.reward_amount
                ? Number(item.reward_amount)
                : null,
          };
        });

        setRecentEngagements(mapped);
      }
    } catch (error) {
      console.error('Load recent engagements error:', error);
    } finally {
      setIsEngagementsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadRecentEngagements();
  }, [loadData, loadRecentEngagements]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadRecentEngagements(), refreshUser()]);
    setRefreshing(false);
  }, [loadData, loadRecentEngagements, refreshUser]);

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

  const formatTimeAgo = (isoDate: string | null): string => {
    if (!isoDate) return 'just now';
    try {
      const date = new Date(isoDate);
      if (Number.isNaN(date.getTime())) return 'just now';
      
      const now = Date.now();
      const diffMs = now - date.getTime();
      const diffSeconds = Math.round(diffMs / 1000);
      const absSeconds = Math.abs(diffSeconds);

      if (absSeconds < 60) return 'just now';
      if (absSeconds < 3600) return `${Math.floor(absSeconds / 60)}m ago`;
      if (absSeconds < 86400) return `${Math.floor(absSeconds / 3600)}h ago`;
      if (absSeconds < 604800) return `${Math.floor(absSeconds / 86400)}d ago`;
      return date.toLocaleDateString();
    } catch {
      return 'just now';
    }
  };

  const humanizeEngagementType = (type: string): string => {
    const normalized = type.toUpperCase();
    switch (normalized) {
      case 'COMMENT':
        return 'commented';
      case 'LIKE':
        return 'liked';
      case 'SHARE':
        return 'shared';
      case 'FOLLOW':
        return 'followed';
      default:
        return normalized.toLowerCase();
    }
  };

  // Calculate earned coins from transactions
  const earnedCoinsTotal = useMemo(() => {
    if (!wallet?.transactions || !Array.isArray(wallet.transactions)) {
      return wallet?.balance || 0;
    }

    const totalCredit = wallet.transactions.reduce((sum: number, transaction: any) => {
      const type = (transaction.type ?? '').toString().toUpperCase();
      if (type === 'CREDIT' || type === 'TOPUP') {
        return sum + (Number(transaction.amount) || 0);
      }
      return sum;
    }, 0);

    return totalCredit || wallet.balance || 0;
  }, [wallet]);

  // Calculate earned coin entries
  const earnedCoinEntries = useMemo(() => {
    if (!wallet?.transactions || !Array.isArray(wallet.transactions)) {
      return [];
    }

    const primaryCoinSymbol = (wallet.currency || wallet.primary_coin || 'FCN').toUpperCase();

    return wallet.transactions
      .filter((transaction: any) => {
        const action = String(transaction?.metadata?.action ?? '').toLowerCase();
        return action === 'reward_received';
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(a?.created_at ?? a?.metadata?.created_at ?? 0).getTime();
        const dateB = new Date(b?.created_at ?? b?.metadata?.created_at ?? 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 3)
      .map((transaction: any) => {
        const amount = Number(transaction?.amount ?? 0);
        const metadata = transaction?.metadata ?? {};
        const creatorName =
          metadata.distributed_by_creator_name ??
          metadata.from_display_name ??
          metadata.from_username ??
          'Creator reward';
        const coinSymbol = String(transaction?.currency ?? primaryCoinSymbol).toUpperCase();

        return {
          id: String(transaction?.id ?? `${coinSymbol}-${transaction?.reference ?? Math.random()}`),
          coinSymbol,
          amount,
          displayAmount: formatNumber(amount),
          creatorName,
          createdAt: transaction?.created_at ?? metadata.transacted_at ?? null,
        };
      });
  }, [wallet]);

  const rewardSourceCount = earnedCoinEntries.length;
  const rewardSourceCopy =
    rewardSourceCount > 0
      ? `From ${rewardSourceCount} ${rewardSourceCount === 1 ? 'creator' : 'creators'}`
      : 'Waiting for your first reward';

  const walletCurrency = wallet?.currency || wallet?.primary_coin || 'FCN';
  const poolBalance = wallet?.balance || 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Dashboard</Text>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FF6B00" />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        ) : (
          <>
            {/* Overview Stats Cards - Single Column */}
            <View style={styles.statsContainer}>
              {/* My Coin Pool */}
              <LinearGradient
                colors={['#FF6B00', '#FF8C42']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statCardGradient}
              >
                <View style={styles.statCardContent}>
                  <View style={styles.statCardHeader}>
                    <Text style={styles.statCardLabelWhite}>My Coin Pool</Text>
                    <FontAwesome name="money" size={20} color="#fff" />
                  </View>
                  <Text style={styles.statCardValueWhite}>{formatNumber(poolBalance)}</Text>
                  <Text style={styles.statCardSubtextWhite}>{walletCurrency} available</Text>
                </View>
              </LinearGradient>

              {/* Stats Row */}
              <View style={styles.statsRow}>
                {/* My Followers */}
                <View style={styles.statCard}>
                  <View style={styles.statCardHeader}>
                    <Text style={styles.statCardLabel}>My Followers</Text>
                    <FontAwesome name="users" size={20} color="#FF6B00" />
                  </View>
                  <Text style={styles.statCardValue}>{formatNumber(userStats?.followers_count)}</Text>
                  <Text style={styles.statCardSubtext}>+12 this week</Text>
                </View>

                {/* Earned Coins */}
                <View style={styles.statCard}>
                  <View style={styles.statCardHeader}>
                    <Text style={styles.statCardLabel}>Earned Coins</Text>
                    <FontAwesome name="star" size={20} color="#FF6B00" />
                  </View>
                  <Text style={styles.statCardValue}>{formatNumber(earnedCoinsTotal)}</Text>
                  <Text style={styles.statCardSubtext}>{rewardSourceCopy}</Text>
                </View>
              </View>

              {/* Following */}
              <View style={styles.statCard}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>Following</Text>
                  <FontAwesome name="arrow-up" size={20} color="#FF6B00" />
                </View>
                <Text style={styles.statCardValue}>{formatNumber(userStats?.following_count)}</Text>
                <Text style={styles.statCardSubtext}>Active creators</Text>
              </View>
            </View>

            {/* Sections - Single Column */}
            <View style={styles.sectionsContainer}>
              {/* Recent Engagement on My Posts */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent Engagement on My Posts</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Live Tracking</Text>
                  </View>
                </View>
                {isEngagementsLoading ? (
                  <View style={styles.centerContainer}>
                    <ActivityIndicator size="small" color="#FF6B00" />
                  </View>
                ) : recentEngagements.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      No engagement recorded yet. Share more content and encourage your fans to interact!
                    </Text>
                  </View>
                ) : (
                  <View style={styles.engagementsList}>
                    {recentEngagements.map((item) => {
                      const engagementCopy = `${item.fanName} ${humanizeEngagementType(item.type)} your ${item.platform} post${
                        item.postTitle ? ` "${item.postTitle}"` : ''
                      }.`;

                      return (
                        <View key={item.id} style={styles.engagementItem}>
                          <View style={styles.engagementIcon}>
                            <FontAwesome name="bolt" size={20} color="#fff" />
                          </View>
                          <View style={styles.engagementContent}>
                            <Text style={styles.engagementFanName}>{item.fanName}</Text>
                            <Text style={styles.engagementText}>{engagementCopy}</Text>
                            <View style={styles.engagementMeta}>
                              <View style={styles.platformBadge}>
                                <Text style={styles.platformBadgeText}>{item.platform}</Text>
                              </View>
                              <Text style={styles.engagementTime}>{formatTimeAgo(item.loggedAt)}</Text>
                              <View style={[styles.rewardBadge, item.rewardGiven ? styles.rewardBadgeSuccess : styles.rewardBadgePending]}>
                                <Text style={styles.rewardBadgeText}>{item.rewardGiven ? 'Rewarded' : 'Pending'}</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => router.push('/(tabs)/settings' as any)}
                >
                  <Text style={styles.viewAllButtonText}>View All Engagement</Text>
                  <FontAwesome name="arrow-right" size={14} color="#FF6B00" />
                </TouchableOpacity>
              </View>

              {/* Coins I've Earned */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Coins I've Earned</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/wallet' as any)}>
                    <Text style={styles.viewAllLink}>View All</Text>
                  </TouchableOpacity>
                </View>
                {loading && earnedCoinEntries.length === 0 ? (
                  <View style={styles.centerContainer}>
                    <ActivityIndicator size="small" color="#FF6B00" />
                  </View>
                ) : earnedCoinEntries.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      No rewards yet. Engage with creators to start earning coins.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.earnedCoinsList}>
                    {earnedCoinEntries.map((coin) => (
                      <View key={coin.id} style={styles.earnedCoinItem}>
                        <View style={styles.earnedCoinIcon}>
                          <Text style={styles.earnedCoinIconText}>{coin.coinSymbol.slice(0, 2)}</Text>
                        </View>
                        <View style={styles.earnedCoinInfo}>
                          <Text style={styles.earnedCoinSymbol}>{coin.coinSymbol}</Text>
                          <Text style={styles.earnedCoinCreator}>{coin.creatorName}</Text>
                        </View>
                        <View style={styles.earnedCoinAmount}>
                          <View style={styles.earnedCoinAmountRow}>
                            <FontAwesome name="star" size={14} color="#FF6B00" />
                            <Text style={styles.earnedCoinAmountText}>{coin.displayAmount}</Text>
                          </View>
                          {coin.createdAt && (
                            <Text style={styles.earnedCoinTime}>{formatTimeAgo(coin.createdAt)}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.redeemButton}
                  onPress={() => router.push('/(tabs)/wallet' as any)}
                >
                  <FontAwesome name="gift" size={16} color="#FF6B00" />
                  <Text style={styles.redeemButtonText}>Redeem Rewards</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActionsCard}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActionsGrid}>
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => router.push('/(tabs)/my-coin' as any)}
                >
                  <LinearGradient
                    colors={['#FF6B00', '#FF8C42']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.quickActionGradient}
                  >
                    <FontAwesome name="money" size={24} color="#fff" />
                    <View style={styles.quickActionTextContainer}>
                      <Text style={styles.quickActionTitle}>Fund My Pool</Text>
                      <Text style={styles.quickActionSubtitle}>Add more {walletCurrency}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionButtonOutline}
                  onPress={() => router.push('/discover')}
                >
                  <FontAwesome name="search" size={24} color="#000" />
                  <View style={styles.quickActionTextContainer}>
                    <Text style={styles.quickActionTitleOutline}>Discover Creators</Text>
                    <Text style={styles.quickActionSubtitleOutline}>Find new people to follow</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionButtonOutline}
                  onPress={() => router.push('/(tabs)/settings' as any)}
                >
                  <FontAwesome name="plug" size={24} color="#000" />
                  <View style={styles.quickActionTextContainer}>
                    <Text style={styles.quickActionTitleOutline}>Connect Platforms</Text>
                    <Text style={styles.quickActionSubtitleOutline}>Link more social accounts</Text>
                  </View>
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#f0f2f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 24,
  },
  statsContainer: {
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCardGradient: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE5D4',
  },
  statCardContent: {
    flex: 1,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statCardLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  statCardLabelWhite: {
    fontSize: 14,
    color: '#fff',
  },
  statCardValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  statCardValueWhite: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statCardSubtext: {
    fontSize: 12,
    color: '#64748B',
  },
  statCardSubtextWhite: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.95)',
  },
  sectionsContainer: {
    marginBottom: 24,
  },
  sectionCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE5D4',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    backgroundColor: '#FFF4ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFE5D4',
  },
  badgeText: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '600',
  },
  engagementsList: {
    gap: 12,
  },
  engagementItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#FFF4ED',
    borderRadius: 12,
    marginBottom: 12,
  },
  engagementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  engagementContent: {
    flex: 1,
    minWidth: 0,
  },
  engagementFanName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  engagementText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    flexShrink: 1,
  },
  engagementMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  platformBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFE5D4',
    backgroundColor: '#fff',
  },
  platformBadgeText: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'capitalize',
  },
  engagementTime: {
    fontSize: 11,
    color: '#64748B',
  },
  rewardBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rewardBadgeSuccess: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  rewardBadgePending: {
    backgroundColor: '#FFF4ED',
    borderWidth: 1,
    borderColor: '#FFE5D4',
  },
  rewardBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FFE5D4',
    borderRadius: 8,
    gap: 8,
  },
  viewAllButtonText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
  },
  viewAllLink: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
  },
  earnedCoinsList: {
    gap: 12,
  },
  earnedCoinItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF4ED',
    borderRadius: 12,
    gap: 12,
    marginBottom: 12,
  },
  earnedCoinIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  earnedCoinIconText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  earnedCoinInfo: {
    flex: 1,
    minWidth: 0,
  },
  earnedCoinSymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  earnedCoinCreator: {
    fontSize: 12,
    color: '#64748B',
  },
  earnedCoinAmount: {
    alignItems: 'flex-end',
  },
  earnedCoinAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  earnedCoinAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B00',
  },
  earnedCoinTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  redeemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FFE5D4',
    borderRadius: 8,
    gap: 8,
  },
  redeemButtonText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
  },
  quickActionsCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE5D4',
    marginBottom: 16,
  },
  quickActionsGrid: {
    gap: 12,
    marginTop: 12,
  },
  quickActionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  quickActionButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE5D4',
    borderRadius: 12,
    gap: 12,
  },
  quickActionTextContainer: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  quickActionTitleOutline: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  quickActionSubtitleOutline: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyState: {
    padding: 24,
    backgroundColor: '#FFF4ED',
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
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
    backgroundColor: '#EF4444',
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
