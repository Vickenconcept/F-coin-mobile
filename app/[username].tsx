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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/apiClient';
import Toast from 'react-native-toast-message';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { FeedMediaGrid } from '../components/FeedMediaGrid';
import { MentionText } from '../components/MentionText';
import { ImageZoomViewer } from '../components/ImageZoomViewer';
import { Video, ResizeMode } from 'expo-av';

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

              {/* Post Content */}
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
                <TouchableOpacity style={styles.actionButton}>
                  <FontAwesome name="share" size={20} color="#666" />
                  <Text style={styles.actionText}>{post.shares_count}</Text>
                </TouchableOpacity>
                {post.reward_enabled && (
                  <View style={styles.rewardBadge}>
                    <FontAwesome name="dollar" size={14} color="#FF6B00" />
                    <Text style={styles.rewardText}> {post.reward_pool}</Text>
                  </View>
                )}
              </View>
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
});

