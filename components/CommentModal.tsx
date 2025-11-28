import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  BackHandler,
} from 'react-native';
import { apiClient } from '../lib/apiClient';
import Toast from 'react-native-toast-message';
import { MentionText } from './MentionText';
import { MentionInput } from './MentionInput';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export type Comment = {
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

export type FeedPost = {
  id: string;
  content: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  comments_count: number;
  likes_count: number;
  shares_count: number;
  created_at: string;
};

type CommentModalProps = {
  visible: boolean;
  onClose: () => void;
  post: FeedPost | null;
  onUpdatePost: (updatedPost: Partial<FeedPost>) => void;
};

export function CommentModal({ visible, onClose, post, onUpdatePost }: CommentModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [likingComment, setLikingComment] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    if (!post) return;

    setLoadingComments(true);
    try {
      const response = await apiClient.get<Comment[]>(
        `/v1/feed/posts/${post.id}/comments`
      );

      if (response.ok && response.data) {
        const commentsWithReplies = response.data.map(comment => ({
          ...comment,
          replies: comment.replies || []
        }));
        setComments(commentsWithReplies);
      }
    } catch (error) {
      console.error('Load comments error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load comments',
      });
    } finally {
      setLoadingComments(false);
    }
  }, [post]);

  useEffect(() => {
    if (visible && post) {
      loadComments();
    } else {
      setComments([]);
      setNewComment('');
      setReplyContent({});
      setReplyingTo(null);
    }
  }, [visible, post, loadComments]);

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
    if (!post) return;

    const content = parentId ? (replyContent[parentId] || '').trim() : newComment.trim();
    if (!content) return;

    setCommenting(true);
    try {
      const response = await apiClient.request<Comment>(`/v1/feed/posts/${post.id}/comment`, {
        method: 'POST',
        data: {
          content,
          parent_id: parentId || null,
        },
      });

      if (response.ok && response.data) {
        const newCommentData = {
          ...response.data,
          replies: response.data.replies || [],
        };

        if (parentId) {
          // It's a reply - cast to reply type
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
                ? { ...comment, replies: [replyData, ...comment.replies] }
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

        // Update post comments count
        onUpdatePost({ comments_count: post.comments_count + 1 });

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Comment posted successfully',
        });
      }
    } catch (error) {
      console.error('Submit comment error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to post comment',
      });
    } finally {
      setCommenting(false);
    }
  }, [post, newComment, replyContent, onUpdatePost]);

  const handleLikeComment = useCallback(async (commentId: string) => {
    if (!post || likingComment) return;

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
      const response = await apiClient.request<{ liked: boolean; likes_count: number }>(
        `/v1/feed/posts/${post.id}/comments/${commentId}/like`,
        { method: 'POST' }
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
      console.error('Like comment error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to like comment',
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
          >
            <FontAwesome
              name={comment.is_liked ? "heart" : "heart-o"}
              size={14}
              color={comment.is_liked ? "#FF6B00" : "#666"}
            />
            {comment.likes_count > 0 && (
              <Text style={[styles.commentActionText, comment.is_liked && styles.likedText]}>
                {comment.likes_count}
              </Text>
            )}
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
        {comment.replies && comment.replies.length > 0 && (
          <View style={styles.repliesContainer}>
            {comment.replies.map((reply: any) => renderComment(reply, true))}
          </View>
        )}
      </View>
    </View>
  ), [replyingTo, replyContent, commenting, handleLikeComment, handleSubmitComment, formatTimeAgo]);

  if (!post) return null;

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
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <FontAwesome name="times" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>Comments</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.commentsList} showsVerticalScrollIndicator={false}>
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
        </ScrollView>

        <View style={styles.inputContainer}>
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
  commentsList: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  replyItem: {
    marginLeft: 40,
    marginTop: 12,
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
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
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
  },
  likedText: {
    color: '#FF6B00',
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
  },
  replyButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 12,
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
