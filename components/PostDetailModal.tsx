import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../lib/apiClient';
import Toast from 'react-native-toast-message';
import { FeedMediaGrid } from './FeedMediaGrid';
import { MentionText } from './MentionText';
import { MentionInput } from './MentionInput';
import { ShareModal } from './ShareModal';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Comment, FeedPost } from './CommentModal';

type PostDetailModalProps = {
  visible: boolean;
  onClose: () => void;
  post: FeedPost | null;
  onUpdatePost: (updatedPost: Partial<FeedPost>) => void;
  onLike: (postId: string) => void;
  onShare: (post: FeedPost) => void;
  onOpenProfile: (userId: string) => void;
  isLiking?: boolean;
  isSharing?: boolean;
};

export function PostDetailModal({
  visible,
  onClose,
  post,
  onUpdatePost,
  onLike,
  onShare,
  onOpenProfile,
  isLiking = false,
  isSharing = false,
}: PostDetailModalProps) {
  const insets = useSafeAreaInsets();
  // Local state for post to allow optimistic updates
  const [displayPost, setDisplayPost] = useState<FeedPost | null>(post);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [likingComment, setLikingComment] = useState<string | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [isSharingToTimeline, setIsSharingToTimeline] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  // Sync displayPost with post prop when modal opens or post ID changes
  useEffect(() => {
    if (visible && post) {
      setDisplayPost(post);
    }
  }, [visible, post?.id]);

  // Handle share to timeline
  const handleShareToTimeline = useCallback(async (comment?: string) => {
    if (!displayPost || isSharingToTimeline) {
      console.log('PostDetailModal: Cannot share - no post or already sharing');
      return;
    }

    console.log('PostDetailModal: Sharing to timeline', { postId: displayPost.id, comment });

    setIsSharingToTimeline(true);
    try {
      const response = await apiClient.request<{ 
        id: string; 
        shares_count: number;
        shared_post?: FeedPost;
      }>(`/v1/feed/posts/${displayPost.id}/share`, {
        method: 'POST',
        data: { comment, share_to_timeline: true }
      });

      console.log('PostDetailModal: Share response', { ok: response.ok, hasData: !!response.data });

      if (response.ok && response.data) {
        // Update the post's shares count
        setDisplayPost({
          ...displayPost,
          shares_count: response.data.shares_count,
        } as FeedPost);

        // Update parent
        onUpdatePost({
          shares_count: response.data.shares_count,
        });

        // ShareModal will show success toast and close itself
      } else {
        const errorMessage = response.errors?.[0]?.detail || 'Failed to share post';
        console.error('PostDetailModal: Share failed', response.errors);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMessage,
          visibilityTime: 3000,
        });
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('PostDetailModal: Share to timeline error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to share post. Please try again.',
        visibilityTime: 3000,
      });
      throw error; // Re-throw so ShareModal knows it failed
    } finally {
      setIsSharingToTimeline(false);
    }
  }, [displayPost, isSharingToTimeline, onUpdatePost]);

  // Handle post like with optimistic update
  const handlePostLike = useCallback(() => {
    if (!displayPost || isLiking) return;

    // Optimistic update - update UI immediately
    const currentIsLiked = (displayPost as any).is_liked ?? false;
    const newIsLiked = !currentIsLiked;
    const newLikesCount = newIsLiked 
      ? (displayPost.likes_count || 0) + 1 
      : Math.max(0, (displayPost.likes_count || 0) - 1);

    const updatedPost = {
      ...displayPost,
      likes_count: newLikesCount,
      is_liked: newIsLiked,
    } as any;

    setDisplayPost(updatedPost as FeedPost);

    // Also update parent
    onUpdatePost({
      likes_count: newLikesCount,
      ...({ is_liked: newIsLiked } as any),
    });

    // Call the parent's like handler (which will sync with API)
    onLike(displayPost.id);
  }, [displayPost, isLiking, onLike, onUpdatePost]);

  const loadComments = useCallback(async (postId: string) => {
    if (!postId) return;

    setLoadingComments(true);
    try {
      const response = await apiClient.get<Comment[]>(
        `/v1/feed/posts/${postId}/comments`
      );

      if (response.ok && response.data) {
        const commentsWithReplies = response.data.map(comment => ({
          ...comment,
          is_liked: comment.is_liked ?? false,
          likes_count: comment.likes_count ?? 0,
          replies: (comment.replies || []).map(reply => ({
            ...reply,
            is_liked: reply.is_liked ?? false,
            likes_count: reply.likes_count ?? 0,
          }))
        }));
        setComments(commentsWithReplies);
        console.log('PostDetailModal: Loaded comments', { count: commentsWithReplies.length });
      }
    } catch (error) {
      console.error('Load comments error:', error);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  useEffect(() => {
    if (visible && displayPost?.id) {
      loadComments(displayPost.id);
    } else {
      setComments([]);
      setNewComment('');
      setReplyContent({});
      setReplyingTo(null);
      setExpandedReplies({});
    }
  }, [visible, displayPost?.id, loadComments]);

  // Handle Android back button
  useEffect(() => {
    if (!visible) return;

    const backAction = () => {
      onClose();
      return true; // Prevent default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [visible, onClose]);

  const handleSubmitComment = useCallback(async (parentId?: string) => {
    if (!displayPost) {
      console.log('PostDetailModal: Cannot submit comment - no post');
      return;
    }

    const content = parentId ? (replyContent[parentId] || '').trim() : newComment.trim();
    if (!content) {
      console.log('PostDetailModal: Cannot submit comment - no content');
      return;
    }

    console.log('PostDetailModal: Submitting comment', { parentId, contentLength: content.length });

    setCommenting(true);
    try {
      const response = await apiClient.request<Comment>(`/v1/feed/posts/${displayPost.id}/comment`, {
        method: 'POST',
        data: {
          content,
          parent_id: parentId || null,
        },
      });

      console.log('PostDetailModal: Comment response', { ok: response.ok, hasData: !!response.data, errors: response.errors });

      if (response.ok && response.data) {
        const newCommentData = {
          ...response.data,
          replies: response.data.replies || [],
        };

        if (parentId) {
          // It's a reply
          const replyData = {
            id: newCommentData.id,
            content: newCommentData.content,
            user: newCommentData.user,
            likes_count: newCommentData.likes_count,
            is_liked: newCommentData.is_liked,
            created_at: newCommentData.created_at,
          };
          
          setComments((prev) =>
            prev.map((comment) =>
              comment.id === parentId
                ? { ...comment, replies: [replyData, ...(comment.replies || [])] }
                : comment
            )
          );
          setReplyContent((prev) => ({ ...prev, [parentId]: '' }));
          setReplyingTo(null);
        } else {
          // It's a top-level comment
          setComments((prev) => [newCommentData, ...prev]);
          setNewComment('');
        }

        onUpdatePost({ comments_count: displayPost.comments_count + 1 });

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Comment posted successfully',
        });
      } else {
        // Response not ok
        const errorMessage = response.errors?.[0]?.detail || 'Failed to post comment';
        console.error('PostDetailModal: Comment submission failed', response.errors);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMessage,
        });
      }
    } catch (error) {
      console.error('PostDetailModal: Submit comment error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to post comment. Please try again.',
      });
    } finally {
      setCommenting(false);
    }
  }, [displayPost, newComment, replyContent, onUpdatePost]);

  const handleLikeComment = useCallback(async (commentId: string) => {
    console.log('PostDetailModal: handleLikeComment called', { commentId, hasPost: !!displayPost, likingComment });
    
    if (!displayPost) {
      console.log('PostDetailModal: Cannot like comment - no post');
      return;
    }
    
    if (likingComment) {
      console.log('PostDetailModal: Already liking a comment, ignoring');
      return;
    }

    // Find the comment/reply to get current state
    let targetComment: { is_liked: boolean; likes_count: number } | undefined;
    
    // First check if it's a top-level comment
    const topLevelComment = comments.find((c) => c.id === commentId);
    if (topLevelComment) {
      targetComment = topLevelComment;
      console.log('PostDetailModal: Found top-level comment', { is_liked: topLevelComment.is_liked, likes_count: topLevelComment.likes_count });
    } else {
      // If not found, check if it's a reply
      for (const comment of comments) {
        const reply = comment.replies?.find((r) => r.id === commentId);
        if (reply) {
          targetComment = reply;
          console.log('PostDetailModal: Found reply', { is_liked: reply.is_liked, likes_count: reply.likes_count });
          break;
        }
      }
    }

    if (!targetComment) {
      console.log('PostDetailModal: Comment not found', { commentId, commentsCount: comments.length });
      return;
    }

    // Optimistic update
    const newLikedState = !targetComment.is_liked;
    const newLikesCount = newLikedState 
      ? targetComment.likes_count + 1 
      : Math.max(0, targetComment.likes_count - 1);

    setLikingComment(commentId);
    
    // Update immediately
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            is_liked: newLikedState,
            likes_count: newLikesCount,
          };
        }
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
      console.log('PostDetailModal: Calling API to like comment', { postId: displayPost.id, commentId });
      const response = await apiClient.request<{ liked: boolean; likes_count: number }>(
        `/v1/feed/posts/${displayPost.id}/comments/${commentId}/like`,
        { method: 'POST' }
      );

      console.log('PostDetailModal: Like comment API response', { ok: response.ok, hasData: !!response.data, errors: response.errors });

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
        // Revert optimistic update on failure
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                is_liked: targetComment!.is_liked,
                likes_count: targetComment!.likes_count,
              };
            }
            return {
              ...c,
              replies: (c.replies || []).map((reply) =>
                reply.id === commentId
                  ? {
                      ...reply,
                      is_liked: targetComment!.is_liked,
                      likes_count: targetComment!.likes_count,
                    }
                  : reply
              ),
            };
          })
        );
      }
    } catch (error) {
      console.error('PostDetailModal: Like comment error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to like comment. Please try again.',
      });
      // Revert optimistic update on error
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              is_liked: targetComment!.is_liked,
              likes_count: targetComment!.likes_count,
            };
          }
          return {
            ...c,
            replies: (c.replies || []).map((reply) =>
              reply.id === commentId
                ? {
                    ...reply,
                    is_liked: targetComment!.is_liked,
                    likes_count: targetComment!.likes_count,
                  }
                : reply
            ),
          };
        })
      );
    } finally {
      setLikingComment(null);
    }
  }, [post, comments, likingComment]);

  const formatTimeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return date.toLocaleDateString();
  }, []);

  const renderComment = useCallback((comment: Comment | any, isReply = false) => (
    <View key={comment.id} style={[styles.commentItem, isReply && styles.replyItem]}>
      <Image
        source={{
          uri: comment.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.display_name || comment.user.username)}&background=FF6B00&color=fff`
        }}
        style={styles.commentAvatar}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>
            {comment.user.display_name || comment.user.username}
          </Text>
          <Text style={styles.commentTime}>{formatTimeAgo(comment.created_at)}</Text>
        </View>
        <MentionText text={comment.content} style={styles.commentText} />
        
        <View style={styles.commentActions}>
          <TouchableOpacity
            style={styles.commentAction}
            onPress={() => handleLikeComment(comment.id)}
            disabled={likingComment === comment.id}
          >
            <FontAwesome
              name={comment.is_liked ? "heart" : "heart-o"}
              size={14}
              color={comment.is_liked ? "#FF6B00" : "#666"}
            />
            <Text style={[styles.commentActionText, comment.is_liked && styles.likedText]}>
              {comment.likes_count || 0}
            </Text>
          </TouchableOpacity>
          
          {!isReply && (
            <TouchableOpacity
              style={styles.commentAction}
              onPress={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
            >
              <FontAwesome name="reply" size={14} color="#666" />
              <Text style={styles.commentActionText}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Reply Input */}
        {replyingTo === comment.id && (
          <View style={styles.replyInputContainer}>
            <MentionInput
              value={replyContent[comment.id] || ''}
              onChangeText={(text) =>
                setReplyContent((prev) => ({ ...prev, [comment.id]: text }))
              }
              placeholder="Write a reply..."
              multiline
              style={styles.replyInput}
            />
            <TouchableOpacity
              style={[styles.replyButton, (!replyContent[comment.id]?.trim() || commenting) && styles.replyButtonDisabled]}
              onPress={() => handleSubmitComment(comment.id)}
              disabled={!replyContent[comment.id]?.trim() || commenting}
            >
              {commenting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.replyButtonText}>Reply</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (() => {
          const REPLIES_LIMIT = 5;
          const hasMoreReplies = comment.replies.length > REPLIES_LIMIT;
          const isExpanded = expandedReplies[comment.id] || false;
          const displayedReplies = isExpanded 
            ? comment.replies 
            : comment.replies.slice(0, REPLIES_LIMIT);
          const remainingCount = comment.replies.length - REPLIES_LIMIT;

          return (
            <View style={styles.repliesContainer}>
              {displayedReplies.map((reply: any) => renderComment(reply, true))}
              {hasMoreReplies && !isExpanded && (
                <TouchableOpacity
                  style={styles.viewMoreReplies}
                  onPress={() => setExpandedReplies((prev) => ({ ...prev, [comment.id]: true }))}
                >
                  <Text style={styles.viewMoreRepliesText}>
                    View {remainingCount} more {remainingCount === 1 ? 'reply' : 'replies'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}
      </View>
    </View>
  ), [replyingTo, replyContent, commenting, likingComment, handleLikeComment, handleSubmitComment, formatTimeAgo, expandedReplies]);

  if (!displayPost) return null;

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      {...(Platform.OS === 'ios' ? { presentationStyle: 'pageSheet' } : {})}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity onPress={onClose}>
            <FontAwesome name="times" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>Post</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Post Content */}
          <View style={styles.postContainer}>
            {/* Post Header */}
            <View style={styles.postHeader}>
              <TouchableOpacity 
                style={styles.userInfo}
                onPress={() => onOpenProfile(displayPost.user.id)}
              >
                <Image
                  source={{ 
                    uri: displayPost.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayPost.user.display_name || displayPost.user.username)}&background=FF6B00&color=fff`
                  }}
                  style={styles.avatar}
                />
                <View>
                  <Text style={styles.displayName}>
                    {displayPost.user.display_name || displayPost.user.username}
                  </Text>
                  <Text style={styles.username}>@{displayPost.user.username}</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.timestamp}>{formatTimeAgo(displayPost.created_at)}</Text>
            </View>

            {/* Post Content */}
            {displayPost.content && (
              <MentionText text={displayPost.content} style={styles.postContent} />
            )}

            {/* Post Media */}
            {(displayPost as any).media && Array.isArray((displayPost as any).media) && (displayPost as any).media.length > 0 && (
              <FeedMediaGrid media={(displayPost as any).media} />
            )}

            {/* Post Actions */}
            <View style={styles.postActions}>
              <TouchableOpacity 
                style={[styles.actionButton, (displayPost as any).is_liked && styles.likedButton]}
                onPress={handlePostLike}
                disabled={isLiking}
              >
                <FontAwesome 
                  name={(displayPost as any).is_liked ? "heart" : "heart-o"} 
                  size={20} 
                  color={(displayPost as any).is_liked ? "#FF6B00" : "#666"} 
                />
                <Text style={[styles.actionText, (displayPost as any).is_liked && styles.likedText]}>
                  {displayPost.likes_count}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <FontAwesome name="comment-o" size={20} color="#666" />
                <Text style={styles.actionText}>{displayPost.comments_count}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => setShareModalVisible(true)}
                disabled={isSharing}
              >
                <FontAwesome name="share" size={20} color="#666" />
                <Text style={styles.actionText}>{(displayPost as any).shares_count || 0}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsSectionTitle}>Comments</Text>
            
            {loadingComments ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF6B00" />
                <Text style={styles.loadingText}>Loading comments...</Text>
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <FontAwesome name="comment-o" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptySubtext}>Be the first to comment!</Text>
              </View>
            ) : (
              comments.map((comment) => renderComment(comment))
            )}
          </View>
        </ScrollView>

        {/* Comment Input */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <MentionInput
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Write a comment..."
            multiline
            style={styles.textInput}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newComment.trim() || commenting) && styles.sendButtonDisabled]}
            onPress={() => handleSubmitComment()}
            disabled={!newComment.trim() || commenting}
          >
            {commenting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <FontAwesome name="send" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Share Modal */}
        <ShareModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          post={displayPost as any}
          onShareToTimeline={handleShareToTimeline}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  postContainer: {
    padding: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#f5f5f5',
  },
  postHeader: {
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
  postContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000',
    marginBottom: 16,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
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
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  likedText: {
    color: '#FF6B00',
  },
  commentsSection: {
    padding: 16,
  },
  commentsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  noCommentsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 40,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#000',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  replyItem: {
    marginLeft: 48,
    marginTop: 8,
  },
  replyInputContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  replyInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    maxHeight: 80,
    fontSize: 14,
  },
  replyButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  replyButtonDisabled: {
    opacity: 0.5,
  },
  replyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  repliesContainer: {
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#f0f0f0',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
