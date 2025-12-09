import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import Toast from 'react-native-toast-message';

export type Conversation = {
  id: string;
  other_user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  latest_message: {
    id: string;
    body: string;
    sender_id: string;
    sender: {
      id: string;
      username: string;
      display_name: string;
    };
    created_at: string;
  } | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
};

type UseConversationsReturn = {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
};

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const loadConversations = useCallback(async (page = 1, append = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.request<{
        data: Conversation[];
        meta: {
          pagination: {
            current_page: number;
            last_page: number;
            per_page: number;
            total: number;
          };
        };
      }>(`/v1/conversations?page=${page}&per_page=20`);

      if (response.ok && response.data) {
        const data = Array.isArray(response.data) ? response.data : [];
        if (append) {
          setConversations((prev) => [...prev, ...data]);
        } else {
          setConversations(data);
        }
        setCurrentPage(page);
        if (response.meta?.pagination) {
          setLastPage(response.meta.pagination.last_page);
        }
      } else {
        const errorMsg = response.errors?.[0]?.detail ?? 'Failed to load conversations';
        setError(errorMsg);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMsg,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(message);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: message,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    return loadConversations(1, false);
  }, [loadConversations]);

  const loadMore = useCallback(() => {
    if (currentPage < lastPage && !isLoading) {
      return loadConversations(currentPage + 1, true);
    }
    return Promise.resolve();
  }, [currentPage, lastPage, isLoading, loadConversations]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    conversations,
    isLoading,
    error,
    reload,
    loadMore,
    hasMore: currentPage < lastPage,
  };
}

