import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import Toast from 'react-native-toast-message';

export type Message = {
  id: string;
  body: string;
  sender: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  read: boolean;
  read_at: string | null;
  created_at: string;
};

type UseMessagesReturn = {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (body: string, userId: string) => Promise<boolean>;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  markAsRead: () => Promise<void>;
};

export function useMessages(conversationId: string | null, otherUserId?: string): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const loadMessages = useCallback(
    async (page = 1, append = false) => {
      if (!conversationId) {
        setMessages([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.request<{
          data: {
            id: string;
            other_user: {
              id: string;
              username: string;
              display_name: string;
              avatar_url: string | null;
            };
            messages: Message[];
            meta: {
              pagination: {
                current_page: number;
                last_page: number;
                per_page: number;
                total: number;
              };
            };
          };
        }>(`/v1/conversations/${conversationId}?page=${page}&per_page=50`);

        if (response.ok && response.data) {
          const data = response.data.messages || [];
          if (append) {
            setMessages((prev) => [...prev, ...data]);
          } else {
            setMessages(data);
          }
          setCurrentPage(page);
          if (response.data.meta?.pagination) {
            setLastPage(response.data.meta.pagination.last_page);
          }
        } else {
          const errorMsg = response.errors?.[0]?.detail ?? 'Failed to load messages';
          setError(errorMsg);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: errorMsg,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load messages';
        setError(message);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: message,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId],
  );

  const sendMessage = useCallback(
    async (body: string, userId: string): Promise<boolean> => {
      if (!body.trim() || !userId) {
        return false;
      }

      try {
        const response = await apiClient.request<{
          data: {
            id: string;
            conversation_id: string;
            body: string;
            sender: {
              id: string;
              username: string;
              display_name: string;
              avatar_url: string | null;
            };
            read: boolean;
            created_at: string;
          };
        }>('/v1/messages', {
          method: 'POST',
          data: {
            user_id: userId,
            body: body.trim(),
          },
        });

        if (response.ok && response.data) {
          // Reload messages if we have a conversation
          if (conversationId) {
            await loadMessages(1, false);
          }
          return true;
        } else {
          const errorMsg = response.errors?.[0]?.detail ?? 'Failed to send message';
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: errorMsg,
          });
          return false;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send message';
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: message,
        });
        return false;
      }
    },
    [conversationId, loadMessages],
  );

  const markAsRead = useCallback(async () => {
    if (!conversationId) return;

    try {
      await apiClient.request(`/v1/messages/conversations/${conversationId}/mark-read`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Failed to mark messages as read:', err);
    }
  }, [conversationId]);

  const reload = useCallback(() => {
    return loadMessages(1, false);
  }, [loadMessages]);

  const loadMore = useCallback(() => {
    if (currentPage < lastPage && !isLoading) {
      return loadMessages(currentPage + 1, true);
    }
    return Promise.resolve();
  }, [currentPage, lastPage, isLoading, loadMessages]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    reload,
    loadMore,
    hasMore: currentPage < lastPage,
    markAsRead,
  };
}

