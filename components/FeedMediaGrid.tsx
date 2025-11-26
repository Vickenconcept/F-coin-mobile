import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import FontAwesome from '@expo/vector-icons/FontAwesome';

type MediaItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail_url?: string | null;
  metadata?: Record<string, unknown> | null;
};

type FeedMediaGridProps = {
  media: MediaItem[];
  onOpen?: () => void;
  onImagePress?: (index: number) => void;
  onRemove?: (index: number) => void;
};

const GRID_GAP = 4;

export function FeedMediaGrid({ media, onOpen, onImagePress, onRemove }: FeedMediaGridProps) {
  if (!media || media.length === 0) return null;

  const total = media.length;
  const displayMedias = media.slice(0, 4);

  const getLayout = () => {
    switch (displayMedias.length) {
      case 1:
        return {
          container: { flexDirection: 'column' as const },
          items: [
            { height: 300, width: '100%' },
          ],
        };
      case 2:
        return {
          container: { flexDirection: 'row' as const },
          items: [
            { height: 200, width: '48%' },
            { height: 200, width: '48%' },
          ],
        };
      case 3:
        return {
          container: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
          items: [
            { height: 180, width: '48%' },
            { height: 180, width: '48%' },
            { height: 180, width: '100%' },
          ],
        };
      case 4:
      default:
        return {
          container: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
          items: [
            { height: 160, width: '48%' },
            { height: 160, width: '48%' },
            { height: 160, width: '48%' },
            { height: 160, width: '48%' },
          ],
        };
    }
  };

  const layout = getLayout();
  const remainingCount = total - 4;

  const renderMediaItem = (item: MediaItem, index: number) => {
    const itemStyle = layout.items[index] || layout.items[0];
    const isLast = index === displayMedias.length - 1 && remainingCount > 0;
    const isEvenIndex = index % 2 === 0;
    const width = itemStyle.width || '100%';
    const isFullWidth = width === '100%';

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.mediaItem,
          {
            width: width as any,
            height: itemStyle.height,
            marginRight: isEvenIndex && !isFullWidth ? GRID_GAP : 0,
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
        {onRemove && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemove(index)}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          >
            <FontAwesome name="times-circle" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, layout.container]}>
      {displayMedias.map((item, index) => (
        <React.Fragment key={item.id || index}>
          {renderMediaItem(item, index)}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    width: '100%',
  },
  mediaItem: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    position: 'relative',
    minWidth: 0, // Important for flex children to shrink properly
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
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    padding: 2,
    zIndex: 1,
  },
});

