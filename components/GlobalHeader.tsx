import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSidebar } from '../context/SidebarContext';

type GlobalHeaderProps = {
  title?: string;
  rightComponent?: React.ReactNode;
};

export function GlobalHeader({ title, rightComponent }: GlobalHeaderProps) {
  const { toggleSidebar } = useSidebar();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <TouchableOpacity
        style={styles.menuButton}
        onPress={toggleSidebar}
      >
        <FontAwesome name="bars" size={24} color="#000" />
      </TouchableOpacity>
      
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}
      
      {rightComponent && (
        <View style={styles.rightContainer}>
          {rightComponent}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 56,
  },
  menuButton: {
    padding: 8,
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  rightContainer: {
    marginLeft: 'auto',
  },
});

