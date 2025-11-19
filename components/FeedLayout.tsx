import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Sidebar } from './Sidebar';
import FontAwesome from '@expo/vector-icons/FontAwesome';

type FeedLayoutProps = {
  children: React.ReactNode;
};

export function FeedLayout({ children }: FeedLayoutProps) {
  const [sidebarVisible, setSidebarVisible] = useState(false);

  return (
    <View style={styles.container}>
      {/* Sidebar Toggle Button (Mobile) */}
      <TouchableOpacity
        style={styles.sidebarToggle}
        onPress={() => setSidebarVisible(!sidebarVisible)}
      >
        <FontAwesome name="bars" size={24} color="#000" />
      </TouchableOpacity>

      {/* Sidebar */}
      {sidebarVisible && (
        <View style={styles.sidebarOverlay}>
          <View style={styles.sidebarContainer}>
            <Sidebar />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSidebarVisible(false)}
            >
              <FontAwesome name="times" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
        </View>
      )}

      {/* Main Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
  },
  sidebarToggle: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 1000,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
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
  content: {
    flex: 1,
  },
});

