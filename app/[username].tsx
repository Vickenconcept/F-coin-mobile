import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import Toast from 'react-native-toast-message';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { FeedMediaGrid } from '../components/FeedMediaGrid';
import { MentionText } from '../components/MentionText';
import { ImageZoomViewer } from '../components/ImageZoomViewer';
import { ShareModal } from '../components/ShareModal';
import { Video, ResizeMode } from 'expo-av';
import { Clipboard } from 'react-native';

type FeedPost = {
  id: string;
  content: string | null;
  visibility: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reward_enabled: boolean;
  reward_pool: number;
  reward_coin_symbol?: string | null;
  reward_rule?: {
    like?: number;
    comment?: number;
    share?: number;
    per_user_cap?: number;
  } | null;
  is_liked: boolean;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    verified_creator: boolean;
  };
  media: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail_url: string | null;
    metadata: Record<string, unknown> | null;
  }>;
  shared_post?: FeedPost; // Recursive type for shared posts
  created_at: string;
  updated_at: string;
};

type ProfileData = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified_creator: boolean;
  default_coin_symbol: string | null;
  profile_bio?: string | null;
  profile_location?: string | null;
  profile_links?: Array<{ label: string; url: string }> | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  reward_posts_count: number;
  reward_pool_total: number;
  joined_at?: string | null;
  is_current_user: boolean;
  is_following: boolean;
  coins: Array<{
    symbol: string;
    name: string | null;
    description: string | null;
  }>;
  recent_posts: FeedPost[];
  posts_pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

type FilterType = 'all' | 'rewards' | 'media';

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerMedia, setImageViewerMedia] = useState<Array<{ url: string; type: 'image' | 'video' }>>([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [imageScale] = useState(new Animated.Value(1));
  const [imageTranslateX] = useState(new Animated.Value(0));
  const [imageTranslateY] = useState(new Animated.Value(0));
  const [lastScale] = useState({ value: 1 });
  const [lastTranslate] = useState({ x: 0, y: 0 });
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [postToShare, setPostToShare] = useState<FeedPost | null>(null);
  
  // Post management states
  const [postUpdating, setPostUpdating] = useState<Record<string, boolean>>({});
  const [postDeleting, setPostDeleting] = useState<Record<string, boolean>>({});
  const [rewardToggleLoading, setRewardToggleLoading] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [editPostContent, setEditPostContent] = useState('');
  const [enableRewardsModalPost, setEnableRewardsModalPost] = useState<FeedPost | null>(null);
  const [walletCoins, setWalletCoins] = useState<Array<{ coin_symbol: string; balance: number }>>([]);
  const [isWalletCoinsLoading, setIsWalletCoinsLoading] = useState(false);
  const [enableRewardsForm, setEnableRewardsForm] = useState({
    reward_pool: 0,
    reward_coin_symbol: (user?.default_coin_symbol ?? 'FCN').toUpperCase(),
    like: 1,
    comment: 2,
    share: 3,
    per_user_cap: 10,
  });

  const fetchProfile = useCallback(async () => {
    if (!username) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('filter', activeFilter);
      params.set('page', '1');
      params.set('per_page', '10');

      const response = await apiClient.get<ProfileData>(
        `/v1/profiles/${username}?${params.toString()}`
      );

      if (response.ok && response.data) {
        setProfile(response.data);
      } else {
        setError(response.errors?.[0]?.detail || 'Unable to load profile');
        setProfile(null);
      }
    } catch (err) {
      console.error('[Profile] fetch error', err);
      setError('Unable to load profile right now.');
      setProfile(null);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [username, activeFilter]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile();
  }, [fetchProfile]);

  const handleFollowToggle = useCallback(async () => {
    if (!profile || profile.is_current_user) return;
    setIsFollowLoading(true);
    try {
      if (profile.is_following) {
        const response = await apiClient.delete(`/v1/users/${profile.id}/follow`);
        if (!response.ok) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: response.errors?.[0]?.detail || 'Failed to unfollow',
            visibilityTime: 3000,
          });
          return;
        }
        setProfile({
          ...profile,
          is_following: false,
          followers_count: Math.max(0, profile.followers_count - 1),
        });
      } else {
        const response = await apiClient.post('/v1/follows', { creator_id: profile.id });
        if (!response.ok) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: response.errors?.[0]?.detail || 'Failed to follow',
            visibilityTime: 3000,
          });
          return;
        }
        setProfile({
          ...profile,
          is_following: true,
          followers_count: profile.followers_count + 1,
        });
        Toast.show({
          type: 'success',
          text1: 'Following!',
          text2: 'You will now see their posts first.',
          visibilityTime: 2000,
        });
      }
    } catch (err) {
      console.error('[Profile] follow toggle error', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Unable to update follow status',
        visibilityTime: 3000,
      });
    } finally {
      setIsFollowLoading(false);
    }
  }, [profile]);

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

  const handleLike = async (post: FeedPost) => {
    try {
      const response = await apiClient.post<{ liked: boolean; likes_count: number }>(
        `/v1/feed/posts/${post.id}/like`
      );

      if (response.ok && response.data) {
        setProfile((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            recent_posts: prev.recent_posts.map((p) =>
              p.id === post.id
                ? {
                    ...p,
                    is_liked: response.data!.liked,
                    likes_count: response.data!.likes_count,
                  }
                : p
            ),
          };
        });
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleShare = (post: FeedPost) => {
    setPostToShare(post);
    setShareModalVisible(true);
  };

  const handleCopyPostLink = (post: FeedPost) => {
    const postUrl = `https://fcoin.app/posts/${post.id}`;
    Clipboard.setString(postUrl);
    Toast.show({
      type: 'success',
      text1: 'Link Copied',
      text2: 'Post link copied to clipboard!',
      visibilityTime: 2000,
    });
  };

  const handleShareToTimeline = async (postId: string, comment?: string) => {
    try {
      const response = await apiClient.post<{ 
        id: string; 
        shares_count: number;
        shared_post?: FeedPost;
      }>(
        `/v1/feed/posts/${postId}/share`,
        { comment, share_to_timeline: true }
      );

      if (response.ok && response.data) {
        setProfile((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            recent_posts: prev.recent_posts.map((p) =>
              p.id === postId
                ? { ...p, shares_count: response.data!.shares_count }
                : p
            ),
          };
        });
        
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Post shared to your timeline!',
          visibilityTime: 2000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to share post',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to share post',
        visibilityTime: 3000,
      });
    }
  };

  const updateLocalPost = useCallback((updatedPost: FeedPost) => {
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        recent_posts: prev.recent_posts.map((post) =>
          post.id === updatedPost.id ? updatedPost : post
        ),
      };
    });
  }, []);

  const removeLocalPost = useCallback((postId: string, wasRewarded: boolean, rewardPool: number) => {
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        posts_count: Math.max(0, prev.posts_count - 1),
        reward_posts_count: wasRewarded ? Math.max(0, prev.reward_posts_count - 1) : prev.reward_posts_count,
        reward_pool_total: wasRewarded ? Math.max(0, prev.reward_pool_total - rewardPool) : prev.reward_pool_total,
        recent_posts: prev.recent_posts.filter((post) => post.id !== postId),
      };
    });
  }, []);

  const handlePostUpdate = useCallback(
    async (postId: string, data: Partial<Pick<FeedPost, 'content' | 'visibility' | 'reward_enabled' | 'reward_rule' | 'reward_coin_symbol' | 'reward_pool'>>) => {
      setPostUpdating((prev) => ({ ...prev, [postId]: true }));
      try {
        const response = await apiClient.put<FeedPost>(`/v1/feed/posts/${postId}`, data);

        if (response.ok && response.data) {
          updateLocalPost(response.data);
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Post updated',
            visibilityTime: 2000,
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: response.errors?.[0]?.detail || 'Failed to update post',
            visibilityTime: 3000,
          });
        }
      } catch (error) {
        console.error('[Profile] update post error', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to update post',
          visibilityTime: 3000,
        });
      } finally {
        setPostUpdating((prev) => {
          const next = { ...prev };
          delete next[postId];
          return next;
        });
      }
    },
    [updateLocalPost],
  );

  const handleDisableRewards = useCallback(
    async (post: FeedPost) => {
      setRewardToggleLoading(post.id);
      await handlePostUpdate(post.id, { reward_enabled: false });
      setRewardToggleLoading(null);
    },
    [handlePostUpdate],
  );

  const handleDeletePost = useCallback(
    async (post: FeedPost) => {
      Alert.alert(
        'Delete Post',
        'Delete this post permanently?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setPostDeleting((prev) => ({ ...prev, [post.id]: true }));
              try {
                const response = await apiClient.delete(`/v1/feed/posts/${post.id}`);

                if (response.ok) {
                  removeLocalPost(post.id, post.reward_enabled, post.reward_pool || 0);
                  Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Post deleted',
                    visibilityTime: 2000,
                  });
                } else {
                  Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: response.errors?.[0]?.detail || 'Failed to delete post',
                    visibilityTime: 3000,
                  });
                }
              } catch (error) {
                console.error('[Profile] delete post error', error);
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: 'Failed to delete post',
                  visibilityTime: 3000,
                });
              } finally {
                setPostDeleting((prev) => {
                  const next = { ...prev };
                  delete next[post.id];
                  return next;
                });
              }
            },
          },
        ]
      );
    },
    [removeLocalPost],
  );

  const handleEditPost = useCallback((post: FeedPost) => {
    setEditingPost(post);
    setEditPostContent(post.content || '');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingPost) return;
    if (!editPostContent.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Post content cannot be empty',
        visibilityTime: 3000,
      });
      return;
    }
    await handlePostUpdate(editingPost.id, { content: editPostContent.trim() });
    setEditingPost(null);
    setEditPostContent('');
  }, [editingPost, editPostContent, handlePostUpdate]);

  const fetchWalletCoins = useCallback(async () => {
    setIsWalletCoinsLoading(true);
    try {
      const response = await apiClient.get<{
        coin_balances?: Array<{ coin_symbol?: string; balance?: number }>;
      }>('/v1/wallets/me');

      if (response.ok && response.data) {
        const balances = Array.isArray(response.data.coin_balances)
          ? response.data.coin_balances
              .map((coin) => ({
                coin_symbol: String(coin.coin_symbol ?? '').toUpperCase(),
                balance: Number(coin.balance ?? 0) || 0,
              }))
              .filter((coin) => coin.coin_symbol)
          : [];

        setWalletCoins(balances);

        if (balances.length > 0) {
          setEnableRewardsForm((prev) => {
            const hasCurrent = balances.some((coin) => coin.coin_symbol === prev.reward_coin_symbol);
            return {
              ...prev,
              reward_coin_symbol: hasCurrent ? prev.reward_coin_symbol : balances[0].coin_symbol,
            };
          });
        }
      }
    } catch (error) {
      console.error('[Profile] wallet coins error', error);
    } finally {
      setIsWalletCoinsLoading(false);
    }
  }, []);

  const openEnableRewardsModal = useCallback(
    (post: FeedPost) => {
      setEnableRewardsModalPost(post);
      setEnableRewardsForm((prev) => ({
        reward_pool: Math.max(post.reward_pool || 0, 10),
        reward_coin_symbol: (post.reward_coin_symbol ?? prev.reward_coin_symbol ?? (user?.default_coin_symbol ?? 'FCN')).toUpperCase(),
        like: post.reward_rule?.like ?? prev.like ?? 1,
        comment: post.reward_rule?.comment ?? prev.comment ?? 2,
        share: post.reward_rule?.share ?? prev.share ?? 3,
        per_user_cap: post.reward_rule?.per_user_cap ?? prev.per_user_cap ?? 10,
      }));
      fetchWalletCoins().catch(() => null);
    },
    [fetchWalletCoins, user?.default_coin_symbol],
  );

  const handleEnableRewardsSubmit = useCallback(async () => {
    if (!enableRewardsModalPost) return;

    if (enableRewardsForm.reward_pool <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Reward pool must be greater than zero',
        visibilityTime: 3000,
      });
      return;
    }

    const selectedCoin = walletCoins.find(
      (coin) => coin.coin_symbol === enableRewardsForm.reward_coin_symbol
    );
    if (!selectedCoin || selectedCoin.balance < enableRewardsForm.reward_pool) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Insufficient balance for selected coin',
        visibilityTime: 3000,
      });
      return;
    }

    setRewardToggleLoading(enableRewardsModalPost.id);
    try {
      await handlePostUpdate(enableRewardsModalPost.id, {
        reward_enabled: true,
        reward_pool: enableRewardsForm.reward_pool,
        reward_coin_symbol: enableRewardsForm.reward_coin_symbol,
        reward_rule: {
          like: enableRewardsForm.like,
          comment: enableRewardsForm.comment,
          share: enableRewardsForm.share,
          per_user_cap: enableRewardsForm.per_user_cap,
        },
      });
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Rewards enabled on this post',
        visibilityTime: 2000,
      });
      setEnableRewardsModalPost(null);
    } catch (error) {
      console.error('[Profile] enable rewards error', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to enable rewards',
        visibilityTime: 3000,
      });
    } finally {
      setRewardToggleLoading(null);
    }
  }, [enableRewardsModalPost, enableRewardsForm, walletCoins, handlePostUpdate]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centerContainer}>
        <FontAwesome name="exclamation-circle" size={48} color="#999" />
        <Text style={styles.errorText}>{error || 'Profile not found'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={16} color="#FF6B00" />
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={20} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Image
            source={{
              uri: profile.avatar_url || 'https://via.placeholder.com/80',
            }}
            style={styles.profileAvatar}
          />
          <View style={styles.profileInfo}>
            <View style={styles.profileUsernameRow}>
              <Text style={styles.profileUsername}>
                {profile.display_name || profile.username}
              </Text>
              {profile.verified_creator && (
                <FontAwesome name="check-circle" size={20} color="#1DA1F2" style={styles.verifiedIcon} />
              )}
            </View>
            <Text style={styles.profileHandle}>@{profile.username}</Text>
            {profile.profile_bio && (
              <Text style={styles.profileBio}>{profile.profile_bio}</Text>
            )}
            {profile.profile_location && (
              <View style={styles.profileMeta}>
                <FontAwesome name="map-marker" size={14} color="#666" />
                <Text style={styles.profileMetaText}>{profile.profile_location}</Text>
              </View>
            )}
            {profile.profile_links && profile.profile_links.length > 0 && (
              <View style={styles.profileLinks}>
                {profile.profile_links.map((link, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      // Open link
                    }}
                  >
                    <Text style={styles.profileLink}>{link.label || link.url}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.posts_count}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.followers_count}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.following_count}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
          {profile.reward_pool_total > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.reward_pool_total}</Text>
              <Text style={styles.statLabel}>Rewards</Text>
            </View>
          )}
        </View>

        {/* Follow Button */}
        {!profile.is_current_user && (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[
                styles.followButton,
                profile.is_following && styles.followButtonFollowing,
              ]}
              onPress={handleFollowToggle}
              disabled={isFollowLoading}
            >
              {isFollowLoading ? (
                <ActivityIndicator size="small" color={profile.is_following ? '#666' : '#fff'} />
              ) : (
                <>
                  <FontAwesome
                    name={profile.is_following ? 'user-times' : 'user-plus'}
                    size={16}
                    color={profile.is_following ? '#666' : '#fff'}
                  />
                  <Text
                    style={[
                      styles.followButtonText,
                      profile.is_following && styles.followButtonTextFollowing,
                    ]}
                  >
                    {profile.is_following ? 'Unfollow' : 'Follow'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text
              style={[styles.filterTabText, activeFilter === 'all' && styles.filterTabTextActive]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'rewards' && styles.filterTabActive]}
            onPress={() => setActiveFilter('rewards')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'rewards' && styles.filterTabTextActive,
              ]}
            >
              Rewards
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'media' && styles.filterTabActive]}
            onPress={() => setActiveFilter('media')}
          >
            <Text
              style={[styles.filterTabText, activeFilter === 'media' && styles.filterTabTextActive]}
            >
              Media
            </Text>
          </TouchableOpacity>
        </View>

        {/* Posts */}
        {profile.recent_posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        ) : (
          profile.recent_posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              {/* Post Header */}
              <View style={styles.postHeader}>
                <Image
                  source={{
                    uri: post.user.avatar_url || 'https://via.placeholder.com/40',
                  }}
                  style={styles.avatar}
                />
                <View style={styles.postHeaderInfo}>
                  <View style={styles.postUsernameContainer}>
                    <Text style={styles.postUsername}>
                      {post.user.display_name || post.user.username}
                    </Text>
                    {post.user.verified_creator && (
                      <FontAwesome name="check-circle" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
                    )}
                  </View>
                  <Text style={styles.postTime}>{formatTime(post.created_at)}</Text>
                </View>
              </View>

              {/* Share Header - if this is a shared post */}
              {post.shared_post && (
                <View style={styles.shareHeader}>
                  <View style={styles.shareHeaderContent}>
                    <FontAwesome name="share" size={14} color="#FF6B00" />
                    <Text style={styles.shareHeaderText}>
                      {post.user.display_name || post.user.username} shared a post
                    </Text>
                  </View>
                  {post.content && (
                    <View style={styles.shareComment}>
                      <MentionText text={post.content} style={styles.shareCommentText} />
                    </View>
                  )}
                </View>
              )}

              {/* Post Content */}
              {post.shared_post ? (
                // Show shared post content in an embedded card
                <View style={styles.sharedPostCard}>
                  <View style={styles.sharedPostHeader}>
                    <TouchableOpacity
                      onPress={() => router.push(`/${post.shared_post!.user.username}` as any)}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{
                          uri: post.shared_post!.user.avatar_url || 'https://via.placeholder.com/40',
                        }}
                        style={styles.avatar}
                      />
                    </TouchableOpacity>
                    <View style={styles.postHeaderInfo}>
                      <TouchableOpacity
                        onPress={() => router.push(`/${post.shared_post!.user.username}` as any)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.postUsernameContainer}>
                          <Text style={styles.postUsername}>
                            {post.shared_post!.user.display_name || post.shared_post!.user.username}
                          </Text>
                          {post.shared_post!.user.verified_creator && (
                            <FontAwesome name="check-circle" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
                          )}
                        </View>
                      </TouchableOpacity>
                      <Text style={styles.postTime}>{formatTime(post.shared_post!.created_at)}</Text>
                    </View>
                  </View>
                  {post.shared_post.content && (
                    <TouchableOpacity
                      onPress={() => {
                        setExpandedPosts((prev) => ({
                          ...prev,
                          [post.shared_post!.id]: !prev[post.shared_post!.id],
                        }));
                      }}
                      activeOpacity={0.7}
                    >
                      <MentionText
                        text={post.shared_post.content}
                        style={styles.postContent}
                        numberOfLines={expandedPosts[post.shared_post.id] ? undefined : 3}
                      />
                      {post.shared_post.content.length > 150 && (
                        <Text style={styles.showMoreText}>
                          {expandedPosts[post.shared_post.id] ? 'Show less' : 'Show more'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {post.shared_post.media.length > 0 && (
                    <FeedMediaGrid
                      media={post.shared_post.media}
                      onImagePress={(index: number) => {
                        setImageViewerMedia(post.shared_post!.media.map((m) => ({ url: m.url, type: m.type })));
                        setImageViewerIndex(index);
                        setImageViewerVisible(true);
                      }}
                    />
                  )}
                </View>
              ) : (
                <>
                  {/* Regular post content */}
                  {post.content && (
                    <TouchableOpacity
                      onPress={() => {
                        setExpandedPosts((prev) => ({
                          ...prev,
                          [post.id]: !prev[post.id],
                        }));
                      }}
                      activeOpacity={0.7}
                    >
                      <MentionText
                        text={post.content}
                        style={styles.postContent}
                        numberOfLines={expandedPosts[post.id] ? undefined : 3}
                      />
                      {post.content.length > 150 && (
                        <Text style={styles.showMoreText}>
                          {expandedPosts[post.id] ? 'Show less' : 'Show more'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Post Media */}
                  {post.media.length > 0 && (
                    <FeedMediaGrid
                      media={post.media}
                      onImagePress={(index: number) => {
                        setImageViewerMedia(post.media.map((m) => ({ url: m.url, type: m.type })));
                        setImageViewerIndex(index);
                        setImageViewerVisible(true);
                      }}
                    />
                  )}
                </>
              )}

              {/* Post Actions */}
              <View style={styles.postActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleLike(post)}
                >
                  <FontAwesome
                    name={post.is_liked ? 'heart' : 'heart-o'}
                    size={20}
                    color={post.is_liked ? '#FF6B00' : '#666'}
                  />
                  <Text style={styles.actionText}>{post.likes_count}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <FontAwesome name="comment-o" size={20} color="#666" />
                  <Text style={styles.actionText}>{post.comments_count}</Text>
                </TouchableOpacity>
                <View style={styles.shareActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleShare(post)}
                  >
                    <FontAwesome name="share" size={20} color="#666" />
                    <Text style={styles.actionText}>{post.shares_count}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.copyLinkButton}
                    onPress={() => handleCopyPostLink(post)}
                  >
                    <FontAwesome name="link" size={16} color="#666" />
                  </TouchableOpacity>
                </View>
                {post.reward_enabled && (
                  <View style={styles.rewardBadge}>
                    <FontAwesome name="dollar" size={14} color="#FF6B00" />
                    <Text style={styles.rewardText}> {post.reward_pool}</Text>
                  </View>
                )}
              </View>

              {/* Post Management (only for own posts) */}
              {profile.is_current_user && (
                <View style={styles.postManagement}>
                  <View style={styles.managementRow}>
                    <Text style={styles.managementLabel}>Visibility:</Text>
                    <View style={styles.visibilityButtons}>
                      {(['public', 'followers', 'private'] as const).map((vis) => (
                        <TouchableOpacity
                          key={vis}
                          style={[
                            styles.visibilityButton,
                            post.visibility === vis && styles.visibilityButtonActive,
                            postUpdating[post.id] && styles.visibilityButtonDisabled,
                          ]}
                          onPress={() => handlePostUpdate(post.id, { visibility: vis })}
                          disabled={postUpdating[post.id]}
                        >
                          <FontAwesome
                            name={vis === 'public' ? 'globe' : vis === 'followers' ? 'users' : 'lock'}
                            size={14}
                            color={post.visibility === vis ? '#fff' : '#666'}
                          />
                          <Text
                            style={[
                              styles.visibilityButtonText,
                              post.visibility === vis && styles.visibilityButtonTextActive,
                            ]}
                          >
                            {vis.charAt(0).toUpperCase() + vis.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.managementActions}>
                    <TouchableOpacity
                      style={styles.managementButton}
                      onPress={() => handleEditPost(post)}
                    >
                      <FontAwesome name="edit" size={14} color="#666" />
                      <Text style={styles.managementButtonText}>Edit</Text>
                    </TouchableOpacity>
                    {post.reward_enabled ? (
                      <TouchableOpacity
                        style={styles.managementButton}
                        onPress={() => handleDisableRewards(post)}
                        disabled={rewardToggleLoading === post.id}
                      >
                        {rewardToggleLoading === post.id ? (
                          <ActivityIndicator size="small" color="#666" />
                        ) : (
                          <FontAwesome name="dollar" size={14} color="#666" />
                        )}
                        <Text style={styles.managementButtonText}>Disable Rewards</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.managementButton, styles.managementButtonPrimary]}
                        onPress={() => openEnableRewardsModal(post)}
                        disabled={rewardToggleLoading === post.id}
                      >
                        {rewardToggleLoading === post.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <FontAwesome name="dollar" size={14} color="#fff" />
                        )}
                        <Text style={[styles.managementButtonText, styles.managementButtonTextPrimary]}>
                          Enable Rewards
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.managementButton, styles.managementButtonDanger]}
                      onPress={() => handleDeletePost(post)}
                      disabled={postDeleting[post.id]}
                    >
                      {postDeleting[post.id] ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <FontAwesome name="trash" size={14} color="#fff" />
                      )}
                      <Text style={[styles.managementButtonText, styles.managementButtonTextDanger]}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Image Viewer */}
      <ImageZoomViewer
        visible={imageViewerVisible}
        onClose={() => {
          setImageViewerVisible(false);
          imageScale.setValue(1);
          imageTranslateX.setValue(0);
          imageTranslateY.setValue(0);
          lastScale.value = 1;
          lastTranslate.x = 0;
          lastTranslate.y = 0;
        }}
        media={imageViewerMedia}
        initialIndex={imageViewerIndex}
        onIndexChange={(index) => {
          setImageViewerIndex(index);
          imageScale.setValue(1);
          imageTranslateX.setValue(0);
          imageTranslateY.setValue(0);
          lastScale.value = 1;
          lastTranslate.x = 0;
          lastTranslate.y = 0;
        }}
        imageScale={imageScale}
        imageTranslateX={imageTranslateX}
        imageTranslateY={imageTranslateY}
        lastScale={lastScale}
        lastTranslate={lastTranslate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  errorTextForm: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerSpacer: {
    width: 40,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#FF6B00',
    fontSize: 14,
    marginTop: 8,
  },
  profileHeader: {
    padding: 16,
    flexDirection: 'row',
    gap: 16,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
  },
  profileInfo: {
    flex: 1,
  },
  profileUsernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileUsername: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  profileHandle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  profileBio: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
    lineHeight: 20,
  },
  profileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  profileMetaText: {
    fontSize: 14,
    color: '#666',
  },
  profileLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  profileLink: {
    fontSize: 14,
    color: '#1DA1F2',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionContainer: {
    padding: 16,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  followButtonFollowing: {
    backgroundColor: '#f0f0f0',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  followButtonTextFollowing: {
    color: '#666',
  },
  filterContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: '#FF6B00',
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  postCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  postHeaderInfo: {
    flex: 1,
  },
  postUsernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postUsername: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  postTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  shareHeader: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B00',
  },
  shareHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  shareHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  shareComment: {
    marginTop: 4,
  },
  shareCommentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  sharedPostCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    marginTop: 8,
    width: '100%',
    alignSelf: 'stretch',
  },
  sharedPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  postContent: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    marginBottom: 4,
  },
  showMoreText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#666',
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  rewardText: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '600',
  },
  shareActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyLinkButton: {
    padding: 4,
  },
  postManagement: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  managementRow: {
    marginBottom: 12,
  },
  managementLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  visibilityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  visibilityButtonActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  visibilityButtonDisabled: {
    opacity: 0.5,
  },
  visibilityButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  visibilityButtonTextActive: {
    color: '#fff',
  },
  managementActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  managementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  managementButtonPrimary: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  managementButtonDanger: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  managementButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  managementButtonTextPrimary: {
    color: '#fff',
  },
  managementButtonTextDanger: {
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalScrollContent: {
    paddingBottom: 20,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalBody: {
    padding: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#FF6B00',
  },
  modalButtonSecondary: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSecondary: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  formHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  coinSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  coinOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
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
  },
  rewardInputs: {
    gap: 12,
  },
  rewardInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rewardInputLabel: {
    fontSize: 14,
    color: '#666',
    width: 80,
  },
  rewardInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  loadingSpinner: {
    padding: 40,
  },
});

