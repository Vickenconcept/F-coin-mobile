import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '../context/AuthContext';

type SidebarItem = {
  name: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  path: string;
  badge?: number;
};

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const menuItems: SidebarItem[] = [
    { name: 'Home', icon: 'home', path: '/(tabs)/feed' },
    { name: 'Explore', icon: 'compass', path: '/discover' },
    { name: 'Notifications', icon: 'bell', path: '/(tabs)/feed' }, // TODO: Add notifications screen
    { name: 'Messages', icon: 'envelope', path: '/(tabs)/feed' }, // TODO: Add messages screen
    { name: 'Bookmarks', icon: 'bookmark', path: '/(tabs)/feed' }, // TODO: Add bookmarks screen
    { name: 'Profile', icon: 'user', path: `/profile` },
    { name: 'Wallet', icon: 'credit-card', path: '/(tabs)/two' },
    { name: 'Settings', icon: 'cog', path: '/(tabs)/feed' }, // TODO: Add settings screen
  ];

  const handleNavigate = (path: string) => {
    if (path.includes('profile')) {
      router.push(`/profile`);
    } else {
      router.push(path as any);
    }
  };

  const isActive = (path: string) => {
    if (path === '/(tabs)/feed') {
      return pathname === '/(tabs)/feed' || pathname === '/';
    }
    return pathname === path || pathname?.includes(path);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Logo/Brand */}
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>FCoin</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={[styles.menuItem, isActive(item.path) && styles.menuItemActive]}
              onPress={() => handleNavigate(item.path)}
            >
              <FontAwesome
                name={item.icon}
                size={24}
                color={isActive(item.path) ? '#FF6B00' : '#666'}
                style={styles.menuIcon}
              />
              <Text
                style={[
                  styles.menuText,
                  isActive(item.path) && styles.menuTextActive,
                ]}
              >
                {item.name}
              </Text>
              {item.badge && item.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Post Button */}
        <TouchableOpacity
          style={styles.postButton}
          onPress={() => router.push('/(tabs)/feed')}
        >
          <Text style={styles.postButtonText}>Post</Text>
        </TouchableOpacity>

        {/* User Profile Card */}
        {user && (
          <TouchableOpacity
            style={styles.userCard}
            onPress={() => router.push('/profile')}
          >
            <View style={styles.userAvatar}>
              {user.avatar_url ? (
                <Text style={styles.userAvatarText}>
                  {user.display_name?.[0]?.toUpperCase() || user.username[0]?.toUpperCase()}
                </Text>
              ) : (
                <Text style={styles.userAvatarText}>
                  {user.display_name?.[0]?.toUpperCase() || user.username[0]?.toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.display_name || user.username}
              </Text>
              <Text style={styles.userHandle} numberOfLines={1}>
                @{user.username}
              </Text>
            </View>
            <FontAwesome name="ellipsis-h" size={16} color="#666" />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 260,
    height: '100%',
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
  },
  scrollView: {
    flex: 1,
  },
  logoContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  menuContainer: {
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 12,
    borderRadius: 24,
    marginVertical: 2,
  },
  menuItemActive: {
    backgroundColor: '#fff3e0',
  },
  menuIcon: {
    marginRight: 16,
  },
  menuText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#000',
    flex: 1,
  },
  menuTextActive: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#FF6B00',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  postButton: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#FF6B00',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginBottom: 20,
    borderRadius: 24,
    backgroundColor: '#f9f9f9',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 13,
    color: '#666',
  },
});

