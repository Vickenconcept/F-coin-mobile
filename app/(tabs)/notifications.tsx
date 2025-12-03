import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNotifications, type Notification } from '../../hooks/useNotifications';
import Toast from 'react-native-toast-message';

type FilterType = 'all' | 'unread';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    isLoadingMore,
    hasMore,
    error, 
    loadNotifications,
    loadMore,
    markAsRead, 
    markAllAsRead, 
    refresh 
  } = useNotifications();
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.read_at)
    : notifications;

  const handleFilterChange = useCallback((newFilter: FilterType) => {
    setFilter(newFilter);
    loadNotifications(newFilter === 'unread', true);
  }, [loadNotifications]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore(filter === 'unread');
    }
  }, [hasMore, isLoadingMore, loadMore, filter]);

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

  const getNotificationIcon = (type: string) => {
    if (type.includes('mention')) {
      return { name: 'at' as const, color: '#1DA1F2' };
    }
    if (type.includes('reward')) {
      return { name: 'gift' as const, color: '#FF6B00' };
    }
    if (type.includes('top_up')) {
      return { name: 'money' as const, color: '#25D366' };
    }
    if (type.includes('transfer')) {
      return { name: 'exchange' as const, color: '#9B59B6' };
    }
    if (type.includes('like')) {
      return { name: 'heart' as const, color: '#E91E63' };
    }
    if (type.includes('comment') || type.includes('reply')) {
      return { name: 'comment' as const, color: '#1DA1F2' };
    }
    return { name: 'bell' as const, color: '#666' };
  };

  const getNotificationText = (notification: Notification) => {
    const data = notification.data;
    const type = notification.type;

    if (type.includes('mention')) {
      const mentioner = data.mentioner_display_name || data.mentioner_username || 'Someone';
      if (data.comment_id) {
        return `${mentioner} mentioned you in a comment`;
      }
      return `${mentioner} mentioned you in a post`;
    }

    if (type === 'post.like') {
      const liker = data.liker_display_name || data.liker_username || 'Someone';
      return `${liker} liked your post`;
    }

    if (type === 'post.comment') {
      const commenter = data.commenter_display_name || data.commenter_username || 'Someone';
      return `${commenter} commented on your post`;
    }

    if (type === 'comment.like') {
      const liker = data.liker_display_name || data.liker_username || 'Someone';
      return `${liker} liked your comment`;
    }

    if (type === 'comment.reply') {
      const replier = data.replier_display_name || data.replier_username || 'Someone';
      return `${replier} replied to your comment`;
    }

    if (type.includes('reward')) {
      return data.body || data.title || 'You received a reward';
    }

    if (type.includes('top_up')) {
      return data.body || data.title || 'Top-up completed';
    }

    if (type.includes('transfer')) {
      return data.body || data.title || 'Wallet transfer';
    }

    return data.body || data.title || 'New notification';
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }

    const data = notification.data;
    if (data.post_id) {
      // Navigate to feed and open the post detail modal
      // The feed will handle opening the post based on the postId param
      const commentId = data.comment_id ? String(data.comment_id) : undefined;
      router.push({
        pathname: '/(tabs)/feed',
        params: { 
          openPost: data.post_id as string,
          ...(commentId ? { commentId } : {}),
        },
      } as any);
    } else if (data.mentioner_username || data.liker_username || data.commenter_username || data.replier_username) {
      // Navigate to user profile
      const username = data.mentioner_username || data.liker_username || data.commenter_username || data.replier_username;
      router.push(`/${username}` as any);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (isLoading && notifications.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <FontAwesome name="exclamation-circle" size={48} color="#999" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refresh()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={markAllAsRead}
            disabled={isLoading}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => handleFilterChange('all')}
        >
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]}
          onPress={() => handleFilterChange('unread')}
        >
          <Text style={[styles.filterTabText, filter === 'unread' && styles.filterTabTextActive]}>
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome name="bell-o" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {filter === 'unread'
                ? 'You\'re all caught up!'
                : 'You\'ll see notifications here when you get mentions, likes, comments, and more'}
            </Text>
          </View>
        ) : (
          filteredNotifications.map((notification) => {
            const icon = getNotificationIcon(notification.type);
            const data = notification.data;
            const isUnread = !notification.read_at;
            // Get avatar from various notification types
            const avatarUrl = (
              data.mentioner_avatar_url || 
              data.liker_avatar_url || 
              data.commenter_avatar_url || 
              data.replier_avatar_url
            ) as string | undefined;
            const userName = (
              data.mentioner_display_name || data.mentioner_username ||
              data.liker_display_name || data.liker_username ||
              data.commenter_display_name || data.commenter_username ||
              data.replier_display_name || data.replier_username
            ) as string | undefined;

            return (
              <TouchableOpacity
                key={notification.id}
                style={[styles.notificationItem, isUnread && styles.notificationItemUnread]}
                onPress={() => handleNotificationPress(notification)}
                activeOpacity={0.7}
              >
                <View style={styles.notificationContent}>
                  {/* Avatar or Icon */}
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
                      <FontAwesome name={icon.name} size={20} color={icon.color} />
                    </View>
                  )}

                  {/* Notification Text */}
                  <View style={styles.notificationTextContainer}>
                    <Text style={styles.notificationText}>
                      {getNotificationText(notification)}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {formatTime(notification.created_at)}
                    </Text>
                  </View>

                  {/* Unread Indicator */}
                  {isUnread && <View style={styles.unreadIndicator} />}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        
        {/* Show More Button */}
        {hasMore && filteredNotifications.length > 0 && (
          <View style={styles.loadMoreContainer}>
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMore}
              disabled={isLoadingMore}
              activeOpacity={0.7}
            >
              {isLoadingMore ? (
                <ActivityIndicator size="small" color="#FF6B00" />
              ) : (
                <Text style={styles.loadMoreText}>Show more</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FF6B00',
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  filterTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B00',
  },
  filterTabText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  notificationItem: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationItemUnread: {
    backgroundColor: '#f9f9ff',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 13,
    color: '#666',
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B00',
    marginLeft: 8,
  },
  loadMoreContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B00',
  },
});

