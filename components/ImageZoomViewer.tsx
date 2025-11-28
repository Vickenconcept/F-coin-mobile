import React, { useRef, useEffect, useState } from 'react';
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
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatusSuccess, AVPlaybackStatus } from 'expo-av';
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
  const [videoLoadingStates, setVideoLoadingStates] = useState<Record<number, boolean>>({});
  const videoRefs = useRef<Record<number, Video | null>>({});
  const [videoPlaybackStatus, setVideoPlaybackStatus] = useState<Record<number, AVPlaybackStatusSuccess | null>>({});
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getAnimatedValue = (value: Animated.Value) => {
    if (typeof (value as any).__getValue === 'function') {
      return (value as any).__getValue();
    }
    return (value as any)._value ?? 0;
  };

  useEffect(() => {
    if (visible && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: initialIndex * SCREEN_WIDTH,
        animated: false,
      });
      // Reset loading states when modal opens
      setVideoLoadingStates({});
    }
  }, [visible, initialIndex]);

  // Don't set loading state when switching - only show loading when actually loading

  // Handle Android back button
  useEffect(() => {
    if (!visible) return;

    const backAction = () => {
      onClose();
      return true; // Prevent default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [visible, onClose]);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (visible && media[initialIndex]?.type === 'video') {
      setControlsVisible(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [visible, initialIndex, media]);

  const togglePlayPause = async (index: number) => {
    const video = videoRefs.current[index];
    if (video) {
      const status = videoPlaybackStatus[index];
      if (status?.isLoaded) {
        // If video ended, restart from beginning
        if (status.didJustFinish) {
          await video.setPositionAsync(0);
          await video.playAsync();
        } else if (status.isPlaying) {
          await video.pauseAsync();
        } else {
          await video.playAsync();
        }
      }
    }
  };

  const seekBackward = async (index: number) => {
    const video = videoRefs.current[index];
    if (video) {
      const status = videoPlaybackStatus[index];
      if (status?.isLoaded) {
        const newPosition = Math.max(0, (status.positionMillis || 0) - 10000);
        await video.setPositionAsync(newPosition);
      }
    }
  };

  const seekForward = async (index: number) => {
    const video = videoRefs.current[index];
    if (video) {
      const status = videoPlaybackStatus[index];
      if (status?.isLoaded) {
        const duration = status.durationMillis || 0;
        const newPosition = Math.min(duration, (status.positionMillis || 0) + 10000);
        await video.setPositionAsync(newPosition);
      }
    }
  };

  const handleVideoTap = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  };

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
        lastScale.value = getAnimatedValue(imageScale);
        lastTranslate.x = getAnimatedValue(imageTranslateX);
        lastTranslate.y = getAnimatedValue(imageTranslateY);
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
            // Show controls for new video (but don't set loading state - only show when actually loading)
            if (media[index]?.type === 'video') {
              setControlsVisible(true);
              if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
              }
              controlsTimeoutRef.current = setTimeout(() => {
                setControlsVisible(false);
              }, 3000);
            } else {
              // Hide controls when switching to image
              setControlsVisible(false);
            }
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
                <TouchableOpacity
                  style={styles.videoContainer}
                  activeOpacity={1}
                  onPress={handleVideoTap}
                >
                  {videoLoadingStates[index] && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color="#fff" />
                      <Text style={styles.loadingText}>Loading video...</Text>
                    </View>
                  )}
                  <Video
                    ref={(ref) => {
                      videoRefs.current[index] = ref;
                    }}
                    source={{ uri: item.url }}
                    style={styles.video}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={index === initialIndex}
                    onLoadStart={() => {
                      setVideoLoadingStates((prev) => ({
                        ...prev,
                        [index]: true,
                      }));
                    }}
                    onLoad={() => {
                      setVideoLoadingStates((prev) => ({
                        ...prev,
                        [index]: false,
                      }));
                    }}
                    onError={() => {
                      setVideoLoadingStates((prev) => ({
                        ...prev,
                        [index]: false,
                      }));
                    }}
                    onPlaybackStatusUpdate={(status) => {
                      if (!status.isLoaded) {
                        setVideoPlaybackStatus((prev) => ({
                          ...prev,
                          [index]: null,
                        }));
                        return;
                      }
                      setVideoPlaybackStatus((prev) => ({
                        ...prev,
                        [index]: status,
                      }));
                      // Hide loading when video is loaded and playing/ended
                      if (status.isLoaded && (status.isPlaying || status.didJustFinish)) {
                        setVideoLoadingStates((prev) => ({
                          ...prev,
                          [index]: false,
                        }));
                      }
                      // Show controls when video ends
                      if (status.didJustFinish) {
                        setControlsVisible(true);
                        if (controlsTimeoutRef.current) {
                          clearTimeout(controlsTimeoutRef.current);
                        }
                        controlsTimeoutRef.current = setTimeout(() => {
                          setControlsVisible(false);
                        }, 5000); // Show controls longer when video ends
                      }
                    }}
                  />
                  {!videoLoadingStates[index] && controlsVisible && index === initialIndex && (
                    <View style={styles.videoControls}>
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => seekBackward(index)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <FontAwesome name="backward" size={24} color="#fff" />
                        <Text style={styles.controlButtonText}>10s</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.playPauseButton}
                        onPress={() => togglePlayPause(index)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <FontAwesome
                          name={
                            videoPlaybackStatus[index]?.isLoaded && videoPlaybackStatus[index]?.isPlaying
                              ? 'pause'
                              : 'play'
                          }
                          size={32}
                          color="#fff"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => seekForward(index)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <FontAwesome name="forward" size={24} color="#fff" />
                        <Text style={styles.controlButtonText}>10s</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
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
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
  videoControls: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    zIndex: 2,
  },
  playPauseButton: {
    marginHorizontal: 30,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
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

