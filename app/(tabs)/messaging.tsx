import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '../../context/AuthContext';
import { useConversations, type Conversation } from '../../hooks/useConversations';
import { useMessages, type Message } from '../../hooks/useMessages';
import { apiClient } from '../../lib/apiClient';
import Toast from 'react-native-toast-message';

export default function MessagingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<FlatList>(null);

  const { conversations, isLoading, reload, loadMore, hasMore } = useConversations();
  const { messages, isLoading: messagesLoading, sendMessage, markAsRead, reload: reloadMessages } = useMessages(
    selectedConversation?.id || null,
    selectedConversation?.other_user.id,
  );

  // Handle conversation from URL params (when coming from profile)
  useEffect(() => {
    const conversationId = Array.isArray(params.conversation) 
      ? params.conversation[0] 
      : params.conversation;
    
    if (conversationId && conversations.length > 0) {
      const conversation = conversations.find((c) => c.id === conversationId);
      if (conversation) {
        setSelectedConversation(conversation);
        router.setParams({ conversation: undefined } as any);
      } else if (!isLoading) {
        // If conversation not found, reload to get it
        reload();
      }
    }
  }, [params.conversation, conversations, isLoading, router, reload]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      markAsRead();
      reload();
    }
  }, [selectedConversation, markAsRead, reload]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Handle keyboard show to scroll input into view
  useEffect(() => {
    if (!selectedConversation) return;

    const scrollToEnd = () => {
      setTimeout(() => {
        messagesEndRef.current?.scrollToEnd({ animated: true });
      }, 150);
    };

    scrollToEnd();
  }, [selectedConversation]);

  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !selectedConversation) return;

    const success = await sendMessage(messageInput, selectedConversation.other_user.id);
    if (success) {
      setMessageInput('');
      reload();
      reloadMessages();
    }
  }, [messageInput, selectedConversation, sendMessage, reload, reloadMessages]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.other_user.username.toLowerCase().includes(query) ||
      conv.other_user.display_name?.toLowerCase().includes(query) ||
      ''
    );
  });

  // If conversation is selected, show chat view
  if (selectedConversation) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: '#f0f2f5' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Chat Header */}
        <View style={[styles.chatHeader, { paddingTop: Math.max(insets.top, 16), backgroundColor: '#fff' }]}>
          <TouchableOpacity
            onPress={() => setSelectedConversation(null)}
            style={styles.backButton}
          >
            <FontAwesome name="arrow-left" size={20} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/${selectedConversation.other_user.username}`)}
            style={styles.headerContent}
          >
            {selectedConversation.other_user.avatar_url ? (
              <Image
                source={{ uri: selectedConversation.other_user.avatar_url }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {getInitials(
                    selectedConversation.other_user.display_name ||
                      selectedConversation.other_user.username,
                  )}
                </Text>
              </View>
            )}
            <View style={styles.headerText}>
              <Text style={[styles.headerName, { color: '#000' }]}>
                {selectedConversation.other_user.display_name ||
                  selectedConversation.other_user.username}
              </Text>
              <Text style={[styles.headerUsername, { color: '#666' }]}>
                @{selectedConversation.other_user.username}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
          {/* Messages */}
          <FlatList
          ref={messagesEndRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, backgroundColor: '#f0f2f5' }}
          contentContainerStyle={styles.messagesList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          renderItem={({ item }) => {
            const isOwn = item.sender.id === user?.id;
            return (
              <View
                style={[
                  styles.messageContainer,
                  isOwn ? styles.messageContainerOwn : styles.messageContainerOther,
                ]}
              >
                {!isOwn && (
                  <View style={styles.messageAvatar}>
                    {item.sender.avatar_url ? (
                      <Image
                        source={{ uri: item.sender.avatar_url }}
                        style={styles.messageAvatarImage}
                      />
                    ) : (
                      <View style={[styles.messageAvatarImage, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarTextSmall}>
                          {getInitials(item.sender.display_name || item.sender.username)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
                  ]}
                >
                  {!isOwn && (
                    <Text style={[styles.messageSender, { color: '#666' }]}>
                      {item.sender.display_name || item.sender.username}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.messageText,
                      isOwn ? styles.messageTextOwn : styles.messageTextOther,
                    ]}
                  >
                    {item.body}
                  </Text>
                  <Text
                    style={[
                      styles.messageTime,
                      isOwn ? styles.messageTimeOwn : styles.messageTimeOther,
                    ]}
                  >
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            messagesLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color="#FF6B00" />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <FontAwesome name="comment-o" size={48} color="#999" />
                <Text style={[styles.emptyText, { color: '#666' }]}>
                  No messages yet. Start the conversation!
                </Text>
              </View>
            )
          }
        />

        {/* Message Input */}
        <View style={[
          styles.inputContainer, 
          { 
            backgroundColor: '#fff', 
            borderTopColor: '#e0e0e0',
            paddingBottom: Math.max(insets.bottom, 16),
          }
        ]}>
          <TextInput
            style={[styles.input, { backgroundColor: '#f0f2f5', color: '#000' }]}
            placeholder="Type a message..."
            placeholderTextColor="#666"
            value={messageInput}
            onChangeText={setMessageInput}
            onFocus={() => {
              // Scroll to end when input is focused
              setTimeout(() => {
                messagesEndRef.current?.scrollToEnd({ animated: true });
              }, 300);
            }}
            multiline
            maxLength={5000}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!messageInput.trim()}
            style={[
              styles.sendButton,
              { backgroundColor: messageInput.trim() ? '#FF6B00' : '#e0e0e0' },
            ]}
          >
            <FontAwesome
              name="send"
              size={18}
              color={messageInput.trim() ? '#fff' : '#999'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Conversation list view
  return (
    <View style={[styles.container, { backgroundColor: '#f0f2f5' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: '#fff' }]}>
        <Text style={[styles.headerTitle, { color: '#000' }]}>Messages</Text>
        <TouchableOpacity
          onPress={() => {
            Toast.show({
              type: 'info',
              text1: 'Coming Soon',
              text2: 'User search feature coming soon',
            });
          }}
        >
          <FontAwesome name="user-plus" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: '#fff' }]}>
        <FontAwesome name="search" size={16} color="#666" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: '#000' }]}
          placeholder="Search conversations..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        style={{ backgroundColor: '#f0f2f5' }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.conversationItem, { backgroundColor: '#fff' }]}
            onPress={() => setSelectedConversation(item)}
          >
            <View style={styles.conversationAvatar}>
              {item.other_user.avatar_url ? (
                <Image
                  source={{ uri: item.other_user.avatar_url }}
                  style={styles.conversationAvatarImage}
                />
              ) : (
                <View style={[styles.conversationAvatarImage, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>
                    {getInitials(item.other_user.display_name || item.other_user.username)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <Text style={[styles.conversationName, { color: '#000' }]}>
                  {item.other_user.display_name || item.other_user.username}
                </Text>
                {item.latest_message && (
                  <Text style={[styles.conversationTime, { color: '#666' }]}>
                    {formatTime(item.latest_message.created_at)}
                  </Text>
                )}
              </View>
              <View style={styles.conversationFooter}>
                <Text
                  style={[styles.conversationPreview, { color: '#666' }]}
                  numberOfLines={1}
                >
                  {item.latest_message?.body || 'No messages yet'}
                </Text>
                {item.unread_count > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#FF6B00" />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <FontAwesome name="comment-o" size={48} color="#999" />
              <Text style={[styles.emptyText, { color: '#666' }]}>
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={reload} tintColor="#FF6B00" />
        }
        onEndReached={() => {
          if (hasMore && !isLoading) {
            loadMore();
          }
        }}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  conversationAvatar: {
    marginRight: 12,
  },
  conversationAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
  },
  conversationTime: {
    fontSize: 12,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationPreview: {
    flex: 1,
    fontSize: 14,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 12,
    padding: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerUsername: {
    fontSize: 14,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageContainerOwn: {
    justifyContent: 'flex-end',
  },
  messageContainerOther: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    marginRight: 8,
    marginBottom: 4,
  },
  messageAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageBubbleOwn: {
    backgroundColor: '#8B5CF6',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageSender: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#fff',
  },
  messageTextOther: {
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeOwn: {
    color: '#fff',
    opacity: 0.8,
  },
  messageTimeOther: {
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  avatarPlaceholder: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  avatarTextSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
});

