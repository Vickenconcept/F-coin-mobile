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
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);

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

  const handleSubmitComment = useCallback(async () => {
    if (!post || !newComment.trim()) return;

    setCommenting(true);
    try {
      const response = await apiClient.request<Comment>(`/v1/feed/posts/${post.id}/comment`, {
        method: 'POST',
        data: {
          content: newComment.trim(),
          parent_id: null,
        },
      });

      if (response.ok && response.data) {
        const newCommentData = {
          ...response.data,
          replies: response.data.replies || [],
        };

        setComments((prev) => [newCommentData, ...prev]);
        setNewComment('');
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
  }, [post, newComment, onUpdatePost]);

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

  if (!post) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
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
                onPress={() => onOpenProfile(post.user.id)}
              >
                <Image
                  source={{ 
                    uri: post.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user.display_name || post.user.username)}&background=FF6B00&color=fff`
                  }}
                  style={styles.avatar}
                />
                <View>
                  <Text style={styles.displayName}>
                    {post.user.display_name || post.user.username}
                  </Text>
                  <Text style={styles.username}>@{post.user.username}</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.timestamp}>{formatTimeAgo(post.created_at)}</Text>
            </View>

            {/* Post Content */}
            {post.content && (
              <MentionText text={post.content} style={styles.postContent} />
            )}

            {/* Post Media */}
            {(post as any).media && Array.isArray((post as any).media) && (post as any).media.length > 0 && (
              <FeedMediaGrid media={(post as any).media} />
            )}

            {/* Post Actions */}
            <View style={styles.postActions}>
              <TouchableOpacity 
                style={[styles.actionButton, (post as any).is_liked && styles.likedButton]}
                onPress={() => onLike(post.id)}
                disabled={isLiking}
              >
                <FontAwesome 
                  name={(post as any).is_liked ? "heart" : "heart-o"} 
                  size={20} 
                  color={(post as any).is_liked ? "#FF6B00" : "#666"} 
                />
                <Text style={[styles.actionText, (post as any).is_liked && styles.likedText]}>
                  {post.likes_count}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <FontAwesome name="comment-o" size={20} color="#666" />
                <Text style={styles.actionText}>{post.comments_count}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => setShareModalVisible(true)}
                disabled={isSharing}
              >
                <FontAwesome name="share" size={20} color="#666" />
                <Text style={styles.actionText}>{(post as any).shares_count || 0}</Text>
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
              <Text style={styles.noCommentsText}>No comments yet</Text>
            ) : (
              comments.slice(0, 5).map((comment) => (
                <View key={comment.id} style={styles.commentItem}>
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
                  </View>
                </View>
              ))
            )}

            {comments.length > 5 && (
              <TouchableOpacity style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View all {comments.length} comments</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* Comment Input */}
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
            onPress={handleSubmitComment}
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
          post={post as any}
          onShareToTimeline={async () => {
            setShareModalVisible(false);
            onShare(post);
          }}
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
  viewAllButton: {
    alignSelf: 'center',
    paddingVertical: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '500',
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
