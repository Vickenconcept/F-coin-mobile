import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { FeedMediaGrid } from './FeedMediaGrid';
import { MentionText } from './MentionText';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { FeedPost } from '../hooks/useFeed';

const { width: screenWidth } = Dimensions.get('window');

type FeedPostItemProps = {
  post: FeedPost;
  currentUserId: string;
  onLike: (postId: string) => void;
  onComment: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onOpenProfile: (userId: string) => void;
  onOpenPost: (post: FeedPost) => void;
  onImagePress?: (imageIndex: number) => void;
  isLiking?: boolean;
  isSharing?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
};

export function FeedPostItem({
  post,
  currentUserId,
  onLike,
  onComment,
  onShare,
  onOpenProfile,
  onOpenPost,
  onImagePress,
  isLiking = false,
  isSharing = false,
  isExpanded = false,
  onToggleExpanded,
}: FeedPostItemProps) {
  
  // Debug logging to check post structure
  if (post.shared_post) {
    console.log('🔍 FeedPostItem: Shared post detected', {
      postId: post.id,
      postUser: post.user.username,
      sharedPostId: post.shared_post.id,
      sharedPostUser: post.shared_post.user.username,
      hasSharedPost: !!post.shared_post
    });
  }
  // Add safety checks for post data
  if (!post || !post.user) {
    console.error('FeedPostItem: Invalid post data', post);
    return null;
  }
  const handleLike = useCallback(() => {
    if (!isLiking) {
      onLike(post.id);
    }
  }, [post.id, onLike, isLiking]);

  const handleComment = useCallback(() => {
    onComment(post);
  }, [post, onComment]);

  const handleShare = useCallback(() => {
    onShare(post);
  }, [post, onShare]);


  const formatTimeAgo = useCallback((dateString: string) => {
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
  }, []);

  const renderSharedPost = useCallback((sharedPost: FeedPost) => {
    if (!sharedPost || !sharedPost.user) {
      return null;
    }
    
    return (
    <View style={styles.sharedPost}>
      <View style={styles.sharedPostHeader}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => onOpenProfile(sharedPost.user.username)}
        >
          <Image
            source={{ 
              uri: sharedPost.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sharedPost.user.display_name || sharedPost.user.username)}&background=FF6B00&color=fff`
            }}
            style={styles.sharedAvatar}
          />
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.sharedDisplayName}>
                {sharedPost.user.display_name || sharedPost.user.username}
              </Text>
              {sharedPost.user.verified_creator && (
                <FontAwesome name="check-circle" size={14} color="#1DA1F2" style={styles.verifiedIcon} />
              )}
            </View>
            <Text style={styles.sharedUsername}>@{sharedPost.user.username}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.sharedTimestamp}>{formatTimeAgo(sharedPost.created_at)}</Text>
      </View>

      {sharedPost.content && (
        <TouchableOpacity 
          onPress={() => onToggleExpanded && onToggleExpanded()}
          activeOpacity={0.8}
        >
          <MentionText 
            text={sharedPost.content} 
            style={styles.sharedContent}
            numberOfLines={isExpanded ? undefined : 3}
          />
          {sharedPost.content.length > 150 && onToggleExpanded && (
            <Text style={styles.showMoreText}>
              {isExpanded ? 'Show less' : 'Show more'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {sharedPost.media && Array.isArray(sharedPost.media) && sharedPost.media.length > 0 && (
        <FeedMediaGrid 
          media={sharedPost.media} 
          onImagePress={onImagePress}
        />
      )}
    </View>
    );
  }, [onOpenProfile, formatTimeAgo]);

  return (
    <View style={styles.container}>
      {/* Post Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => onOpenProfile(post.user.username)}
        >
          <Image
            source={{ 
              uri: post.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user.display_name || post.user.username)}&background=FF6B00&color=fff`
            }}
            style={styles.avatar}
          />
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>
                {post.user.display_name || post.user.username}
              </Text>
              {post.user.verified_creator && (
                <FontAwesome name="check-circle" size={14} color="#1DA1F2" style={styles.verifiedIcon} />
              )}
            </View>
            <Text style={styles.username}>@{post.user.username}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.timestamp}>{formatTimeAgo(post.created_at)}</Text>
      </View>

      {/* Post Content */}
      <TouchableOpacity onPress={() => onOpenPost(post)} activeOpacity={0.95}>
        {post.content && (
          <TouchableOpacity 
            onPress={onToggleExpanded}
            activeOpacity={0.8}
          >
            <MentionText 
              text={post.content} 
              style={styles.content}
              numberOfLines={isExpanded ? undefined : 3}
            />
            {post.content.length > 150 && onToggleExpanded && (
              <Text style={styles.showMoreText}>
                {isExpanded ? 'Show less' : 'Show more'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Media - Only show if this is NOT a shared post (to avoid duplicate media) */}
        {!post.shared_post && post.media && Array.isArray(post.media) && post.media.length > 0 && (
          <FeedMediaGrid 
            media={post.media} 
            onImagePress={onImagePress}
          />
        )}

        {/* Share Header - if this is a shared post */}
        {post.shared_post && (
          <View style={styles.shareHeader}>
            <View style={styles.shareHeaderContent}>
              <FontAwesome name="share" size={14} color="#FF6B00" />
              <Text style={styles.shareHeaderText}>
                {post.user.display_name || post.user.username} shared a post
              </Text>
            </View>
          </View>
        )}

        {/* Shared Post */}
        {post.shared_post && renderSharedPost(post.shared_post)}

        {/* Reward Badge */}
        {post.reward_enabled && (
          <View style={styles.rewardBadge}>
            <FontAwesome name="dollar" size={14} color="#FF6B00" />
            <Text style={styles.rewardText}> {post.reward_pool}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Post Actions */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, post.is_liked && styles.likedButton]}
          onPress={handleLike}
          disabled={isLiking}
        >
          <FontAwesome 
            name={post.is_liked ? "heart" : "heart-o"} 
            size={16} 
            color={post.is_liked ? "#FF6B00" : "#666"} 
          />
          <Text style={[styles.actionText, post.is_liked && styles.likedText]}>
            {post.likes_count}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
          <FontAwesome name="comment-o" size={16} color="#666" />
          <Text style={styles.actionText}>{post.comments_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleShare}
          disabled={isSharing}
        >
          <FontAwesome name="share" size={16} color="#666" />
          <Text style={styles.actionText}>{post.shares_count}</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginBottom: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  username: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    fontSize: 16,
    lineHeight: 22,
    color: '#000',
    marginBottom: 12,
  },
  sharedPost: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    backgroundColor: '#f9f9f9',
  },
  sharedPostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sharedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  sharedDisplayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  sharedUsername: {
    fontSize: 12,
    color: '#666',
  },
  sharedTimestamp: {
    fontSize: 12,
    color: '#666',
  },
  sharedContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#000',
    marginBottom: 8,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  rewardText: {
    fontSize: 12,
    color: '#FF6B00',
    marginLeft: 4,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  likedButton: {
    backgroundColor: '#FFF3E0',
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  likedText: {
    color: '#FF6B00',
  },
  showMoreText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
    marginTop: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  shareHeader: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
  },
  shareHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareHeaderText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
});
