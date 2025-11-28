import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  DeviceEventEmitter,
  Animated,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FeedLayout } from '../../components/FeedLayout';
import Toast from 'react-native-toast-message';
import FontAwesome from '@expo/vector-icons/FontAwesome';

// Import our new modular components
import { useFeed, FeedPost } from '../../hooks/useFeed';
import { FeedPostItem } from '../../components/FeedPostItem';
import { PostComposer } from '../../components/PostComposer';
import { CommentModal } from '../../components/CommentModal';
import { PostDetailModal } from '../../components/PostDetailModal';
import { ImageZoomViewer } from '../../components/ImageZoomViewer';
import { ShareModal } from '../../components/ShareModal';
import { feedStyles } from '../../styles/feedStyles';
import { apiClient } from '../../lib/apiClient';

export default function FeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
  const [composerVisible, setComposerVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [postDetailModalVisible, setPostDetailModalVisible] = useState(false);
  const [imageZoomVisible, setImageZoomVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState<Array<{ url: string; type: 'image' | 'video' }>>([]);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [postToShare, setPostToShare] = useState<FeedPost | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [isLiking, setIsLiking] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<string | null>(null);

  // Animated values for image zoom
  const imageScale = useRef(new Animated.Value(1)).current;
  const imageTranslateX = useRef(new Animated.Value(0)).current;
  const imageTranslateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef({ value: 1 });
  const lastTranslate = useRef({ x: 0, y: 0 });

  const {
    posts,
    setPosts,
    loading,
    refreshing,
    loadingMore,
    hasMorePages,
    newPostsCount,
    loadFeed,
    loadMorePosts,
    loadNewPosts,
    onRefresh,
    handleLike,
    handleShare: handleShareFromHook,
    handleShareToTimeline,
    createPost,
  } = useFeed(sortBy);

  // Handle deep linking
  useEffect(() => {
    if (params.openPost && posts.length > 0) {
      const postId = Array.isArray(params.openPost) ? params.openPost[0] : params.openPost;
      const post = posts.find(p => p.id === postId);
      if (post) {
        handleOpenPostDetail(post);
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

  // Handle notification to open composer
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('openFeedComposer', () => {
      setComposerVisible(true);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('openFeedComposer', () => {
      setComposerVisible(true);
    });
    return () => subscription.remove();
  }, []);


  const handleComment = useCallback((post: FeedPost) => {
    setSelectedPost(post);
    setCommentModalVisible(true);
  }, []);

  const handleShareClick = useCallback((post: FeedPost) => {
    setPostToShare(post);
    setShareModalVisible(true);
  }, []);

  const handleOpenPostDetail = useCallback((post: FeedPost) => {
    setSelectedPost(post);
    setPostDetailModalVisible(true);
  }, []);

  const handleOpenProfile = useCallback((username: string) => {
    router.push(`/${username}`);
  }, [router]);

  const handleToggleExpanded = useCallback((postId: string) => {
    setExpandedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  }, []);

  const handleShareToTimelineStable = useCallback(async (comment?: string) => {
    console.log('🎯 Feed: STABLE onShareToTimeline called with comment:', comment);
    console.log('🎯 Feed: postToShare.id:', postToShare?.id);
    
    if (!postToShare) {
      console.error('❌ Feed: postToShare is null!');
      throw new Error('Post to share is not available');
    }

    try {
      console.log('📤 Feed: Making API request to share endpoint');
      const response = await apiClient.request<{ 
        id: string; 
        shares_count: number;
        shared_post?: FeedPost;
      }>(`/v1/feed/posts/${postToShare.id}/share`, {
        method: 'POST',
        data: { comment, share_to_timeline: true }
      });

      console.log('📥 Feed: API response received:', { ok: response.ok, status: response.status, hasData: !!response.data });

      if (response.ok && response.data) {
        // Update the post's shares count in the feed
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postToShare.id
              ? { ...p, shares_count: response.data!.shares_count }
              : p
          )
        );
        
        // If shared to timeline, add the new post to the feed
        if (response.data.shared_post) {
          setPosts((prev) => [response.data!.shared_post!, ...prev]);
        }

        // Also update selectedPost if it's the same post
        if (selectedPost && selectedPost.id === postToShare.id) {
          setSelectedPost({
            ...selectedPost,
            shares_count: response.data.shares_count,
          });
        }

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Post shared to your timeline!',
          visibilityTime: 2000,
        });

        console.log('✅ Feed: STABLE handleShareToTimeline completed successfully');
      } else {
        const errorMessage = response.errors?.[0]?.detail || 'Failed to share post';
        console.error('❌ Feed: Share failed', response.errors);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMessage,
          visibilityTime: 3000,
        });
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('❌ Feed: Share to timeline error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to share post. Please try again.',
        visibilityTime: 3000,
      });
      throw error; // Re-throw so ShareModal knows it failed
    }
  }, [postToShare, selectedPost, setPosts]);

  const handleImagePress = useCallback((post: FeedPost, imageIndex: number) => {
    if (post.media && Array.isArray(post.media)) {
      const mediaItems = post.media.map(item => ({ url: item.url, type: item.type }));
      
      if (mediaItems.length > 0) {
        setSelectedMedia(mediaItems);
        setSelectedImageIndex(imageIndex);
        setImageZoomVisible(true);
        
        // Reset zoom when opening
        imageScale.setValue(1);
        imageTranslateX.setValue(0);
        imageTranslateY.setValue(0);
        lastScale.current.value = 1;
        lastTranslate.current.x = 0;
        lastTranslate.current.y = 0;
      }
    }
  }, [imageScale, imageTranslateX, imageTranslateY, lastScale, lastTranslate]);

  const handleUpdatePost = useCallback((updatedPost: Partial<FeedPost>) => {
    if (selectedPost) {
      const newPost = { ...selectedPost, ...updatedPost };
      setSelectedPost(newPost);
      
      // Update in the main posts list
      setPosts(prevPosts =>
        prevPosts.map(p =>
          p.id === selectedPost.id ? { ...p, ...updatedPost } : p
        )
      );
    }
  }, [selectedPost, setPosts]);

  const handleShare = useCallback(async (post: FeedPost) => {
    if (isSharing || !user) return;

    setIsSharing(post.id);
    try {
      const response = await apiClient.request(`/v1/feed/${post.id}/share`, {
        method: 'POST',
        data: {
          share_to_timeline: true,
        },
      });

      if (response.ok && response.data) {
        const shareData = response.data as { shares_count: number; shared_post?: FeedPost };
        setPosts(prevPosts =>
          prevPosts.map(p =>
            p.id === post.id
              ? { ...p, shares_count: shareData.shares_count }
              : p
          )
        );
        
        if (shareData.shared_post) {
          setPosts((prev) => [shareData.shared_post!, ...prev]);
        }
        
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Post shared successfully',
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to share post',
      });
    } finally {
      setIsSharing(null);
    }
  }, [isSharing, user, setPosts]);

  const handlePostCreated = useCallback(() => {
    loadFeed(1);
  }, [loadFeed]);

  const renderPost = useCallback(({ item }: { item: FeedPost }) => (
    <FeedPostItem
      post={item}
      currentUserId={user?.id?.toString() || ''}
      onLike={handleLike}
      onComment={handleComment}
      onShare={handleShareClick}
      onOpenProfile={handleOpenProfile}
      onOpenPost={handleOpenPostDetail}
      onImagePress={(imageIndex) => handleImagePress(item, imageIndex)}
      isLiking={isLiking === item.id}
      isSharing={isSharing === item.id}
      isExpanded={expandedPosts[item.id] || false}
      onToggleExpanded={() => handleToggleExpanded(item.id)}
    />
  ), [user?.id, handleLike, handleComment, handleShareClick, handleOpenProfile, handleOpenPostDetail, handleImagePress, isLiking, isSharing]);

  const renderLoadingFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={feedStyles.loadingFooter}>
        <ActivityIndicator size="small" color="#FF6B00" />
        <Text style={feedStyles.loadingFooterText}>Loading more posts...</Text>
      </View>
    );
  }, [loadingMore]);

  if (!user) {
    return (
      <View style={feedStyles.loadingContainer}>
        <Text style={feedStyles.loadingText}>Please log in to view the feed</Text>
      </View>
    );
  }

  return (
    <FeedLayout>
      <View style={feedStyles.container}>
        {/* Header */}
        <View style={feedStyles.header}>
          <Text style={feedStyles.headerTitle}>Feed</Text>
          
          {/* Sort Toggle - Centered */}
          <View style={feedStyles.sortContainer}>
            <TouchableOpacity
              style={[
                feedStyles.sortButton,
                sortBy === 'newest' && feedStyles.sortButtonActive,
              ]}
              onPress={() => setSortBy('newest')}
            >
              <FontAwesome 
                name="clock-o" 
                size={14} 
                color={sortBy === 'newest' ? '#fff' : '#666'} 
              />
              <Text style={[
                feedStyles.sortButtonText,
                sortBy === 'newest' && feedStyles.sortButtonTextActive,
              ]}>
                Newest
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                feedStyles.sortButton,
                sortBy === 'popular' && feedStyles.sortButtonActive,
              ]}
              onPress={() => setSortBy('popular')}
            >
              <FontAwesome 
                name="fire" 
                size={14} 
                color={sortBy === 'popular' ? '#fff' : '#666'} 
              />
              <Text style={[
                feedStyles.sortButtonText,
                sortBy === 'popular' && feedStyles.sortButtonTextActive,
              ]}>
                Popular
              </Text>
            </TouchableOpacity>
          </View>

          {/* Create Post Button - Far Right */}
          <TouchableOpacity
            style={feedStyles.createButton}
            onPress={() => setComposerVisible(true)}
          >
            <FontAwesome name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* New Posts Notification */}
        {newPostsCount > 0 && (
          <View style={feedStyles.newPostsContainer}>
            <TouchableOpacity
              style={feedStyles.newPostsBubble}
              onPress={loadNewPosts}
              activeOpacity={0.8}
            >
              <FontAwesome name="arrow-up" size={16} color="#fff" />
              <Text style={feedStyles.newPostsText}>
                {newPostsCount} new post{newPostsCount !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Feed */}
        <FlatList
          style={feedStyles.feed}
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMorePosts}
          onEndReachedThreshold={0.1}
          ListFooterComponent={renderLoadingFooter}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          windowSize={10}
          ListEmptyComponent={
            loading ? (
              <View style={feedStyles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF6B00" />
                <Text style={feedStyles.loadingText}>Loading feed...</Text>
              </View>
            ) : (
              <View style={feedStyles.emptyContainer}>
                <FontAwesome name="comments-o" size={48} color="#ccc" />
                <Text style={feedStyles.emptyText}>No posts yet</Text>
                <Text style={feedStyles.emptySubtext}>
                  Be the first to share something!
                </Text>
              </View>
            )
          }
        />

        {/* Post Composer */}
        <PostComposer
          visible={composerVisible}
          onClose={() => setComposerVisible(false)}
          onPostCreated={handlePostCreated}
          userId={user.id.toString()}
          defaultCoinSymbol={(user.default_coin_symbol as string) || 'FCN'}
        />

        {/* Comment Modal */}
        <CommentModal
          visible={commentModalVisible}
          onClose={() => {
            setCommentModalVisible(false);
            setSelectedPost(null);
          }}
          post={selectedPost}
          onUpdatePost={handleUpdatePost}
        />

        {/* Post Detail Modal */}
        <PostDetailModal
          visible={postDetailModalVisible}
          onClose={() => {
            setPostDetailModalVisible(false);
            setSelectedPost(null);
          }}
          post={selectedPost}
          onUpdatePost={handleUpdatePost}
          onLike={handleLike}
          onShare={(post) => handleShareClick(post as any)}
          onOpenProfile={handleOpenProfile}
          isLiking={isLiking === selectedPost?.id}
          isSharing={isSharing === selectedPost?.id}
        />

        {/* Image Zoom Viewer */}
        <ImageZoomViewer
          visible={imageZoomVisible}
          onClose={() => {
            setImageZoomVisible(false);
            // Reset zoom
            imageScale.setValue(1);
            imageTranslateX.setValue(0);
            imageTranslateY.setValue(0);
            lastScale.current.value = 1;
            lastTranslate.current.x = 0;
            lastTranslate.current.y = 0;
          }}
          media={selectedMedia}
          initialIndex={selectedImageIndex}
          onIndexChange={(index) => {
            setSelectedImageIndex(index);
            // Reset zoom when changing images
            imageScale.setValue(1);
            imageTranslateX.setValue(0);
            imageTranslateY.setValue(0);
            lastScale.current.value = 1;
            lastTranslate.current.x = 0;
            lastTranslate.current.y = 0;
          }}
          imageScale={imageScale}
          imageTranslateX={imageTranslateX}
          imageTranslateY={imageTranslateY}
          lastScale={lastScale.current}
          lastTranslate={lastTranslate.current}
        />

        {/* Share Modal */}
        {postToShare && (
          <ShareModal
            visible={shareModalVisible}
            onClose={() => {
              console.log('🔒 Feed: ShareModal onClose called');
              setShareModalVisible(false);
              setPostToShare(null);
            }}
            post={postToShare}
            onShareToTimeline={handleShareToTimelineStable}
          />
        )}
      </View>
    </FeedLayout>
  );
}
