import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Sidebar } from './Sidebar';
import { useSidebar } from '../context/SidebarContext';

export function GlobalSidebar() {
  const { sidebarVisible, closeSidebar } = useSidebar();

  if (!sidebarVisible) {
    return null;
  }

  return (
    <View style={styles.sidebarOverlay}>
      <View style={styles.sidebarContainer}>
        <Sidebar />
        <TouchableOpacity
          style={styles.closeButton}
          onPress={closeSidebar}
        >
          <FontAwesome name="times" size={24} color="#666" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={closeSidebar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    flexDirection: 'row',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarContainer: {
    width: 260,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 1001,
  },
});

