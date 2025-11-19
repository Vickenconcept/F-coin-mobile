import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

type MediaItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
  metadata: Record<string, unknown> | null;
};

type FeedMediaGridProps = {
  media: MediaItem[];
  onOpen?: () => void;
  onImagePress?: (index: number) => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 4;
const GRID_PADDING = 16;
const AVAILABLE_WIDTH = SCREEN_WIDTH - GRID_PADDING * 2;

export function FeedMediaGrid({ media, onOpen, onImagePress }: FeedMediaGridProps) {
  if (!media || media.length === 0) return null;

  const total = media.length;
  const displayMedias = media.slice(0, 4);

  const getLayout = () => {
    switch (displayMedias.length) {
      case 1:
        return {
          container: { flexDirection: 'column' as const },
          items: [{ width: '100%', height: 300 }],
        };
      case 2:
        return {
          container: { flexDirection: 'row' as const },
          items: [
            { width: '48%', height: 200 },
            { width: '48%', height: 200 },
          ],
        };
      case 3:
        return {
          container: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
          items: [
            { width: '48%', height: 180 },
            { width: '48%', height: 180 },
            { width: '100%', height: 180 },
          ],
        };
      case 4:
      default:
        return {
          container: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
          items: [
            { width: '48%', height: 160 },
            { width: '48%', height: 160 },
            { width: '48%', height: 160 },
            { width: '48%', height: 160 },
          ],
        };
    }
  };

  const layout = getLayout();
  const remainingCount = total - 4;

  const renderMediaItem = (item: MediaItem, index: number) => {
    const itemStyle = layout.items[index] || layout.items[0];
    const isLast = index === displayMedias.length - 1 && remainingCount > 0;
    
    // Convert percentage strings to numbers
    const widthPercent = typeof itemStyle.width === 'string' 
      ? parseFloat(itemStyle.width.replace('%', '')) 
      : 100;
    const widthValue = (AVAILABLE_WIDTH * widthPercent) / 100 - (index % 2 === 0 ? GRID_GAP : 0);

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.mediaItem,
          {
            width: widthValue,
            height: itemStyle.height,
            marginRight: index % 2 === 0 ? GRID_GAP : 0,
            marginBottom: GRID_GAP,
          },
        ]}
        onPress={() => {
          if (onImagePress) {
            onImagePress(index);
          } else if (onOpen) {
            onOpen();
          }
        }}
        activeOpacity={0.9}
      >
        {item.type === 'image' ? (
          <Image source={{ uri: item.url }} style={styles.mediaImage} resizeMode="cover" />
        ) : (
          <Video
            source={{ uri: item.url }}
            style={styles.mediaVideo}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            useNativeControls
          />
        )}
        {isLast && (
          <View style={styles.overlay}>
            <View style={styles.overlayContent}>
              <Text style={styles.overlayText}>+{remainingCount}</Text>
              <Text style={styles.overlaySubtext}>more</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, layout.container]}>
      {displayMedias.map((item, index) => renderMediaItem(item, index))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    marginHorizontal: -GRID_GAP / 2,
  },
  mediaItem: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaVideo: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  overlaySubtext: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
  },
});

