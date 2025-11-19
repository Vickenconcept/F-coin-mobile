import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';
import Toast from 'react-native-toast-message';

export type Notification = {
  id: string;
  type: string;
  data: {
    title?: string;
    body?: string;
    type?: string;
    mentioner_id?: string;
    mentioner_username?: string;
    mentioner_display_name?: string;
    mentioner_avatar_url?: string;
    post_id?: string;
    comment_id?: string;
    [key: string]: unknown;
  };
  read_at: string | null;
  created_at: string;
};

type UseNotificationsReturn = {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  loadNotifications: (unreadOnly?: boolean) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (unreadOnly = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (unreadOnly) {
        params.append('unread_only', 'true');
      }
      params.append('per_page', '50');

      const response = await apiClient.get<Notification[]>(
        `/v1/notifications?${params.toString()}`
      );

      if (response.ok && response.data) {
        // apiClient unwraps the data, but we need to check meta
        const notificationsData = Array.isArray(response.data) 
          ? response.data 
          : (response.data as any).data || [];
        const meta = (response.data as any).meta || response.meta;
        
        setNotifications(notificationsData);
        setUnreadCount(meta?.unread_count || 0);
      } else {
        setError(response.errors?.[0]?.detail || 'Failed to load notifications');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications';
      setError(message);
      console.error('Error loading notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await apiClient.post(`/v1/notifications/${notificationId}/read`);

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, read_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to mark notification as read',
          visibilityTime: 3000,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark notification as read';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: message,
        visibilityTime: 3000,
      });
      console.error('Error marking notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await apiClient.post('/v1/notifications/read-all');

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
        );
        setUnreadCount(0);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'All notifications marked as read',
          visibilityTime: 2000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.errors?.[0]?.detail || 'Failed to mark all notifications as read',
          visibilityTime: 3000,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark all notifications as read';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: message,
        visibilityTime: 3000,
      });
      console.error('Error marking all notifications as read:', err);
    }
  }, []);

  const refresh = useCallback(() => {
    return loadNotifications(false);
  }, [loadNotifications]);

  useEffect(() => {
    loadNotifications(false);
  }, [loadNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    refresh,
  };
}

