import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FeedLayoutProps = {
  children: React.ReactNode;
};

export function FeedLayout({ children }: FeedLayoutProps) {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

