import React from 'react';
import { View, StyleSheet } from 'react-native';

type FeedLayoutProps = {
  children: React.ReactNode;
};

export function FeedLayout({ children }: FeedLayoutProps) {
  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

