import React, { useRef, useEffect } from 'react';
import {
  View,
  Modal,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  ScrollView,
  Platform,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageZoomViewerProps {
  visible: boolean;
  onClose: () => void;
  media: Array<{ url: string; type: 'image' | 'video' }>;
  initialIndex: number;
  onIndexChange: (index: number) => void;
  imageScale: Animated.Value;
  imageTranslateX: Animated.Value;
  imageTranslateY: Animated.Value;
  lastScale: { value: number };
  lastTranslate: { x: number; y: number };
}

export function ImageZoomViewer({
  visible,
  onClose,
  media,
  initialIndex,
  onIndexChange,
  imageScale,
  imageTranslateX,
  imageTranslateY,
  lastScale,
  lastTranslate,
}: ImageZoomViewerProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: initialIndex * SCREEN_WIDTH,
        animated: false,
      });
    }
  }, [visible, initialIndex]);

  const initialDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);

  const panResponder = useRef(
    PanResponder.create({
      // Only start handling if we have 2 touches (pinch) OR if already zoomed
      onStartShouldSetPanResponder: (evt) => {
        const touches = evt.nativeEvent.touches;
        // Always handle if 2 touches (pinch gesture)
        if (touches.length === 2) {
          return true;
        }
        // Only handle single touch if already zoomed (for panning)
        if (touches.length === 1 && lastScale.value > 1.1) {
          return true;
        }
        // Let ScrollView handle single touch when not zoomed
        return false;
      },
      // Only move if we should be handling it
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        // Always handle if 2 touches (pinch gesture)
        if (touches.length === 2) {
          return true;
        }
        // Only handle single touch if already zoomed (for panning)
        if (touches.length === 1 && lastScale.value > 1.1) {
          return true;
        }
        // For single touch when not zoomed, check if it's clearly vertical (not horizontal)
        // If it's horizontal, let ScrollView handle it
        if (touches.length === 1 && lastScale.value <= 1.1) {
          const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2;
          if (isHorizontal) {
            return false; // Let ScrollView handle horizontal swipe
          }
        }
        return false;
      },
      onPanResponderGrant: (evt) => {
        imageScale.setOffset(lastScale.value);
        imageTranslateX.setOffset(lastTranslate.x);
        imageTranslateY.setOffset(lastTranslate.y);
        imageScale.setValue(0);
        imageTranslateX.setValue(0);
        imageTranslateY.setValue(0);
        
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          const touch1 = touches[0];
          const touch2 = touches[1];
          initialDistanceRef.current = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) + Math.pow(touch2.pageY - touch1.pageY, 2)
          );
          initialScaleRef.current = lastScale.value;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        
        // Handle pinch-to-zoom (2 touches)
        if (touches.length === 2 && initialDistanceRef.current !== null) {
          const touch1 = touches[0];
          const touch2 = touches[1];
          const currentDistance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) + Math.pow(touch2.pageY - touch1.pageY, 2)
          );
          
          const initialDistance = initialDistanceRef.current;
          const scale = Math.max(1, Math.min(2.5, (currentDistance / initialDistance) * initialScaleRef.current));
          imageScale.setValue(scale);
        } 
        // Handle pan when zoomed (single touch, already zoomed)
        else if (touches.length === 1 && lastScale.value > 1.1) {
          imageTranslateX.setValue(gestureState.dx);
          imageTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: () => {
        imageScale.flattenOffset();
        imageTranslateX.flattenOffset();
        imageTranslateY.flattenOffset();
        lastScale.value = imageScale._value;
        lastTranslate.x = imageTranslateX._value;
        lastTranslate.y = imageTranslateY._value;
        initialDistanceRef.current = null;

        // Reset if scale is too small
        if (lastScale.value < 1) {
          Animated.parallel([
            Animated.spring(imageScale, { toValue: 1, useNativeDriver: false }),
            Animated.spring(imageTranslateX, { toValue: 0, useNativeDriver: false }),
            Animated.spring(imageTranslateY, { toValue: 0, useNativeDriver: false }),
          ]).start();
          lastScale.value = 1;
          lastTranslate.x = 0;
          lastTranslate.y = 0;
        }
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <FontAwesome name="times" size={24} color="#fff" />
        </TouchableOpacity>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * SCREEN_WIDTH, y: 0 }}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            onIndexChange(index);
          }}
          scrollEnabled={lastScale.value <= 1.05} // Disable scroll when zoomed
          scrollEventThrottle={16}
          decelerationRate="fast"
        >
          {media.map((item, index) => (
            <View key={index} style={styles.imageContainer}>
              {item.type === 'image' ? (
                <Animated.View
                  style={[
                    styles.imageWrapper,
                    {
                      transform: [
                        { translateX: imageTranslateX },
                        { translateY: imageTranslateY },
                        { scale: imageScale },
                      ],
                    },
                  ]}
                  {...panResponder.panHandlers}
                >
                  <Image
                    source={{ uri: item.url }}
                    style={styles.image}
                    resizeMode="contain"
                  />
                </Animated.View>
              ) : (
                <Video
                  source={{ uri: item.url }}
                  style={styles.video}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={index === initialIndex}
                  useNativeControls
                />
              )}
            </View>
          ))}
        </ScrollView>
        {media.length > 1 && (
          <View style={styles.indicator}>
            <Text style={styles.indicatorText}>
              {initialIndex + 1} / {media.length}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 10,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  indicator: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  indicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

