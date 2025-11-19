import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '../lib/apiClient';

export type MentionUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export function useMentions() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MentionUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiClient.get<MentionUser[]>(
        `/v1/feed/users/search?q=${encodeURIComponent(query)}&limit=10`
      );

      if (response.ok && response.data) {
        setSearchResults(response.data);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search users error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const debouncedSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(query);
    }, 300);
  }, [searchUsers]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    searchUsers: debouncedSearch,
    clearResults: () => setSearchResults([]),
  };
}

