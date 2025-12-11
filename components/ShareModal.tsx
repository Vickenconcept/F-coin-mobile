import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Linking,
  Platform,
  Share as RNShare,
  Clipboard,
  BackHandler,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';

type FeedPost = {
  id: string;
  content?: string | null;
  user: {
    display_name?: string | null;
    username: string;
  };
};

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  post: FeedPost;
  onShareToTimeline: (comment?: string) => Promise<void>;
  postUrl?: string;
}

export function ShareModal({
  visible,
  onClose,
  post,
  onShareToTimeline,
  postUrl,
}: ShareModalProps) {
  const [shareComment, setShareComment] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setIsSharing(false);
      setShareComment('');
    }
  }, [visible]);

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

  const defaultPostUrl = postUrl || `https://phanrise.com/posts/${post.id}`;
  const shareText = post.content && post.content.trim()
    ? `${post.user.display_name || post.user.username}: ${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}`
    : `Check out this post by ${post.user.display_name || post.user.username}`;

  const handleShareToTimeline = async () => {
    // Prevent double-clicks
    if (isSharing) {
      console.log('🚫 ShareModal: Already sharing, ignoring click');
      return;
    }

    console.log('🚀 ShareModal: handleShareToTimeline called');
    console.log('🚀 ShareModal: Modal visible:', visible);
    console.log('🚀 ShareModal: Post ID:', post?.id);
    console.log('🚀 ShareModal: onShareToTimeline function type:', typeof onShareToTimeline);
    
    setIsSharing(true);
    try {
      console.log('📞 ShareModal: About to call onShareToTimeline');
      const result = await onShareToTimeline(shareComment.trim() || undefined);
      console.log('✅ ShareModal: onShareToTimeline completed successfully, result:', result);
      
      // Clear comment and close modal immediately
      setShareComment('');
      console.log('🔒 ShareModal: Closing modal immediately');
      onClose();
      
    } catch (error) {
      console.error('❌ ShareModal: Share failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to share to timeline',
        visibilityTime: 3000,
      });
      // Don't close modal on error - let user try again
    } finally {
      console.log('🔄 ShareModal: Setting isSharing to false');
      setIsSharing(false);
    }
  };

  const handleExternalShare = async (platform: string) => {
    const encodedUrl = encodeURIComponent(defaultPostUrl);
    const encodedText = encodeURIComponent(shareText);

    let shareUrl = '';

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      default:
        return;
    }

    try {
      const canOpen = await Linking.canOpenURL(shareUrl);
      if (canOpen) {
        await Linking.openURL(shareUrl);
        Toast.show({
          type: 'success',
          text1: 'Opening...',
          text2: `Opening ${platform}...`,
          visibilityTime: 2000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: `Cannot open ${platform}`,
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `Failed to open ${platform}`,
        visibilityTime: 3000,
      });
    }
  };

  const handleNativeShare = async () => {
    try {
      const result = await RNShare.share({
        message: `${shareText}\n${defaultPostUrl}`,
        title: `Post by ${post.user.display_name || post.user.username}`,
        url: defaultPostUrl,
      });

      if (result.action === RNShare.sharedAction) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Shared successfully!',
          visibilityTime: 2000,
        });
      }
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to share',
          visibilityTime: 3000,
        });
      }
    }
  };

  const handleCopyLink = () => {
    Clipboard.setString(defaultPostUrl);
    Toast.show({
      type: 'success',
      text1: 'Link Copied',
      text2: 'Post link copied to clipboard!',
      visibilityTime: 2000,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Post</Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome name="times" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            {/* Share to Timeline */}
            <View style={styles.shareSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconContainer}>
                  <FontAwesome name="user" size={20} color="#FF6B00" />
                </View>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Share to Your Timeline</Text>
                  <Text style={styles.sectionSubtitle}>Add this post to your profile timeline</Text>
                </View>
              </View>
              <TextInput
                style={styles.commentInput}
                value={shareComment}
                onChangeText={setShareComment}
                placeholder="Add a comment (optional)..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.shareButton, styles.timelineButton, isSharing && styles.buttonDisabled]}
                onPress={handleShareToTimeline}
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.shareButtonText}>Share to Timeline</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* External Platforms */}
            <View style={styles.shareSection}>
              <Text style={styles.sectionTitle}>Share to External Platforms</Text>
              <View style={styles.platformGrid}>
                <TouchableOpacity
                  style={styles.platformButton}
                  onPress={() => handleExternalShare('twitter')}
                >
                  <FontAwesome name="twitter" size={24} color="#1DA1F2" />
                  <Text style={styles.platformText}>Twitter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.platformButton}
                  onPress={() => handleExternalShare('whatsapp')}
                >
                  <FontAwesome name="whatsapp" size={24} color="#25D366" />
                  <Text style={styles.platformText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Native Share / Copy Link */}
            <View style={styles.shareSection}>
              <TouchableOpacity
                style={[styles.shareButton, styles.copyButton]}
                onPress={handleNativeShare}
              >
                <FontAwesome name="share" size={16} color="#666" />
                <Text style={styles.copyButtonText}>Share via...</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shareButton, styles.copyButton]}
                onPress={handleCopyLink}
              >
                <FontAwesome name="link" size={16} color="#666" />
                <Text style={styles.copyButtonText}>Copy Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
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
  shareSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff3e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  shareButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineButton: {
    backgroundColor: '#FF6B00',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  platformButton: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    gap: 8,
  },
  platformText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
  },
  copyButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
});

