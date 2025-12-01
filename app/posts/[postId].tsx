import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { apiClient } from '../../lib/apiClient';
import Toast from 'react-native-toast-message';
import { PostDetailModal } from '../../components/PostDetailModal';
import { useAuth } from '../../context/AuthContext';

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
  shared_post?: FeedPost;
  created_at: string;
  updated_at: string;
};

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<string | null>(null);

  useEffect(() => {
    if (postId) {
      loadPost();
    }
  }, [postId]);

  const loadPost = async () => {
    if (!postId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<FeedPost>(`/v1/feed/posts/${postId}`);

      if (response.ok && response.data) {
        setPost(response.data);
      } else {
        const errorMsg = response.errors?.[0]?.detail || 'Post not found';
        setError(errorMsg);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMsg,
          visibilityTime: 3000,
        });
      }
    } catch (err) {
      console.error('Load post error:', err);
      setError('Failed to load post');
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load post',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePost = (updatedPost: Partial<FeedPost>) => {
    if (post) {
      setPost({ ...post, ...updatedPost });
    }
  };

  const handleLike = async (postIdToLike: string) => {
    if (isLiking || !post) return;

    setIsLiking(postIdToLike);

    // Optimistic update
    const currentIsLiked = post.is_liked ?? false;
    const newIsLiked = !currentIsLiked;
    const newLikesCount = newIsLiked
      ? (post.likes_count || 0) + 1
      : Math.max(0, (post.likes_count || 0) - 1);

    setPost({
      ...post,
      likes_count: newLikesCount,
      is_liked: newIsLiked,
    });

    try {
      const response = await apiClient.request<{ is_liked: boolean; likes_count: number }>(
        `/v1/feed/posts/${postIdToLike}/like`,
        {
          method: newIsLiked ? 'POST' : 'DELETE',
        }
      );

      if (response.ok && response.data) {
        setPost({
          ...post,
          likes_count: response.data.likes_count,
          is_liked: response.data.is_liked,
        });
      } else {
        // Revert on error
        setPost({
          ...post,
          likes_count: post.likes_count,
          is_liked: post.is_liked,
        });
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to like post',
          visibilityTime: 2000,
        });
      }
    } catch (err) {
      console.error('Like error:', err);
      // Revert on error
      setPost({
        ...post,
        likes_count: post.likes_count,
        is_liked: post.is_liked,
      });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to like post',
        visibilityTime: 2000,
      });
    } finally {
      setIsLiking(null);
    }
  };

  const handleShare = (postToShare: FeedPost) => {
    // This will be handled by PostDetailModal's share modal
    setIsSharing(postToShare.id);
  };

  const handleOpenProfile = (userId: string) => {
    if (post) {
      router.push(`/${post.user.username}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Post',
            headerShown: true,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading post...</Text>
        </View>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Post',
            headerShown: true,
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Post not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPost}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Post',
          headerShown: true,
        }}
      />
      <PostDetailModal
        visible={true}
        onClose={() => router.back()}
        post={post}
        onUpdatePost={handleUpdatePost}
        onLike={handleLike}
        onShare={handleShare}
        onOpenProfile={handleOpenProfile}
        isLiking={isLiking === post.id}
        isSharing={isSharing === post.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FF6B00',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
