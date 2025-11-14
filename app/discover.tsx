import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiClient } from '../lib/apiClient';
import Toast from 'react-native-toast-message';

type DiscoverUser = {
  id: string;
  username: string;
  display_name: string | null;
  verified_creator: boolean;
  default_coin_symbol: string;
  followers_count: number;
  following_count: number;
  is_following?: boolean;
};

export default function DiscoverScreen() {
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFollows, setLoadingFollows] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchUsers = useCallback(async (search?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search && search.trim()) {
        params.set('search', search.trim());
      }

      const response = await apiClient.get<DiscoverUser[]>(
        `/v1/users${params.toString() ? `?${params.toString()}` : ''}`
      );

      if (response.ok && Array.isArray(response.data)) {
        setUsers(response.data);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Unable to load creators',
        });
        setUsers([]);
      }
    } catch (error) {
      console.error('Discover fetch error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load creators',
      });
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchUsers(searchTerm);
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fetchUsers]);

  const handleFollow = async (userId: string, isFollowing: boolean) => {
    if (loadingFollows[userId]) return;

    setLoadingFollows((prev) => ({ ...prev, [userId]: true }));

    try {
      if (isFollowing) {
        const response = await apiClient.delete(`/v1/users/${userId}/follow`);
        if (response.ok) {
          setUsers((prev) =>
            prev.map((user) =>
              user.id === userId ? { ...user, is_following: false } : user
            )
          );
          Toast.show({
            type: 'success',
            text1: 'Unfollowed',
            text2: 'You are no longer following this creator',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to unfollow',
          });
        }
      } else {
        const response = await apiClient.post('/v1/follows', { creator_id: userId });
        if (response.ok) {
          setUsers((prev) =>
            prev.map((user) =>
              user.id === userId ? { ...user, is_following: true } : user
            )
          );
          Toast.show({
            type: 'success',
            text1: 'Following',
            text2: 'You are now following this creator',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to follow',
          });
        }
      }
    } catch (error) {
      console.error('Follow error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'An error occurred',
      });
    } finally {
      setLoadingFollows((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers(searchTerm);
    setRefreshing(false);
  }, [fetchUsers, searchTerm]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover Creators</Text>
        <Text style={styles.subtitle}>Find and follow creators to earn coins</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search creators..."
          placeholderTextColor="#999"
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
        />
      </View>

      {isLoading && users.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading creators...</Text>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No creators found</Text>
          <Text style={styles.emptySubtext}>
            {searchTerm ? 'Try a different search term' : 'Start searching to find creators'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {user.display_name?.[0]?.toUpperCase() || user.username[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.userDetails}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName}>
                      {user.display_name || user.username}
                    </Text>
                    {user.verified_creator && (
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedText}>✓</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userHandle}>@{user.username}</Text>
                  <View style={styles.statsRow}>
                    <Text style={styles.statText}>
                      {user.followers_count || 0} followers
                    </Text>
                    {user.default_coin_symbol && (
                      <Text style={styles.coinText}>
                        {user.default_coin_symbol}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.followButton,
                  user.is_following && styles.followingButton,
                  loadingFollows[user.id] && styles.buttonDisabled,
                ]}
                onPress={() => handleFollow(user.id, user.is_following || false)}
                disabled={loadingFollows[user.id]}
              >
                {loadingFollows[user.id] ? (
                  <ActivityIndicator size="small" color={user.is_following ? '#666' : '#fff'} />
                ) : (
                  <Text
                    style={[
                      styles.followButtonText,
                      user.is_following && styles.followingButtonText,
                    ]}
                  >
                    {user.is_following ? 'Following' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginRight: 6,
  },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userHandle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  coinText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B00',
  },
  followButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#e0e0e0',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#666',
  },
});

