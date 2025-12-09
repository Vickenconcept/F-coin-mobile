import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import Toast from 'react-native-toast-message';
import FontAwesome from '@expo/vector-icons/FontAwesome';

type RecentEngagement = {
  id: string;
  fanName?: string;
  creatorName?: string;
  fanUsername: string | null;
  platform: string;
  pageName?: string | null;
  postTitle: string | null;
  type: string;
  loggedAt: string | null;
  rewardGiven: boolean;
  rewardAmount: number | null;
  status?: string;
  status_reason?: string;
};

function humanizeEngagementType(type: string): string {
  const upperType = type.toUpperCase();
  if (upperType === 'LIKE') return 'liked';
  if (upperType === 'COMMENT') return 'commented on';
  if (upperType === 'SHARE') return 'shared';
  if (upperType === 'WATCH') return 'watched';
  return 'engaged with';
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Just now';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  } catch {
    return 'Just now';
  }
}

export default function EngagementsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'on-my-posts' | 'my-engagements'>('on-my-posts');
  
  // Creator view: engagements on their posts
  const [creatorEngagements, setCreatorEngagements] = useState<RecentEngagement[]>([]);
  const [isCreatorLoading, setIsCreatorLoading] = useState(true);
  const [creatorRefreshing, setCreatorRefreshing] = useState(false);
  
  // Fan view: their own engagements
  const [fanEngagements, setFanEngagements] = useState<RecentEngagement[]>([]);
  const [isFanLoading, setIsFanLoading] = useState(true);
  const [fanRefreshing, setFanRefreshing] = useState(false);

  const loadCreatorEngagements = useCallback(async () => {
    setIsCreatorLoading(true);
    try {
      const response = await apiClient.get<{ data: any[] }>(`/v1/engagements/recent?limit=50`);
      
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
          const pageName = item?.post?.page_name ?? null;

          return {
            id: typeof item?.id === 'string' && item.id.length > 0 ? item.id : `${item?.post?.id ?? 'post'}-${item?.fan?.id ?? Math.random().toString(36).slice(2, 8)}`,
            fanName,
            fanUsername: item?.fan?.username ?? null,
            platform,
            pageName,
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
            status: item?.status || (item?.reward_given ? 'rewarded' : 'pending'),
            status_reason: item?.status_reason || null,
          };
        });

        setCreatorEngagements(mapped);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Unable to load engagements',
        });
      }
    } catch (error) {
      console.error('Load creator engagements error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load engagements',
      });
    } finally {
      setIsCreatorLoading(false);
    }
  }, []);

  const loadFanEngagements = useCallback(async () => {
    setIsFanLoading(true);
    try {
      // Ensure token is loaded before making request
      await apiClient.loadToken?.();
      
      const response = await apiClient.get<{ data: any[] }>(`/v1/engagements/my?limit=50`);
      
      console.log('My Engagements API Response:', {
        ok: response.ok,
        status: response.status,
        hasData: !!response.data,
        dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        errors: response.errors,
        raw: response.raw,
      });
      
      // Handle non-OK responses
      if (!response.ok) {
        // Don't show error for 401/403 - might be auth issue
        if (response.status === 401 || response.status === 403) {
          console.warn('My Engagements: Authentication issue', response.errors);
          setFanEngagements([]);
          return;
        }
        
        const errorMessage = response.errors?.[0]?.detail || `Unable to load your engagements (${response.status})`;
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMessage,
        });
        setFanEngagements([]);
        return;
      }
      
      // Handle successful response
      if (Array.isArray(response.data)) {
        // Empty array is valid - user just has no engagements yet
        const mapped: RecentEngagement[] = response.data.map((item) => {
          const creatorName =
            item?.creator?.display_name ??
            item?.creator?.username ??
            'Creator';

          const platform = (item?.post?.platform ?? item?.provider ?? 'unknown')
            .toString()
            .toLowerCase();
          const pageName = item?.post?.page_name ?? null;

          return {
            id: typeof item?.id === 'string' && item.id.length > 0 ? item.id : `${item?.post?.id ?? 'post'}-${Math.random().toString(36).slice(2, 8)}`,
            creatorName,
            fanUsername: null,
            platform,
            pageName,
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
            status: item?.status || (item?.reward_given ? 'rewarded' : 'pending'),
            status_reason: item?.status_reason || null,
          };
        });

        setFanEngagements(mapped);
        console.log(`My Engagements: Loaded ${mapped.length} engagements`);
      } else if (response.data === null || response.data === undefined) {
        // Empty response is valid - user has no engagements
        console.log('My Engagements: No engagements found (empty response)');
        setFanEngagements([]);
      } else {
        console.warn('My Engagements: Response data is not an array', {
          data: response.data,
          dataType: typeof response.data,
        });
        setFanEngagements([]);
      }
    } catch (error) {
      console.error('Load fan engagements error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load your engagements';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
      setFanEngagements([]);
    } finally {
      setIsFanLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'on-my-posts') {
      loadCreatorEngagements();
    } else {
      loadFanEngagements();
    }
  }, [activeTab, loadCreatorEngagements, loadFanEngagements]);

  const onRefresh = useCallback(async () => {
    if (activeTab === 'on-my-posts') {
      setCreatorRefreshing(true);
      await loadCreatorEngagements();
      setCreatorRefreshing(false);
    } else {
      setFanRefreshing(true);
      await loadFanEngagements();
      setFanRefreshing(false);
    }
  }, [activeTab, loadCreatorEngagements, loadFanEngagements]);

  const currentEngagements = activeTab === 'on-my-posts' ? creatorEngagements : fanEngagements;
  const isLoading = activeTab === 'on-my-posts' ? isCreatorLoading : isFanLoading;
  const isRefreshing = activeTab === 'on-my-posts' ? creatorRefreshing : fanRefreshing;

  if (isLoading && currentEngagements.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={20} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>All Engagements</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading engagements...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Engagements</Text>
        <View style={styles.backButton} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'on-my-posts' && styles.tabActive]}
          onPress={() => setActiveTab('on-my-posts')}
        >
          <Text style={[styles.tabText, activeTab === 'on-my-posts' && styles.tabTextActive]}>
            On My Posts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-engagements' && styles.tabActive]}
          onPress={() => setActiveTab('my-engagements')}
        >
          <Text style={[styles.tabText, activeTab === 'my-engagements' && styles.tabTextActive]}>
            My Engagements
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {currentEngagements.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome name="bolt" size={48} color="#cbd5e1" />
            <Text style={styles.emptyStateText}>
              {activeTab === 'on-my-posts'
                ? 'No engagement recorded yet. Share more content and encourage your fans to interact!'
                : 'You haven\'t engaged with any posts yet. Start engaging to earn rewards!'}
            </Text>
          </View>
        ) : (
          <View style={styles.engagementsList}>
            {currentEngagements.map((item) => {
              const isRewarded = item.status === 'rewarded' || item.rewardGiven;
              const isNotEligible = item.status === 'not_eligible';
              
              // Different text for creator vs fan view
              let engagementCopy = '';
              const platformDisplay = item.pageName 
                ? `${item.pageName} (${capitalize(item.platform)})`
                : capitalize(item.platform);
              
              if (activeTab === 'on-my-posts') {
                engagementCopy = `${item.fanName} ${humanizeEngagementType(item.type)} your ${platformDisplay} post${
                  item.postTitle ? ` "${item.postTitle}"` : ''
                }.`;
              } else {
                engagementCopy = `You ${humanizeEngagementType(item.type)} ${item.creatorName}'s ${platformDisplay} post${
                  item.postTitle ? ` "${item.postTitle}"` : ''
                }.`;
              }

              return (
                <View key={item.id} style={styles.engagementItem}>
                  <View style={styles.engagementIcon}>
                    <FontAwesome name="bolt" size={20} color="#fff" />
                  </View>
                  <View style={styles.engagementContent}>
                    <Text style={styles.engagementFanName}>
                      {activeTab === 'on-my-posts' ? item.fanName : item.creatorName}
                    </Text>
                    <Text style={styles.engagementText}>{engagementCopy}</Text>
                    <View style={styles.engagementMeta}>
                      <View style={styles.platformBadge}>
                        <Text style={styles.platformBadgeText}>
                          {item.pageName ? `${item.pageName} • ${item.platform}` : item.platform}
                        </Text>
                      </View>
                      <Text style={styles.engagementTime}>{formatTimeAgo(item.loggedAt)}</Text>
                      <View style={[
                        styles.rewardBadge, 
                        isRewarded ? styles.rewardBadgeSuccess : 
                        isNotEligible ? styles.rewardBadgeError : 
                        styles.rewardBadgePending
                      ]}>
                        <Text style={[
                          styles.rewardBadgeText,
                          isRewarded ? styles.rewardBadgeTextSuccess :
                          isNotEligible ? styles.rewardBadgeTextError :
                          styles.rewardBadgeTextPending
                        ]}>
                          {isRewarded ? '✓ Rewarded' : isNotEligible ? '✗ Not Eligible' : '⏳ Pending'}
                        </Text>
                      </View>
                    </View>
                    {item.status_reason && !isRewarded && (
                      <Text style={styles.statusReason}>{item.status_reason}</Text>
                    )}
                    {item.rewardAmount && isRewarded && (
                      <Text style={styles.rewardAmount}>
                        +{item.rewardAmount.toFixed(4)} coins
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    color: '#6b7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  engagementsList: {
    gap: 12,
  },
  engagementItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  engagementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  engagementContent: {
    flex: 1,
  },
  engagementFanName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  engagementText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
    lineHeight: 20,
  },
  engagementMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  platformBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  platformBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  engagementTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  rewardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  rewardBadgeSuccess: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
  },
  rewardBadgePending: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  rewardBadgeError: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  rewardBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065f46',
  },
  rewardBadgeTextSuccess: {
    color: '#065f46',
  },
  rewardBadgeTextPending: {
    color: '#92400e',
  },
  rewardBadgeTextError: {
    color: '#991b1b',
  },
  statusReason: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  rewardAmount: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginTop: 4,
  },
});
