import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  FlatList,
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  PanResponder,
  Animated,
  DeviceEventEmitter,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/apiClient';
import Toast from 'react-native-toast-message';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FeedLayout } from '../../components/FeedLayout';
import { FeedMediaGrid } from '../../components/FeedMediaGrid';
import { MentionText } from '../../components/MentionText';
import { MentionInput } from '../../components/MentionInput';
import { ImageZoomViewer } from '../../components/ImageZoomViewer';
import { ShareModal } from '../../components/ShareModal';
import * as ImagePicker from 'expo-image-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import axios from 'axios';
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

type Comment = {
  id: string;
  content: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  likes_count: number;
  is_liked: boolean;
  parent_id: string | null;
  replies: Array<{
    id: string;
    content: string;
    user: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
    likes_count: number;
    is_liked: boolean;
    created_at: string;
  }>;
  created_at: string;
};

export default function FeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
const params = useLocalSearchParams<{ openPost?: string; commentId?: string; compose?: string; trigger?: string }>();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Real-time updates state
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [latestPostId, setLatestPostId] = useState<string | null>(null);
  const [composerVisible, setComposerVisible] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [postCreationStep, setPostCreationStep] = useState<1 | 2 | 3>(1);
  const [newPostVisibility, setNewPostVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [rewardPool, setRewardPool] = useState<number>(0);
  const [rewardLikeAmount, setRewardLikeAmount] = useState<number>(1);
  const [rewardCommentAmount, setRewardCommentAmount] = useState<number>(2);
  const [rewardShareAmount, setRewardShareAmount] = useState<number>(3);
  const [rewardPerUserCap, setRewardPerUserCap] = useState<number>(10);
  const [rewardCoinSymbol, setRewardCoinSymbol] = useState<string>(
    String((user as any)?.default_coin_symbol ?? 'FCN').toUpperCase()
  );
  const [uploadedMedia, setUploadedMedia] = useState<Array<{
    type: 'image' | 'video';
    url: string;
    thumbnail_url?: string;
    metadata?: Record<string, unknown>;
  }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [walletCoins, setWalletCoins] = useState<Array<{ coin_symbol: string; balance: number }>>([]);
  const [isWalletCoinsLoading, setIsWalletCoinsLoading] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
  
  // Use ref to avoid stale closure issues with sortBy
  const sortByRef = useRef(sortBy);
  useEffect(() => {
    sortByRef.current = sortBy;
  }, [sortBy]);
  const [postDetailModalVisible, setPostDetailModalVisible] = useState(false);
  const [postDetailPost, setPostDetailPost] = useState<FeedPost | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [postToShare, setPostToShare] = useState<FeedPost | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [likingComment, setLikingComment] = useState<string | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [imageViewerMedia, setImageViewerMedia] = useState<Array<{ url: string; type: 'image' | 'video' }>>([]);
  const [imageScale] = useState(new Animated.Value(1));
  const [imageTranslateX] = useState(new Animated.Value(0));
  const [imageTranslateY] = useState(new Animated.Value(0));
  const [lastScale] = useState({ value: 1 });
  const [lastTranslate] = useState({ x: 0, y: 0 });

  const loadFeed = useCallback(async (page = 1, isRefresh = false) => {
    console.log('Feed: loadFeed called', { page, isRefresh, sortBy: sortByRef.current });

    try {
      if (page === 1) {
        isRefresh ? setRefreshing(true) : setLoading(true);
        setNewPostsCount(0); // Reset new posts count on refresh
      } else {
        setLoadingMore(true);
      }

      console.log('Feed: Making API request', { 
        url: `/v1/feed?sort=${sortByRef.current}&per_page=20&page=${page}`,
        sortBy: sortByRef.current,
        page 
      });

      const response = await apiClient.get<FeedPost[]>(
        `/v1/feed?sort=${sortByRef.current}&per_page=20&page=${page}`
      );

      console.log('Feed: API response received', {
        ok: response.ok,
        status: response.status,
        hasData: !!response.data,
        dataLength: response.data?.length,
        hasMeta: !!response.meta
      });

      if (response.ok && response.data) {
        const newPosts = response.data || [];
        const meta = response.meta as {
          current_page: number;
          last_page: number;
          per_page: number;
          total: number;
        } | undefined;
        
        if (page === 1) {
          setPosts(newPosts);
          // Track the latest post ID for real-time updates
          if (newPosts.length > 0) {
            setLatestPostId(newPosts[0].id);
            setNewPostsCount(0); // Reset new posts count when refreshing
          }
        } else {
          setPosts(prevPosts => [...prevPosts, ...newPosts]);
        }
        
        if (meta) {
          setCurrentPage(meta.current_page);
          setHasMorePages(meta.current_page < meta.last_page);
          
          console.log('Feed loaded:', {
            page: meta.current_page,
            lastPage: meta.last_page,
            hasMore: meta.current_page < meta.last_page,
            postsCount: newPosts.length,
            totalPosts: posts.length + newPosts.length
          });
        } else {
          // Fallback if meta is not available
          console.log('Feed loaded without meta:', {
            postsCount: newPosts.length,
            totalPosts: posts.length + newPosts.length
          });
          setHasMorePages(newPosts.length >= 20); // Assume more pages if we got a full page
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to load feed',
        });
      }
    } catch (error) {
      console.error('Feed load error:', error);
      
      // Show specific error message based on error type
      let errorMessage = 'Failed to load feed';
      if (error && typeof error === 'object' && 'message' in error) {
        const errorObj = error as { message: string };
        if (errorObj.message.includes('Network Error') || errorObj.message.includes('connect')) {
          errorMessage = 'Cannot connect to server. Please check your internet connection.';
        } else if (errorObj.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        }
      }
      
      Toast.show({
        type: 'error',
        text1: 'Connection Error',
        text2: errorMessage,
        visibilityTime: 5000,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []); // No dependencies to prevent infinite loops

  // Test connectivity on component mount
  useEffect(() => {
    const testConnectivity = async () => {
      try {
        console.log('Feed: Testing API connectivity...');
        const response = await apiClient.get('/v1/auth/me');
        console.log('Feed: API connectivity test result:', {
          ok: response.ok,
          status: response.status
        });
      } catch (error) {
        console.error('Feed: API connectivity test failed:', error);
      }
    };

    testConnectivity();
    loadFeed(1);
  }, []); // Only run once on mount
  
  // Separate effect for sortBy changes
  useEffect(() => {
    // Reload feed when sort changes, but skip initial load
    if (posts.length > 0) {
      loadFeed(1);
    }
  }, [sortBy]);

  // Load more posts when reaching the end
  const loadMorePosts = useCallback(async () => {
    if (!loadingMore && hasMorePages && !loading) {
      console.log('Loading more posts, current page:', currentPage);
      await loadFeed(currentPage + 1);
    }
  }, [loadingMore, hasMorePages, loading, currentPage]);

  // Check for new posts in the background
  const checkForNewPosts = useCallback(async () => {
    if (!latestPostId) return;
    
    try {
      const response = await apiClient.get<{ count: number; has_new_posts: boolean }>(
        `/v1/feed/new-count?after=${latestPostId}`
      );
      
      if (response.ok && response.data && response.data.has_new_posts) {
        setNewPostsCount(response.data.count);
        console.log('Feed: New posts available', { count: response.data.count });
      }
    } catch (error) {
      console.error('Feed: Error checking for new posts', error);
    }
  }, [latestPostId]);

  // Function to load new posts when user taps the "new posts" button
  const loadNewPosts = useCallback(async () => {
    console.log('Feed: Loading new posts');
    await loadFeed(1, true);
  }, []);

  // Set up background polling for new posts
  useEffect(() => {
    if (!latestPostId) return;
    
    const interval = setInterval(checkForNewPosts, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [checkForNewPosts, latestPostId]);


  // Handle deep link to open specific post from notifications
  useEffect(() => {
    if (params.openPost && posts.length > 0) {
      const post = posts.find((p) => p.id === params.openPost);
      if (post) {
        handleOpenPostDetail(post);
        // Clear the param to prevent reopening
        router.setParams({ openPost: undefined, commentId: undefined });
      }
    }
  }, [params.openPost, posts, router]);

  useEffect(() => {
    if (params.compose) {
      setComposerVisible(true);
      router.replace('/(tabs)/feed');
    }
  }, [params.compose, router]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('openFeedComposer', () => {
      setComposerVisible(true);
    });
    return () => subscription.remove();
  }, []);

  const onRefresh = useCallback(() => {
    setCurrentPage(1);
    setHasMorePages(true);
    loadFeed(1, true);
  }, []);

  const handleLike = async (post: FeedPost) => {
    // Optimistic update - update UI immediately
    const newLikedState = !post.is_liked;
    const newLikesCount = newLikedState ? post.likes_count + 1 : Math.max(0, post.likes_count - 1);

    // Update in main feed immediately
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              is_liked: newLikedState,
              likes_count: newLikesCount,
            }
          : p
      )
    );
    // Also update in post detail modal if it's the same post
    if (postDetailPost && postDetailPost.id === post.id) {
      setPostDetailPost((prev) =>
        prev
          ? {
              ...prev,
              is_liked: newLikedState,
              likes_count: newLikesCount,
            }
          : null
      );
    }

    try {
      const response = await apiClient.post<{ liked: boolean; likes_count: number }>(
        `/v1/feed/posts/${post.id}/like`
      );

      if (response.ok && response.data) {
        // Update with actual server response
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  is_liked: response.data!.liked,
                  likes_count: response.data!.likes_count,
                }
              : p
          )
        );
        // Also update in post detail modal if it's the same post
        if (postDetailPost && postDetailPost.id === post.id) {
          setPostDetailPost((prev) =>
            prev
              ? {
                  ...prev,
                  is_liked: response.data!.liked,
                  likes_count: response.data!.likes_count,
                }
              : null
          );
        }
      } else {
        // Revert on error
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  is_liked: post.is_liked,
                  likes_count: post.likes_count,
                }
              : p
          )
        );
        if (postDetailPost && postDetailPost.id === post.id) {
          setPostDetailPost((prev) =>
            prev
              ? {
                  ...prev,
                  is_liked: post.is_liked,
                  likes_count: post.likes_count,
                }
              : null
          );
        }
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to like post',
          visibilityTime: 2000,
        });
      }
    } catch (error) {
      console.error('Like error:', error);
      // Revert on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                is_liked: post.is_liked,
                likes_count: post.likes_count,
              }
            : p
        )
      );
      if (postDetailPost && postDetailPost.id === post.id) {
        setPostDetailPost((prev) =>
          prev
            ? {
                ...prev,
                is_liked: post.is_liked,
                likes_count: post.likes_count,
              }
            : null
        );
      }
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to like post',
        visibilityTime: 2000,
      });
    }
  };

  const handleComment = async (post: FeedPost) => {
    setSelectedPost(post);
    setCommentModalVisible(true);
    setComments([]);
    setNewComment('');

    try {
      const response = await apiClient.get<Comment[]>(
        `/v1/feed/posts/${post.id}/comments`
      );

      if (response.ok && response.data) {
        setComments(response.data);
      }
    } catch (error) {
      console.error('Load comments error:', error);
    }
  };

  const handleSubmitComment = async (parentId?: string) => {
    const post = selectedPost || postDetailPost;
    if (!post) return;

    const content = parentId ? (replyContent[parentId] || '').trim() : newComment.trim();
    if (!content) return;

    setCommenting(true);
    try {
      const response = await apiClient.post<Comment>(
        `/v1/feed/posts/${post.id}/comment`,
        { content, parent_id: parentId }
      );

      if (response.ok && response.data) {
        if (parentId) {
          // Update replies in the parent comment
          setComments((prev) =>
            prev.map((comment) =>
              comment.id === parentId
                ? { ...comment, replies: [response.data!, ...(comment.replies || [])] }
                : comment
            )
          );
          setReplyContent((prev) => ({ ...prev, [parentId]: '' }));
          setReplyingTo(null);
        } else {
          // Ensure the new comment has replies array
          const newCommentData = {
            ...response.data!,
            replies: response.data!.replies || [],
          };
          setComments((prev) => [newCommentData, ...prev]);
          setNewComment('');
        }
        // Update post comments count
        if (selectedPost) {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === selectedPost.id
                ? { ...p, comments_count: p.comments_count + 1 }
                : p
            )
          );
        }
        if (postDetailPost) {
          setPostDetailPost((prev) =>
            prev
              ? { ...prev, comments_count: prev.comments_count + 1 }
              : null
          );
        }
        Toast.show({
          type: 'success',
          text1: parentId ? 'Reply posted' : 'Comment posted',
          visibilityTime: 2000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to post comment',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Comment error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to post comment',
        visibilityTime: 3000,
      });
    } finally {
      setCommenting(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    const post = selectedPost || postDetailPost;
    if (!post) return;

    // Find the comment/reply to get current state
    let targetComment: { is_liked: boolean; likes_count: number } | undefined;
    
    // First check if it's a top-level comment
    const topLevelComment = comments.find((c) => c.id === commentId);
    if (topLevelComment) {
      targetComment = topLevelComment;
    } else {
      // If not found, check if it's a reply
      for (const comment of comments) {
        const reply = comment.replies?.find((r) => r.id === commentId);
        if (reply) {
          targetComment = reply;
          break;
        }
      }
    }

    if (!targetComment) return;

    // Optimistic update - update UI immediately
    const newLikedState = !targetComment.is_liked;
    const newLikesCount = newLikedState 
      ? targetComment.likes_count + 1 
      : Math.max(0, targetComment.likes_count - 1);

    setLikingComment(commentId);
    
    // Update immediately
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          // Top-level comment
          return {
            ...c,
            is_liked: newLikedState,
            likes_count: newLikesCount,
          };
        }
        // Check if it's a reply in this comment
        if (c.replies?.some((r) => r.id === commentId)) {
          return {
            ...c,
            replies: (c.replies || []).map((reply) =>
              reply.id === commentId
                ? {
                    ...reply,
                    is_liked: newLikedState,
                    likes_count: newLikesCount,
                  }
                : reply
            ),
          };
        }
        return c;
      })
    );

    try {
      const response = await apiClient.post<{ liked: boolean; likes_count: number }>(
        `/v1/feed/posts/${post.id}/comments/${commentId}/like`
      );

      if (response.ok && response.data) {
        // Update with actual server response
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                is_liked: response.data!.liked,
                likes_count: response.data!.likes_count,
              };
            }
            // Also update in replies
            return {
              ...c,
              replies: (c.replies || []).map((reply) =>
                reply.id === commentId
                  ? {
                      ...reply,
                      is_liked: response.data!.liked,
                      likes_count: response.data!.likes_count,
                    }
                  : reply
              ),
            };
          })
        );
      } else {
        // Revert on error
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                is_liked: targetComment.is_liked,
                likes_count: targetComment.likes_count,
              };
            }
            return {
              ...c,
              replies: (c.replies || []).map((reply) =>
                reply.id === commentId
                  ? {
                      ...reply,
                      is_liked: targetComment.is_liked,
                      likes_count: targetComment.likes_count,
                    }
                  : reply
              ),
            };
          })
        );
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to like comment',
          visibilityTime: 2000,
        });
      }
    } catch (error) {
      console.error('Like comment error:', error);
      // Revert on error
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              is_liked: targetComment.is_liked,
              likes_count: targetComment.likes_count,
            };
          }
          return {
            ...c,
            replies: (c.replies || []).map((reply) =>
              reply.id === commentId
                ? {
                    ...reply,
                    is_liked: targetComment.is_liked,
                    likes_count: targetComment.likes_count,
                  }
                : reply
            ),
          };
        })
      );
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to like comment',
        visibilityTime: 2000,
      });
    } finally {
      setLikingComment(null);
    }
  };

  const handleOpenPostDetail = async (post: FeedPost) => {
    setPostDetailPost(post);
    setPostDetailModalVisible(true);
    // Load comments for the post detail view
    try {
      const response = await apiClient.get<Comment[]>(
        `/v1/feed/posts/${post.id}/comments`
      );
      if (response.ok && response.data) {
        // Ensure replies array is always present
        const commentsWithReplies = response.data.map(comment => ({
          ...comment,
          replies: comment.replies || []
        }));
        setComments(commentsWithReplies);
      }
    } catch (error) {
      console.error('Load comments error:', error);
    }
  };

  const handleClosePostDetail = () => {
    setPostDetailModalVisible(false);
    setPostDetailPost(null);
    setComments([]);
    setNewComment('');
    setReplyingTo(null);
    setReplyContent({});
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
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, shares_count: response.data!.shares_count }
              : p
          )
        );
        
        // If shared to timeline, add the new post to the feed
        if (response.data.shared_post) {
          setPosts((prev) => [response.data!.shared_post!, ...prev]);
        }
        
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

  // Fetch wallet coins for reward configuration
  const fetchWalletCoins = useCallback(async () => {
    setIsWalletCoinsLoading(true);
    try {
      const response = await apiClient.get<{
        coin_balances?: Array<{ coin_symbol?: string; balance?: number }>;
      }>('/v1/wallets/me');

      if (response.ok && response.data?.coin_balances) {
        const coins = response.data.coin_balances
          .filter((c) => c.coin_symbol && (c.balance ?? 0) > 0)
          .map((c) => ({
            coin_symbol: c.coin_symbol!,
            balance: c.balance ?? 0,
          }));
        setWalletCoins(coins);
        if (coins.length > 0 && !coins.find((c) => c.coin_symbol === rewardCoinSymbol)) {
          setRewardCoinSymbol(coins[0].coin_symbol);
        }
      }
    } catch (error) {
      console.error('Fetch wallet coins error:', error);
    } finally {
      setIsWalletCoinsLoading(false);
    }
  }, [rewardCoinSymbol]);

  // Load wallet coins when modal opens
  useEffect(() => {
    if (composerVisible && walletCoins.length === 0) {
      fetchWalletCoins();
    }
  }, [composerVisible, walletCoins.length, fetchWalletCoins]);

  const selectedRewardCoinBalance = walletCoins.find(
    (coin) => coin.coin_symbol === rewardCoinSymbol
  )?.balance ?? 0;

  // Handle image/video picker
  const handlePickMedia = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Toast.show({
          type: 'error',
          text1: 'Permission Required',
          text2: 'Please allow access to your media library',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets) {
        for (const asset of result.assets.slice(0, 10 - uploadedMedia.length)) {
          await handleUploadMedia(asset);
        }
      }
    } catch (error) {
      console.error('Pick media error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick media',
      });
    }
  };

  // Handle media upload
  const handleUploadMedia = async (asset: ImagePicker.ImagePickerAsset) => {
    const fileId = `${asset.uri}-${Date.now()}`;
    setIsUploading(true);
    setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

    try {
      const formData = new FormData();
      const fileUri = asset.uri;
      const filename = fileUri.split('/').pop() || 'file';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // React Native FormData format
      formData.append('file', {
        uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
        type: asset.type === 'video' ? 'video/mp4' : type,
        name: filename,
      } as any);

      // Use axios directly for file upload with progress tracking
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:8000/api';
      const uploadUrl = `${API_BASE_URL}/v1/upload`;
      const token = apiClient.getToken();

      const response = await axios.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: token ? `Bearer ${token}` : '',
        },
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const percentComplete = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress((prev) => ({ ...prev, [fileId]: percentComplete }));
          }
        },
      });

      if (response.data?.data) {
        setUploadedMedia((prev) => [...prev, response.data.data]);
        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      } else {
        throw new Error('Upload response missing data');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: error.response?.data?.errors?.[0]?.detail || 'Failed to upload media',
      });
      setUploadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeMedia = (index: number) => {
    setUploadedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const resetPostForm = () => {
    setNewPostContent('');
    setNewPostVisibility('public');
    setRewardEnabled(false);
    setRewardPool(0);
    setRewardLikeAmount(1);
    setRewardCommentAmount(2);
    setRewardShareAmount(3);
    setRewardPerUserCap(10);
    setRewardCoinSymbol(String((user as any)?.default_coin_symbol ?? 'FCN').toUpperCase());
    setPostCreationStep(1);
    setUploadedMedia([]);
    setUploadProgress({});
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && uploadedMedia.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please add some content or media',
      });
      return;
    }

    if (rewardEnabled) {
      if (rewardPool <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please set a reward pool amount greater than 0',
        });
        return;
      }
      if (!rewardCoinSymbol) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Select which coin to use for rewards',
        });
        return;
      }
      if (selectedRewardCoinBalance > 0 && rewardPool > selectedRewardCoinBalance) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: `You only have ${selectedRewardCoinBalance} ${rewardCoinSymbol} available.`,
          visibilityTime: 4000,
        });
        return;
      }
    }

    setPosting(true);
    try {
      const postData: any = {
        content: newPostContent.trim() || undefined,
        visibility: newPostVisibility,
        media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
        reward_enabled: rewardEnabled,
      };

      if (rewardEnabled) {
        postData.reward_pool = rewardPool;
        postData.reward_coin_symbol = rewardCoinSymbol;
        postData.reward_rule = {
          like: rewardLikeAmount,
          comment: rewardCommentAmount,
          share: rewardShareAmount,
          per_user_cap: rewardPerUserCap,
        };
      }

      const response = await apiClient.post<FeedPost>('/v1/feed/posts', postData);

      if (response.ok && response.data) {
        setPosts((prev) => [response.data!, ...prev]);
        resetPostForm();
        setComposerVisible(false);
        Toast.show({
          type: 'success',
          text1: 'Posted',
          text2: 'Your post has been published',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to create post',
        });
      }
    } catch (error) {
      console.error('Create post error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create post',
      });
    } finally {
      setPosting(false);
    }
  };

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

  // Render individual post item
  const renderPost = useCallback(({ item: post }: { item: FeedPost }) => (
    <View key={post.id} style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity
          onPress={() => router.push(`/${post.user.username}` as any)}
          activeOpacity={0.7}
        >
          <Image
            source={{
              uri: post.user.avatar_url || 'https://via.placeholder.com/40',
            }}
            style={styles.avatar}
          />
        </TouchableOpacity>
        <View style={styles.postHeaderInfo}>
          <TouchableOpacity
            onPress={() => router.push(`/${post.user.username}` as any)}
            activeOpacity={0.7}
          >
            <View style={styles.postUsernameContainer}>
              <Text style={styles.postUsername}>
                {post.user.display_name || post.user.username}
              </Text>
              {post.user.verified_creator && (
                <FontAwesome name="check-circle" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
              )}
            </View>
          </TouchableOpacity>
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
                setSelectedImage({ url: post.shared_post!.media[index].url, type: post.shared_post!.media[index].type });
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
                setSelectedImage({ url: post.media[index].url, type: post.media[index].type });
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
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleComment(post)}
        >
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
    </View>
  ), [router, expandedPosts, setExpandedPosts, setImageViewerMedia, setImageViewerIndex, setSelectedImage, setImageViewerVisible, handleLike, handleComment, handleShare, handleCopyPostLink, formatTime]);

  // Render footer loading indicator
  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#FF6B00" />
        <Text style={styles.loadingFooterText}>Loading more posts...</Text>
      </View>
    );
  }, [loadingMore]);

  // Render empty state
  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No posts yet</Text>
      <Text style={styles.emptySubtext}>Start following creators to see their posts</Text>
    </View>
  ), []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  return (
    <FeedLayout>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
        <View style={styles.sortButtons}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'newest' && styles.sortButtonActive]}
            onPress={() => setSortBy('newest')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'newest' && styles.sortButtonTextActive]}>
              Newest
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'popular' && styles.sortButtonActive]}
            onPress={() => setSortBy('popular')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'popular' && styles.sortButtonTextActive]}>
              Popular
            </Text>
          </TouchableOpacity>
        </View>

        {/* New Posts Notification */}
        {newPostsCount > 0 && (
          <TouchableOpacity
            style={styles.newPostsBubble}
            onPress={loadNewPosts}
            activeOpacity={0.8}
          >
            <FontAwesome name="arrow-up" size={16} color="#fff" />
            <Text style={styles.newPostsText}>
              {newPostsCount} new post{newPostsCount !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setComposerVisible(true)}
        >
          <Text style={styles.createButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Feed */}
      <FlatList
        style={styles.feed}
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.1}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={loading ? null : renderEmpty}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
      />

      {/* Full-Screen Post Composer Modal */}
      <Modal
        visible={composerVisible}
        animationType="slide"
        onRequestClose={() => {
          resetPostForm();
          setComposerVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.fullScreenModal}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                if (postCreationStep > 1) {
                  setPostCreationStep((prev) => (prev === 1 ? 1 : (prev - 1) as 1 | 2 | 3));
                } else {
                  resetPostForm();
                  setComposerVisible(false);
                }
              }}
            >
              <FontAwesome name="times" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Post</Text>
            {postCreationStep === 3 ? (
              <TouchableOpacity
                style={[styles.postButton, posting && styles.postButtonDisabled]}
                onPress={handleCreatePost}
                disabled={posting}
              >
                {posting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.postButtonText}>Post</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.step, postCreationStep >= 1 && styles.stepActive]}>
              <Text style={[styles.stepNumber, postCreationStep >= 1 && styles.stepNumberActive]}>
                {postCreationStep > 1 ? '✓' : '1'}
              </Text>
              <Text style={[styles.stepLabel, postCreationStep >= 1 && styles.stepLabelActive]}>
                Content
              </Text>
            </View>
            <View style={[styles.step, postCreationStep >= 2 && styles.stepActive]}>
              <Text style={[styles.stepNumber, postCreationStep >= 2 && styles.stepNumberActive]}>
                {postCreationStep > 2 ? '✓' : '2'}
              </Text>
              <Text style={[styles.stepLabel, postCreationStep >= 2 && styles.stepLabelActive]}>
                Settings
              </Text>
            </View>
            <View style={[styles.step, postCreationStep >= 3 && styles.stepActive]}>
              <Text style={[styles.stepNumber, postCreationStep >= 3 && styles.stepNumberActive]}>
                3
              </Text>
              <Text style={[styles.stepLabel, postCreationStep >= 3 && styles.stepLabelActive]}>
                Review
              </Text>
            </View>
          </View>

          <ScrollView style={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            {/* Step 1: Content & Media */}
            {postCreationStep === 1 && (
              <View style={styles.stepContent}>
                <MentionInput
                  value={newPostContent}
                  onChangeText={setNewPostContent}
                  placeholder="What's on your mind? Type @ to mention someone..."
                  style={styles.postInput}
                  multiline
                  maxLength={5000}
                />

                {/* Media Upload Button */}
                <TouchableOpacity
                  style={[styles.uploadButton, (isUploading || uploadedMedia.length >= 10) && styles.uploadButtonDisabled]}
                  onPress={handlePickMedia}
                  disabled={isUploading || uploadedMedia.length >= 10}
                >
                  <FontAwesome name="image" size={20} color="#FF6B00" />
                  <Text style={styles.uploadButtonText}>
                    {isUploading ? 'Uploading...' : 'Add Photos/Video'}
                    {uploadedMedia.length > 0 && ` (${uploadedMedia.length}/10)`}
                  </Text>
                </TouchableOpacity>

                {/* Media Preview Grid */}
                {(uploadedMedia.length > 0 || Object.keys(uploadProgress).length > 0) && (
                  <View style={styles.mediaPreviewGrid}>
                    {uploadedMedia.map((media, index) => (
                      <View key={index} style={styles.mediaPreviewItem}>
                        {media.type === 'image' ? (
                          <Image source={{ uri: media.url }} style={styles.mediaPreviewImage} />
                        ) : (
                          <View style={styles.mediaPreviewVideo}>
                            {media.thumbnail_url ? (
                              <Image source={{ uri: media.thumbnail_url }} style={styles.mediaPreviewImage} />
                            ) : null}
                            <FontAwesome name="play-circle" size={32} color="#fff" style={styles.videoPlayIcon} />
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.removeMediaButton}
                          onPress={() => removeMedia(index)}
                        >
                          <FontAwesome name="times-circle" size={24} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {Object.entries(uploadProgress).map(([fileId, progress]) => (
                      <View key={fileId} style={styles.mediaPreviewItem}>
                        <View style={styles.uploadProgressContainer}>
                          <ActivityIndicator size="large" color="#FF6B00" />
                          <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${progress}%` }]} />
                          </View>
                          <Text style={styles.progressText}>{progress}%</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.stepFooter}>
                  <Text style={styles.characterCount}>
                    {newPostContent.length}/5000
                    {uploadedMedia.length > 0 && ` • ${uploadedMedia.length} media`}
                  </Text>
                  <TouchableOpacity
                    style={[styles.nextButton, (!newPostContent.trim() && uploadedMedia.length === 0) && styles.nextButtonDisabled]}
                    onPress={() => {
                      if (!newPostContent.trim() && uploadedMedia.length === 0) {
                        Toast.show({
                          type: 'error',
                          text1: 'Error',
                          text2: 'Please add some content or media',
                        });
                        return;
                      }
                      setPostCreationStep(2);
                    }}
                    disabled={!newPostContent.trim() && uploadedMedia.length === 0}
                  >
                    <Text style={styles.nextButtonText}>Next</Text>
                    <FontAwesome name="arrow-right" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Step 2: Settings */}
            {postCreationStep === 2 && (
              <View style={styles.stepContent}>
                <Text style={styles.sectionTitle}>Post Settings</Text>

                {/* Visibility Selector */}
                <View style={styles.settingSection}>
                  <Text style={styles.settingLabel}>Visibility</Text>
                  <View style={styles.visibilityOptions}>
                    {(['public', 'followers', 'private'] as const).map((vis) => (
                      <TouchableOpacity
                        key={vis}
                        style={[
                          styles.visibilityOption,
                          newPostVisibility === vis && styles.visibilityOptionActive,
                        ]}
                        onPress={() => setNewPostVisibility(vis)}
                      >
                        <FontAwesome
                          name={vis === 'public' ? 'globe' : vis === 'followers' ? 'users' : 'lock'}
                          size={20}
                          color={newPostVisibility === vis ? '#FF6B00' : '#666'}
                        />
                        <Text
                          style={[
                            styles.visibilityOptionText,
                            newPostVisibility === vis && styles.visibilityOptionTextActive,
                          ]}
                        >
                          {vis === 'public' ? 'Public' : vis === 'followers' ? 'Followers' : 'Private'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Reward Toggle */}
                <View style={styles.settingSection}>
                  <View style={styles.rewardToggleHeader}>
                    <View>
                      <Text style={styles.settingLabel}>Enable Rewards</Text>
                      <Text style={styles.settingDescription}>
                        Allow users to earn coins for engaging
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        rewardEnabled && styles.toggleButtonActive,
                      ]}
                      onPress={() => {
                        setRewardEnabled(!rewardEnabled);
                        // If enabling and no coins loaded yet, try to fetch
                        if (!rewardEnabled && walletCoins.length === 0 && !isWalletCoinsLoading) {
                          fetchWalletCoins();
                        }
                      }}
                    >
                      <Text style={[styles.toggleButtonText, rewardEnabled && styles.toggleButtonTextActive]}>
                        {rewardEnabled ? 'Yes' : 'No'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Reward Configuration */}
                  {rewardEnabled && (
                    <View style={styles.rewardConfig}>
                      {walletCoins.length === 0 && !isWalletCoinsLoading && (
                        <View style={styles.warningBox}>
                          <FontAwesome name="exclamation-triangle" size={16} color="#ff9800" />
                          <Text style={styles.warningText}>
                            You need to launch a creator coin and have balance before you can enable rewards.
                          </Text>
                        </View>
                      )}
                      {/* Coin Selection */}
                      <View style={styles.rewardField}>
                        <Text style={styles.rewardLabel}>Reward Coin</Text>
                        {isWalletCoinsLoading ? (
                          <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#FF6B00" />
                            <Text style={styles.coinsLoadingText}>Loading coins...</Text>
                          </View>
                        ) : walletCoins.length > 0 ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coinSelector}>
                            {walletCoins.map((coin) => (
                              <TouchableOpacity
                                key={coin.coin_symbol}
                                style={[
                                  styles.coinOption,
                                  rewardCoinSymbol === coin.coin_symbol && styles.coinOptionActive,
                                ]}
                                onPress={() => setRewardCoinSymbol(coin.coin_symbol)}
                              >
                                <Text
                                  style={[
                                    styles.coinOptionText,
                                    rewardCoinSymbol === coin.coin_symbol && styles.coinOptionTextActive,
                                  ]}
                                >
                                  {coin.coin_symbol}
                                </Text>
                                <Text style={styles.coinBalance}>{coin.balance}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        ) : (
                          <View style={styles.noCoinsBox}>
                            <FontAwesome name="info-circle" size={16} color="#666" />
                            <Text style={styles.errorText}>No coins available. Launch a creator coin first.</Text>
                          </View>
                        )}
                      </View>

                      {/* Reward Pool */}
                      <View style={styles.rewardField}>
                        <Text style={styles.rewardLabel}>Total Reward Pool</Text>
                        <TextInput
                          style={styles.rewardInput}
                          placeholder="0.00"
                          keyboardType="numeric"
                          value={rewardPool > 0 ? String(rewardPool) : ''}
                          onChangeText={(text) => setRewardPool(parseFloat(text) || 0)}
                        />
                        <Text style={styles.rewardHint}>
                          Available: {selectedRewardCoinBalance} {rewardCoinSymbol}
                        </Text>
                      </View>

                      {/* Per-Action Rewards */}
                      <View style={styles.rewardField}>
                        <Text style={styles.rewardLabel}>Reward Amounts</Text>
                        <View style={styles.rewardAmountsGrid}>
                          <View style={styles.rewardAmountItem}>
                            <Text style={styles.rewardAmountLabel}>Like</Text>
                            <TextInput
                              style={styles.rewardAmountInput}
                              placeholder="1"
                              keyboardType="numeric"
                              value={rewardLikeAmount > 0 ? String(rewardLikeAmount) : ''}
                              onChangeText={(text) => setRewardLikeAmount(parseFloat(text) || 0)}
                            />
                          </View>
                          <View style={styles.rewardAmountItem}>
                            <Text style={styles.rewardAmountLabel}>Comment</Text>
                            <TextInput
                              style={styles.rewardAmountInput}
                              placeholder="2"
                              keyboardType="numeric"
                              value={rewardCommentAmount > 0 ? String(rewardCommentAmount) : ''}
                              onChangeText={(text) => setRewardCommentAmount(parseFloat(text) || 0)}
                            />
                          </View>
                          <View style={styles.rewardAmountItem}>
                            <Text style={styles.rewardAmountLabel}>Share</Text>
                            <TextInput
                              style={styles.rewardAmountInput}
                              placeholder="3"
                              keyboardType="numeric"
                              value={rewardShareAmount > 0 ? String(rewardShareAmount) : ''}
                              onChangeText={(text) => setRewardShareAmount(parseFloat(text) || 0)}
                            />
                          </View>
                        </View>
                      </View>

                      {/* Per-User Cap */}
                      <View style={styles.rewardField}>
                        <Text style={styles.rewardLabel}>Max Coins Per User</Text>
                        <TextInput
                          style={styles.rewardInput}
                          placeholder="10"
                          keyboardType="numeric"
                          value={rewardPerUserCap > 0 ? String(rewardPerUserCap) : ''}
                          onChangeText={(text) => setRewardPerUserCap(parseFloat(text) || 0)}
                        />
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.stepFooter}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setPostCreationStep(1)}
                  >
                    <FontAwesome name="arrow-left" size={16} color="#666" />
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.nextButton}
                    onPress={() => {
                      if (rewardEnabled) {
                        if (!rewardCoinSymbol || walletCoins.length === 0) {
                          Toast.show({
                            type: 'error',
                            text1: 'Error',
                            text2: 'Select a reward coin',
                          });
                          return;
                        }
                        if (selectedRewardCoinBalance > 0 && rewardPool > selectedRewardCoinBalance) {
                          Toast.show({
                            type: 'error',
                            text1: 'Error',
                            text2: `You only have ${selectedRewardCoinBalance} ${rewardCoinSymbol}`,
                            visibilityTime: 4000,
                          });
                          return;
                        }
                      }
                      setPostCreationStep(3);
                    }}
                  >
                    <Text style={styles.nextButtonText}>Next</Text>
                    <FontAwesome name="arrow-right" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Step 3: Review */}
            {postCreationStep === 3 && (
              <View style={styles.stepContent}>
                <Text style={styles.sectionTitle}>Review Your Post</Text>

                {/* Post Preview */}
                <View style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Image
                      source={{ uri: (user as any)?.avatar_url || 'https://via.placeholder.com/40' }}
                      style={styles.reviewAvatar}
                    />
                    <View>
                      <Text style={styles.reviewUsername}>
                        {(user as any)?.display_name || (user as any)?.username || user?.name}
                      </Text>
                      <View style={styles.reviewVisibilityContainer}>
                        <FontAwesome
                          name={newPostVisibility === 'public' ? 'globe' : newPostVisibility === 'followers' ? 'users' : 'lock'}
                          size={14}
                          color="#666"
                        />
                        <Text style={styles.reviewVisibility}>
                          {newPostVisibility === 'public' ? 'Public' : newPostVisibility === 'followers' ? 'Followers Only' : 'Private'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {newPostContent.trim() && (
                    <Text style={styles.reviewContent}>{newPostContent}</Text>
                  )}
                  {uploadedMedia.length > 0 && (
                    <View style={styles.reviewMediaGrid}>
                      {uploadedMedia.slice(0, 4).map((media, index) => (
                        <Image
                          key={index}
                          source={{ uri: media.url }}
                          style={styles.reviewMediaItem}
                        />
                      ))}
                      {uploadedMedia.length > 4 && (
                        <View style={[styles.reviewMediaItem, styles.reviewMediaMore]}>
                          <Text style={styles.reviewMediaMoreText}>+{uploadedMedia.length - 4}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {rewardEnabled && (
                    <View style={styles.reviewReward}>
                      <FontAwesome name="dollar" size={16} color="#FF6B00" />
                      <Text style={styles.reviewRewardText}>
                        {rewardPool} {rewardCoinSymbol} reward pool
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.stepFooter}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setPostCreationStep(2)}
                  >
                    <FontAwesome name="arrow-left" size={16} color="#666" />
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.postButton, posting && styles.postButtonDisabled]}
                    onPress={handleCreatePost}
                    disabled={posting}
                  >
                    {posting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Text style={styles.postButtonText}>Post</Text>
                        <FontAwesome name="check" size={16} color="#fff" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comments Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.commentsList}>
              {comments.map((comment) => (
                <View key={comment.id} style={styles.commentItem}>
                  <TouchableOpacity
                    onPress={() => router.push(`/${comment.user.username}` as any)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{
                        uri: comment.user.avatar_url || 'https://via.placeholder.com/32',
                      }}
                      style={styles.commentAvatar}
                    />
                  </TouchableOpacity>
                  <View style={styles.commentContent}>
                    <TouchableOpacity
                      onPress={() => router.push(`/${comment.user.username}` as any)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.commentUsername}>
                        {comment.user.display_name || comment.user.username}
                      </Text>
                    </TouchableOpacity>
                    <MentionText text={comment.content} style={styles.commentText} />
                    <View style={styles.commentActions}>
                      <Text style={styles.commentTime}>{formatTime(comment.created_at)}</Text>
                      <TouchableOpacity
                        style={styles.commentActionButton}
                        onPress={() => handleLikeComment(comment.id)}
                        disabled={likingComment === comment.id}
                      >
                        {likingComment === comment.id ? (
                          <ActivityIndicator size="small" color="#FF6B00" />
                        ) : (
                          <FontAwesome
                            name={comment.is_liked ? 'heart' : 'heart-o'}
                            size={14}
                            color={comment.is_liked ? '#FF6B00' : '#666'}
                          />
                        )}
                        {comment.likes_count > 0 && (
                          <Text style={styles.commentActionText}>{comment.likes_count}</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.commentActionButton}
                        onPress={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                      >
                        <FontAwesome name="reply" size={14} color="#666" />
                        <Text style={styles.commentActionText}>Reply</Text>
                      </TouchableOpacity>
                    </View>
                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <View style={styles.repliesContainer}>
                        {comment.replies.map((reply) => (
                          <View key={reply.id} style={styles.replyItem}>
                            <Image
                              source={{
                                uri: reply.user.avatar_url || 'https://via.placeholder.com/24',
                              }}
                              style={styles.replyAvatar}
                            />
                            <View style={styles.replyContent}>
                              <Text style={styles.replyUsername}>
                                {reply.user.display_name || reply.user.username}
                              </Text>
                              <MentionText text={reply.content} style={styles.replyText} />
                              <View style={styles.commentActions}>
                                <Text style={styles.commentTime}>{formatTime(reply.created_at)}</Text>
                                <TouchableOpacity
                                  style={styles.commentActionButton}
                                  onPress={() => handleLikeComment(reply.id)}
                                  disabled={likingComment === reply.id}
                                >
                                  {likingComment === reply.id ? (
                                    <ActivityIndicator size="small" color="#FF6B00" />
                                  ) : (
                                    <FontAwesome
                                      name={reply.is_liked ? 'heart' : 'heart-o'}
                                      size={14}
                                      color={reply.is_liked ? '#FF6B00' : '#666'}
                                    />
                                  )}
                                  {reply.likes_count > 0 && (
                                    <Text style={styles.commentActionText}>{reply.likes_count}</Text>
                                  )}
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                    {/* Reply Input */}
                    {replyingTo === comment.id && (
                      <View style={styles.replyInputContainer}>
                        <MentionInput
                          value={replyContent[comment.id] || ''}
                          onChangeText={(text) => setReplyContent((prev) => ({ ...prev, [comment.id]: text }))}
                          placeholder={`Reply to ${comment.user.display_name || comment.user.username}...`}
                          style={styles.replyInput}
                          multiline
                        />
                        <TouchableOpacity
                          style={[
                            styles.replySubmit,
                            (commenting || !replyContent[comment.id]?.trim()) && styles.replySubmitDisabled,
                          ]}
                          onPress={() => handleSubmitComment(comment.id)}
                          disabled={commenting || !replyContent[comment.id]?.trim()}
                        >
                          {commenting ? (
                            <ActivityIndicator color="#FF6B00" size="small" />
                          ) : (
                            <FontAwesome name="paper-plane" size={14} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.commentInputContainer}>
              <MentionInput
                value={newComment}
                onChangeText={setNewComment}
                placeholder="Write a comment..."
                style={styles.commentInput}
                multiline
              />
              <TouchableOpacity
                style={[styles.commentSubmit, commenting && styles.commentSubmitDisabled]}
                onPress={() => handleSubmitComment()}
                disabled={commenting || !newComment.trim()}
              >
                {commenting ? (
                  <ActivityIndicator color="#FF6B00" size="small" />
                ) : (
                  <Text style={styles.commentSubmitText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Post Detail Modal */}
      <Modal
        visible={postDetailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleClosePostDetail}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.postDetailContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post</Text>
              <TouchableOpacity onPress={handleClosePostDetail}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {postDetailPost && (
              <ScrollView style={styles.postDetailScroll}>
                {/* Post Header */}
                <View style={styles.postHeader}>
                  <TouchableOpacity
                    onPress={() => {
                      handleClosePostDetail();
                      router.push(`/${postDetailPost.user.username}` as any);
                    }}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{
                        uri: postDetailPost.user.avatar_url || 'https://via.placeholder.com/40',
                      }}
                      style={styles.avatar}
                    />
                  </TouchableOpacity>
                  <View style={styles.postHeaderInfo}>
                    <TouchableOpacity
                      onPress={() => {
                        handleClosePostDetail();
                        router.push(`/${postDetailPost.user.username}` as any);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.postUsernameContainer}>
                        <Text style={styles.postUsername}>
                          {postDetailPost.user.display_name || postDetailPost.user.username}
                        </Text>
                        {postDetailPost.user.verified_creator && (
                          <FontAwesome name="check-circle" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
                        )}
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.postTime}>{formatTime(postDetailPost.created_at)}</Text>
                  </View>
                </View>

                {/* Share Header - if this is a shared post */}
                {postDetailPost.shared_post && (
                  <View style={styles.shareHeader}>
                    <View style={styles.shareHeaderContent}>
                      <FontAwesome name="share" size={14} color="#FF6B00" />
                      <Text style={styles.shareHeaderText}>
                        {postDetailPost.user.display_name || postDetailPost.user.username} shared a post
                      </Text>
                    </View>
                    {postDetailPost.content && (
                      <View style={styles.shareComment}>
                        <MentionText text={postDetailPost.content} style={styles.shareCommentText} />
                      </View>
                    )}
                  </View>
                )}

                {/* Post Content */}
                {postDetailPost.shared_post ? (
                  // Show shared post content in an embedded card
                  <View style={styles.sharedPostCard}>
                    <View style={styles.sharedPostHeader}>
                      <TouchableOpacity
                        onPress={() => {
                          handleClosePostDetail();
                          router.push(`/${postDetailPost.shared_post!.user.username}` as any);
                        }}
                        activeOpacity={0.7}
                      >
                        <Image
                          source={{
                            uri: postDetailPost.shared_post!.user.avatar_url || 'https://via.placeholder.com/40',
                          }}
                          style={styles.avatar}
                        />
                      </TouchableOpacity>
                      <View style={styles.postHeaderInfo}>
                        <TouchableOpacity
                          onPress={() => {
                            handleClosePostDetail();
                            router.push(`/${postDetailPost.shared_post!.user.username}` as any);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.postUsernameContainer}>
                            <Text style={styles.postUsername}>
                              {postDetailPost.shared_post!.user.display_name || postDetailPost.shared_post!.user.username}
                            </Text>
                            {postDetailPost.shared_post!.user.verified_creator && (
                              <FontAwesome name="check-circle" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
                            )}
                          </View>
                        </TouchableOpacity>
                        <Text style={styles.postTime}>{formatTime(postDetailPost.shared_post!.created_at)}</Text>
                      </View>
                    </View>
                    {postDetailPost.shared_post.content && (
                      <MentionText
                        text={postDetailPost.shared_post.content}
                        style={styles.postContent}
                      />
                    )}
                    {postDetailPost.shared_post.media.length > 0 && (
                      <FeedMediaGrid
                        media={postDetailPost.shared_post.media}
                        onImagePress={(index: number) => {
                          setImageViewerMedia(postDetailPost.shared_post!.media.map((m) => ({ url: m.url, type: m.type })));
                          setImageViewerIndex(index);
                          setSelectedImage({ url: postDetailPost.shared_post!.media[index].url, type: postDetailPost.shared_post!.media[index].type });
                          setImageViewerVisible(true);
                        }}
                      />
                    )}
                  </View>
                ) : (
                  <>
                    {/* Regular post content */}
                    {postDetailPost.content && (
                  <TouchableOpacity
                    onPress={() => {
                      setExpandedPosts((prev) => ({
                        ...prev,
                        [postDetailPost.id]: !prev[postDetailPost.id],
                      }));
                    }}
                    activeOpacity={0.7}
                  >
                    <MentionText
                      text={postDetailPost.content}
                      style={styles.postContent}
                      numberOfLines={expandedPosts[postDetailPost.id] ? undefined : 3}
                    />
                    {postDetailPost.content.length > 150 && (
                      <Text style={styles.showMoreText}>
                        {expandedPosts[postDetailPost.id] ? 'Show less' : 'Show more'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                    {/* Post Media */}
                    {postDetailPost.media.length > 0 && (
                      <FeedMediaGrid
                        media={postDetailPost.media}
                        onImagePress={(index: number) => {
                          setImageViewerMedia(postDetailPost.media.map((m) => ({ url: m.url, type: m.type })));
                          setImageViewerIndex(index);
                          setSelectedImage({ url: postDetailPost.media[index].url, type: postDetailPost.media[index].type });
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
                    onPress={() => handleLike(postDetailPost)}
                  >
                    <FontAwesome
                      name={postDetailPost.is_liked ? 'heart' : 'heart-o'}
                      size={20}
                      color={postDetailPost.is_liked ? '#FF6B00' : '#666'}
                    />
                    <Text style={styles.actionText}>{postDetailPost.likes_count}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      setSelectedPost(postDetailPost);
                      setCommentModalVisible(true);
                    }}
                  >
                    <FontAwesome name="comment-o" size={20} color="#666" />
                    <Text style={styles.actionText}>{postDetailPost.comments_count}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleShare(postDetailPost)}
                  >
                    <FontAwesome name="share" size={20} color="#666" />
                    <Text style={styles.actionText}>{postDetailPost.shares_count}</Text>
                  </TouchableOpacity>
                  {postDetailPost.reward_enabled && (
                    <View style={styles.rewardBadge}>
                      <FontAwesome name="dollar" size={14} color="#FF6B00" />
                      <Text style={styles.rewardText}> {postDetailPost.reward_pool}</Text>
                    </View>
                  )}
                </View>

                {/* Comments Section */}
                <View style={styles.postDetailComments}>
                  <Text style={styles.commentsSectionTitle}>Comments</Text>
                  {comments.length === 0 ? (
                    <Text style={styles.noCommentsText}>No comments yet</Text>
                  ) : (
                    comments.slice(0, 5).map((comment) => (
                      <View key={comment.id} style={styles.commentItem}>
                        <TouchableOpacity
                          onPress={() => {
                            handleClosePostDetail();
                            router.push(`/${comment.user.username}` as any);
                          }}
                          activeOpacity={0.7}
                        >
                          <Image
                            source={{
                              uri: comment.user.avatar_url || 'https://via.placeholder.com/32',
                            }}
                            style={styles.commentAvatar}
                          />
                        </TouchableOpacity>
                        <View style={styles.commentContent}>
                          <TouchableOpacity
                            onPress={() => {
                              handleClosePostDetail();
                              router.push(`/${comment.user.username}` as any);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.commentUsername}>
                              {comment.user.display_name || comment.user.username}
                            </Text>
                          </TouchableOpacity>
                          <MentionText text={comment.content} style={styles.commentText} />
                          <View style={styles.commentActions}>
                            <Text style={styles.commentTime}>{formatTime(comment.created_at)}</Text>
                            <TouchableOpacity
                              style={styles.commentActionButton}
                              onPress={() => handleLikeComment(comment.id)}
                              disabled={likingComment === comment.id}
                            >
                              {likingComment === comment.id ? (
                                <ActivityIndicator size="small" color="#FF6B00" />
                              ) : (
                                <FontAwesome
                                  name={comment.is_liked ? 'heart' : 'heart-o'}
                                  size={14}
                                  color={comment.is_liked ? '#FF6B00' : '#666'}
                                />
                              )}
                              {comment.likes_count > 0 && (
                                <Text style={styles.commentActionText}>{comment.likes_count}</Text>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.commentActionButton}
                              onPress={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            >
                              <FontAwesome name="reply" size={14} color="#666" />
                              <Text style={styles.commentActionText}>Reply</Text>
                            </TouchableOpacity>
                          </View>
                          {/* Replies */}
                          {comment.replies && comment.replies.length > 0 && (
                            <View style={styles.repliesContainer}>
                              {comment.replies.map((reply) => (
                                <View key={reply.id} style={styles.replyItem}>
                                  <Image
                                    source={{
                                      uri: reply.user.avatar_url || 'https://via.placeholder.com/24',
                                    }}
                                    style={styles.replyAvatar}
                                  />
                                  <View style={styles.replyContent}>
                                    <Text style={styles.replyUsername}>
                                      {reply.user.display_name || reply.user.username}
                                    </Text>
                                    <MentionText text={reply.content} style={styles.replyText} />
                                    <View style={styles.commentActions}>
                                      <Text style={styles.commentTime}>{formatTime(reply.created_at)}</Text>
                                      <TouchableOpacity
                                        style={styles.commentActionButton}
                                        onPress={() => handleLikeComment(reply.id)}
                                        disabled={likingComment === reply.id}
                                      >
                                        {likingComment === reply.id ? (
                                          <ActivityIndicator size="small" color="#FF6B00" />
                                        ) : (
                                          <FontAwesome
                                            name={reply.is_liked ? 'heart' : 'heart-o'}
                                            size={14}
                                            color={reply.is_liked ? '#FF6B00' : '#666'}
                                          />
                                        )}
                                        {reply.likes_count > 0 && (
                                          <Text style={styles.commentActionText}>{reply.likes_count}</Text>
                                        )}
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                          {/* Reply Input */}
                          {replyingTo === comment.id && (
                            <View style={styles.replyInputContainer}>
                              <MentionInput
                                value={replyContent[comment.id] || ''}
                                onChangeText={(text) => setReplyContent((prev) => ({ ...prev, [comment.id]: text }))}
                                placeholder={`Reply to ${comment.user.display_name || comment.user.username}...`}
                                style={styles.replyInput}
                                multiline
                              />
                              <TouchableOpacity
                                style={[
                                  styles.replySubmit,
                                  (commenting || !replyContent[comment.id]?.trim()) && styles.replySubmitDisabled,
                                ]}
                                onPress={() => handleSubmitComment(comment.id)}
                                disabled={commenting || !replyContent[comment.id]?.trim()}
                              >
                                {commenting ? (
                                  <ActivityIndicator color="#FF6B00" size="small" />
                                ) : (
                                  <FontAwesome name="paper-plane" size={14} color="#fff" />
                                )}
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                  {comments.length > 5 && (
                    <TouchableOpacity
                      style={styles.viewAllCommentsButton}
                      onPress={() => {
                        setSelectedPost(postDetailPost);
                        setCommentModalVisible(true);
                        handleClosePostDetail();
                      }}
                    >
                      <Text style={styles.viewAllCommentsText}>View all {comments.length} comments</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
            {/* Comment Input */}
            <View style={styles.commentInputContainer}>
              <MentionInput
                value={newComment}
                onChangeText={setNewComment}
                placeholder="Write a comment..."
                style={styles.commentInput}
                multiline
              />
              <TouchableOpacity
                style={[styles.commentSubmit, commenting && styles.commentSubmitDisabled]}
                onPress={() => handleSubmitComment()}
                disabled={commenting || !newComment.trim()}
              >
                {commenting ? (
                  <ActivityIndicator color="#FF6B00" size="small" />
                ) : (
                  <Text style={styles.commentSubmitText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Share Modal */}
      {postToShare && (
        <ShareModal
          visible={shareModalVisible}
          onClose={() => {
            setShareModalVisible(false);
            setPostToShare(null);
          }}
          post={postToShare}
          onShareToTimeline={async (comment?: string) => {
            await handleShareToTimeline(postToShare.id, comment);
          }}
          postUrl={`https://fcoin.app/posts/${postToShare.id}`}
        />
      )}

      {/* Image Viewer Modal with Zoom */}
      <ImageZoomViewer
        visible={imageViewerVisible}
        onClose={() => {
          setImageViewerVisible(false);
          // Reset zoom
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
          if (imageViewerMedia[index]) {
            setSelectedImage(imageViewerMedia[index]);
          }
          // Reset zoom when changing images
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
    </FeedLayout>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  sortButtonActive: {
    backgroundColor: '#FF6B00',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  newPostsBubble: {
    position: 'absolute',
    top: -10,
    left: '50%',
    transform: [{ translateX: -75 }],
    backgroundColor: '#FF6B00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  newPostsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  feed: {
    flex: 1,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  postCard: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    padding: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  postHeaderInfo: {
    flex: 1,
  },
  postUsernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  verifiedIcon: {
    marginLeft: 4,
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
  mediaContainer: {
    marginBottom: 12,
  },
  mediaImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 8,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginLeft: 4,
  },
  shareActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyLinkButton: {
    padding: 4,
  },
  rewardBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#fff3e0',
  },
  rewardText: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '600',
  },
  // Full-Screen Modal Styles
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  step: {
    alignItems: 'center',
    gap: 8,
  },
  stepActive: {
    opacity: 1,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 32,
  },
  stepNumberActive: {
    backgroundColor: '#FF6B00',
    color: '#fff',
  },
  stepLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  stepLabelActive: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  modalScrollContent: {
    flex: 1,
  },
  stepContent: {
    padding: 16,
    minHeight: 400,
  },
  postInput: {
    minHeight: 150,
    fontSize: 16,
    color: '#000',
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF6B00',
    borderStyle: 'dashed',
    backgroundColor: '#fff3e0',
    marginBottom: 16,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B00',
  },
  mediaPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  mediaPreviewItem: {
    width: '48%',
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  mediaPreviewImage: {
    width: '100%',
    height: '100%',
  },
  mediaPreviewVideo: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  videoPlayIcon: {
    position: 'absolute',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    padding: 4,
  },
  uploadProgressContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B00',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  stepFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 'auto',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Step 2 Styles
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  settingSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#fafafa',
    borderRadius: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  visibilityOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  visibilityOptionActive: {
    borderColor: '#FF6B00',
    backgroundColor: '#fff3e0',
  },
  visibilityOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  visibilityOptionTextActive: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  rewardToggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  toggleButtonActive: {
    borderColor: '#FF6B00',
    backgroundColor: '#FF6B00',
  },
  toggleButtonDisabled: {
    opacity: 0.5,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  rewardConfig: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 16,
  },
  rewardField: {
    marginBottom: 16,
  },
  rewardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  rewardInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },
  rewardHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  coinSelector: {
    marginTop: 8,
  },
  coinOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    marginRight: 8,
    alignItems: 'center',
    gap: 4,
  },
  coinOptionActive: {
    borderColor: '#FF6B00',
    backgroundColor: '#fff3e0',
  },
  coinOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  coinOptionTextActive: {
    color: '#FF6B00',
  },
  coinBalance: {
    fontSize: 10,
    color: '#999',
  },
  rewardAmountsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  rewardAmountItem: {
    flex: 1,
  },
  rewardAmountLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  rewardAmountInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 12,
    color: '#ff4444',
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
  },
  noCoinsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginTop: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  coinsLoadingText: {
    fontSize: 12,
    color: '#666',
  },
  // Step 3 Review Styles
  reviewCard: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  reviewVisibilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  reviewVisibility: {
    fontSize: 12,
    color: '#666',
  },
  reviewContent: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    marginBottom: 12,
  },
  reviewMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reviewMediaItem: {
    width: '48%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  reviewMediaMore: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  reviewMediaMoreText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reviewReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
  },
  reviewRewardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B00',
  },
  // Old Modal Styles (for comments)
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
  },
  commentsList: {
    maxHeight: 400,
    marginBottom: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
    marginBottom: 4,
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#000',
    maxHeight: 100,
  },
  commentSubmit: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentSubmitDisabled: {
    opacity: 0.6,
  },
  commentSubmitText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 2,
  },
  repliesContainer: {
    marginTop: 12,
    marginLeft: 40,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#e0e0e0',
  },
  replyItem: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  replyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  replyContent: {
    flex: 1,
  },
  replyUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  replyText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#000',
    maxHeight: 100,
  },
  replySubmit: {
    backgroundColor: '#FF6B00',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replySubmitDisabled: {
    opacity: 0.5,
  },
  postDetailContent: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  postDetailScroll: {
    flex: 1,
  },
  postDetailComments: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  commentsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  noCommentsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  viewAllCommentsButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewAllCommentsText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 10,
  },
  imageViewerItem: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  imageViewerVideo: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  imageViewerIndicator: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageViewerIndicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingFooterText: {
    fontSize: 14,
    color: '#666',
  },
});

