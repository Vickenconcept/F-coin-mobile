import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../lib/apiClient';
import Toast from 'react-native-toast-message';

export type FeedPost = {
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
  };
  media: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail_url?: string;
    metadata?: Record<string, unknown>;
  }>;
  shared_post?: FeedPost | null;
  created_at: string;
  updated_at: string;
};

export type FeedComment = {
  id: string;
  content: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  created_at: string;
  updated_at: string;
};

export function useFeed(sortBy: 'newest' | 'popular' = 'newest') {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [latestPostId, setLatestPostId] = useState<string | null>(null);

  // Use ref to avoid stale closure issues with sortBy
  const sortByRef = useRef(sortBy);
  useEffect(() => {
    sortByRef.current = sortBy;
  }, [sortBy]);

  const loadFeed = useCallback(async (page = 1, isRefresh = false, overrideSort?: 'newest' | 'popular' | 'new-first') => {
    console.log('Feed: loadFeed called', { page, isRefresh, sortBy: sortByRef.current });

    try {
      if (page === 1) {
        isRefresh ? setRefreshing(true) : setLoading(true);
        setNewPostsCount(0); // Reset new posts count on refresh
      } else {
        setLoadingMore(true);
      }

      const currentSort = overrideSort || sortByRef.current;
      
      console.log('Feed: Making API request', { 
        url: `/v1/feed?sort=${currentSort}&per_page=20&page=${page}`,
        sortBy: currentSort,
        overrideSort,
        page,
        isNewPostsLoad: overrideSort === 'new-first',
        sortByRefCurrent: sortByRef.current
      });

      const response = await apiClient.get<FeedPost[]>(
        `/v1/feed?sort=${currentSort}&per_page=20&page=${page}`
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
            postsCount: newPosts.length,
            totalPosts: meta.total,
            hasMore: meta.current_page < meta.last_page
          });
        }
      } else {
        console.error('Feed: API Error', {
          status: response.status,
          errors: response.errors,
        });
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to load feed',
        });
      }
    } catch (error) {
      console.error('Feed: Network error', error);
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Failed to connect to server',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []); // Empty dependencies - uses refs to avoid stale closures

  // Initial load
  useEffect(() => {
    const testConnectivity = async () => {
      try {
        console.log('Feed: Testing API connectivity...');
        const response = await apiClient.get('/v1/auth/me');
        console.log('Feed: API connectivity test result:', {
          ok: response.ok,
          status: response.status,
          hasData: !!response.data
        });
      } catch (error) {
        console.error('Feed: API connectivity test failed:', error);
      }
    };

    testConnectivity();
    loadFeed(1);
  }, []); // Only run once on mount

  // Reload feed when sort changes
  useEffect(() => {
    // Reload feed when sort changes, but skip initial load
    if (posts.length > 0) {
      loadFeed(1);
    }
  }, [sortBy]);

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
    const timestamp = Date.now();
    console.log(`🔥 NEW POSTS BUTTON CLICKED - ${timestamp}`);
    console.log('Feed: Current sortBy ref:', sortByRef.current);
    console.log('Feed: About to call loadFeed with new-first override');
    
    // Reset state immediately for UI feedback
    setNewPostsCount(0);
    setPosts([]); // Clear current posts to force refresh
    setLoading(true);
    
    // Use regular loading (not refresh) to ensure proper state management
    console.log(`🚀 Calling loadFeed with new-first - ${timestamp}`);
    await loadFeed(1, false, 'new-first');
    console.log(`✅ loadFeed with new-first completed - ${timestamp}`);
  }, []);

  // Set up background polling for new posts
  useEffect(() => {
    if (!latestPostId) return;
    
    const interval = setInterval(checkForNewPosts, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [checkForNewPosts, latestPostId]);

  const onRefresh = useCallback(() => {
    setCurrentPage(1);
    setHasMorePages(true);
    loadFeed(1, true);
  }, []);

  const handleLike = useCallback(async (postId: string) => {
    try {
      const response = await apiClient.request<{ liked: boolean; likes_count: number }>(
        `/v1/feed/posts/${postId}/like`,
        { method: 'POST' }
      );

      if (response.ok && response.data) {
        const { liked, likes_count } = response.data;
        setPosts(prevPosts =>
          prevPosts.map(p =>
            p.id === postId
              ? { ...p, is_liked: liked, likes_count }
              : p
          )
        );
      }
    } catch (error) {
      console.error('Like error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to like post',
      });
    }
  }, [setPosts]);

  const handleShare = useCallback(async (post: FeedPost) => {
    // This will be handled by the ShareModal component
    console.log('Share post:', post.id);
  }, []);

  const handleShareToTimeline = useCallback(async (postId: string, comment?: string) => {
    console.log('🔄 useFeed: handleShareToTimeline called with:', { postId, comment });
    try {
      console.log('📤 useFeed: Making API request to share endpoint');
      const response = await apiClient.request<{ 
        id: string; 
        shares_count: number;
        shared_post?: FeedPost;
      }>(`/v1/feed/posts/${postId}/share`, {
        method: 'POST',
        data: { comment, share_to_timeline: true }
      });
      console.log('📥 useFeed: API response received:', { ok: response.ok, status: response.status, hasData: !!response.data });

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
        // API call failed - throw error so modal doesn't close
        throw new Error(response.errors?.[0]?.detail || 'Failed to share post');
      }
    } catch (error) {
      console.error('Share error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to share post',
      });
      throw error; // Re-throw so calling components know it failed
    }
  }, [setPosts]);

  const createPost = useCallback(async (postData: any) => {
    try {
      const response = await apiClient.request<FeedPost>('/v1/feed/posts', {
        method: 'POST',
        data: postData,
      });

      if (response.ok && response.data) {
        setPosts(prev => [response.data!, ...prev]);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Post created successfully',
        });
        return response.data;
      }
    } catch (error) {
      console.error('Create post error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create post',
      });
    }
  }, [setPosts]);

  return {
    posts,
    setPosts,
    loading,
    refreshing,
    loadingMore,
    hasMorePages,
    newPostsCount,
    setNewPostsCount,
    loadFeed,
    loadMorePosts,
    loadNewPosts,
    onRefresh,
    handleLike,
    handleShare,
    handleShareToTimeline,
    createPost,
  };
}
