import React, {useRef, useState, useCallback, useImperativeHandle, forwardRef, useEffect} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Text,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Animated,
  GestureResponderEvent,
  Modal,
  BackHandler,
} from 'react-native';
import Video, {OnProgressData, OnLoadData} from 'react-native-video';
import {
  Play,
  Pause,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  ChevronLeft,
  MoreVertical,
} from 'lucide-react-native';
import {theme} from '../theme';
import {formatVideoTimestamp} from '../lib/utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface CommentMarker {
  id: string;
  time: number;
}

interface VideoPlayerProps {
  source: string;
  poster?: string;
  onTimeUpdate?: (currentTime: number) => void;
  commentMarkers?: CommentMarker[];
  onFullscreenChange?: (isFullscreen: boolean) => void;
  // Overlay props
  title?: string;
  onBack?: () => void;
  onMenuPress?: () => void;
  showOverlayHeader?: boolean;
}

export interface VideoPlayerRef {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  play: () => void;
  pause: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({source, poster, onTimeUpdate, commentMarkers = [], onFullscreenChange, title, onBack, onMenuPress, showOverlayHeader = false}, ref) => {
    const videoRef = useRef<Video>(null);
    const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
    const controlsOpacity = useRef(new Animated.Value(1)).current;
    const insets = useSafeAreaInsets();
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9); // Default, updated on load
    const progressBarRef = useRef<View>(null);
    const progressBarLayout = useRef({x: 0, width: 0});
    
    // Track screen dimensions for fullscreen (updates on orientation change)
    const [screenDimensions, setScreenDimensions] = useState(() => Dimensions.get('window'));
    const isLandscape = screenDimensions.width > screenDimensions.height;

    useEffect(() => {
      const subscription = Dimensions.addEventListener('change', ({window}) => {
        setScreenDimensions(window);
      });
      return () => subscription?.remove();
    }, []);

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        videoRef.current?.seek(time);
        setCurrentTime(time);
      },
      getCurrentTime: () => currentTime,
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
    }));

    // Auto-hide controls after 3 seconds
    const resetControlsTimer = useCallback(() => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      
      setShowControls(true);
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();

      if (isPlaying) {
        controlsTimeout.current = setTimeout(() => {
          Animated.timing(controlsOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setShowControls(false));
        }, 3000);
      }
    }, [isPlaying, controlsOpacity]);

    useEffect(() => {
      resetControlsTimer();
      return () => {
        if (controlsTimeout.current) {
          clearTimeout(controlsTimeout.current);
        }
      };
    }, [isPlaying, resetControlsTimer]);

    // Notify parent of fullscreen changes
    useEffect(() => {
      onFullscreenChange?.(isFullscreen);
    }, [isFullscreen, onFullscreenChange]);

    // Handle Android back button in fullscreen
    useEffect(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isFullscreen) {
          setIsFullscreen(false);
          return true;
        }
        return false;
      });

      return () => backHandler.remove();
    }, [isFullscreen]);

    const handleProgress = useCallback(
      (data: OnProgressData) => {
        setCurrentTime(data.currentTime);
        onTimeUpdate?.(data.currentTime);
      },
      [onTimeUpdate],
    );

    const handleLoad = useCallback((data: OnLoadData) => {
      setDuration(data.duration);
      setIsLoading(false);
      // Calculate aspect ratio from video's natural size
      if (data.naturalSize?.width && data.naturalSize?.height) {
        const ratio = data.naturalSize.width / data.naturalSize.height;
        setVideoAspectRatio(ratio);
      }
    }, []);

    // Handle scrubbing on the progress bar
    const handleScrub = useCallback((evt: GestureResponderEvent) => {
      const barWidth = progressBarLayout.current.width;
      if (barWidth > 0 && duration > 0) {
        const locationX = evt.nativeEvent.locationX;
        const prog = Math.max(0, Math.min(1, locationX / barWidth));
        const seekTime = prog * duration;
        videoRef.current?.seek(seekTime);
        setCurrentTime(seekTime);
        resetControlsTimer();
      }
    }, [duration, resetControlsTimer]);

    const handleSkip = useCallback((seconds: number) => {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      videoRef.current?.seek(newTime);
      setCurrentTime(newTime);
      resetControlsTimer();
    }, [currentTime, duration, resetControlsTimer]);

    const togglePlayPause = useCallback(() => {
      setIsPlaying(prev => !prev);
      resetControlsTimer();
    }, [resetControlsTimer]);

    const toggleMute = useCallback(() => {
      setIsMuted(prev => !prev);
      resetControlsTimer();
    }, [resetControlsTimer]);

    const toggleFullscreen = useCallback(() => {
      setIsFullscreen(prev => !prev);
      resetControlsTimer();
    }, [resetControlsTimer]);

    const handleVideoPress = useCallback(() => {
      if (showControls) {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      } else {
        resetControlsTimer();
      }
    }, [showControls, controlsOpacity, resetControlsTimer]);

    const progress = duration > 0 ? currentTime / duration : 0;

    // Render the video controls overlay
    const renderControls = () => {
      // Calculate safe area paddings for fullscreen
      // In landscape mode, left/right insets become more important
      const effectiveIsLandscape = isFullscreen && isLandscape;
      const topPadding = isFullscreen ? Math.max(insets.top, 12) : 8;
      const bottomPadding = isFullscreen ? Math.max(insets.bottom, 20) : 8;
      const horizontalPadding = effectiveIsLandscape 
        ? Math.max(insets.left, insets.right, 44) // More padding in landscape for notch
        : (isFullscreen ? Math.max(insets.left, insets.right, 20) : 12);
      
      return (
        <Animated.View 
          style={[
            styles.controlsOverlay,
            {opacity: controlsOpacity},
          ]}
          pointerEvents={showControls ? 'auto' : 'none'}>
          {/* Top bar - hide completely in landscape fullscreen, otherwise show controls */}
          {!effectiveIsLandscape && (
            <View style={[
              styles.topBar,
              {
                paddingTop: topPadding,
                paddingHorizontal: horizontalPadding,
              },
            ]}>
              {showOverlayHeader && onBack && !isFullscreen ? (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={onBack}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <ChevronLeft size={22} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={toggleMute}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  {isMuted ? (
                    <VolumeX size={18} color="#fff" />
                  ) : (
                    <Volume2 size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
              
              {showOverlayHeader && title && !isFullscreen ? (
                <Text style={styles.overlayTitle} numberOfLines={1}>
                  {title}
                </Text>
              ) : (
                <View style={styles.spacer} />
              )}
              
              {showOverlayHeader && onMenuPress && !isFullscreen ? (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={onMenuPress}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <MoreVertical size={20} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={toggleFullscreen}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  {isFullscreen ? (
                    <Minimize size={18} color="#fff" />
                  ) : (
                    <Maximize size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {/* Spacer when top bar is hidden in landscape */}
          {effectiveIsLandscape && <View style={styles.spacer} />}

          {/* Center controls - skip back, play/pause, skip forward */}
          <View style={styles.centerControls}>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => handleSkip(-10)}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <RotateCcw size={24} color="#fff" />
              <Text style={styles.skipText}>10</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playButton}
              onPress={togglePlayPause}>
              {isPlaying ? (
                <Pause size={28} color="#fff" fill="#fff" />
              ) : (
                <Play size={28} color="#fff" fill="#fff" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => handleSkip(10)}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <RotateCw size={24} color="#fff" />
              <Text style={styles.skipText}>10</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom bar - progress bar & time */}
          <View style={[
            styles.bottomBar,
            {
              paddingBottom: bottomPadding,
              paddingHorizontal: horizontalPadding,
            },
          ]}>
            {/* Mute button in landscape fullscreen (since top bar is hidden) */}
            {effectiveIsLandscape && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={toggleMute}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                {isMuted ? (
                  <VolumeX size={18} color="#fff" />
                ) : (
                  <Volume2 size={18} color="#fff" />
                )}
              </TouchableOpacity>
            )}
            
            <Text style={styles.timeText}>
              {formatVideoTimestamp(currentTime)}
            </Text>
            
            <View
              ref={progressBarRef}
              style={styles.progressContainer}
              onLayout={(e) => {
                progressBarLayout.current = {
                  x: e.nativeEvent.layout.x,
                  width: e.nativeEvent.layout.width,
                };
              }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={handleScrub}
              onResponderMove={handleScrub}
              onResponderRelease={handleScrub}>
              <View style={styles.progressBackground}>
                {/* Comment markers */}
                {duration > 0 &&
                  commentMarkers.map(marker => (
                    <View
                      key={marker.id}
                      style={[
                        styles.commentMarker,
                        {left: `${(marker.time / duration) * 100}%`},
                      ]}
                    />
                  ))}
                <View
                  style={[styles.progressFill, {width: `${progress * 100}%`}]}
                />
                <View
                  style={[
                    styles.progressHandle,
                    {left: `${progress * 100}%`},
                  ]}
                />
              </View>
            </View>

            <Text style={styles.timeText}>
              {formatVideoTimestamp(duration)}
            </Text>
            
            {/* Exit fullscreen button in landscape (since top bar is hidden) */}
            {effectiveIsLandscape && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={toggleFullscreen}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Minimize size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      );
    };

    // Single Video component - always rendered, styles change based on fullscreen
    const getVideoStyle = () => {
      if (!isFullscreen) return styles.video;
      // In fullscreen, video fills its container (container handles constraints)
      return styles.fullscreenVideo;
    };

    const videoElement = (
      <Video
        ref={videoRef}
        source={{uri: source}}
        poster={poster}
        style={getVideoStyle()}
        paused={!isPlaying}
        muted={isMuted}
        repeat={false}
        resizeMode="contain"
        onProgress={handleProgress}
        onLoad={handleLoad}
        onLoadStart={() => setIsLoading(true)}
        onReadyForDisplay={() => setIsLoading(false)}
      />
    );

    // Loading overlay
    const loadingOverlay = isLoading && (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );

    // If fullscreen, render everything in the Modal
    if (isFullscreen) {
      return (
        <>
          <StatusBar hidden />
          
          {/* Placeholder to maintain layout when fullscreen */}
          <View style={styles.container}>
            <View style={[styles.videoWrapper, {aspectRatio: videoAspectRatio}]}>
              <View style={styles.placeholderBackground} />
            </View>
          </View>

          {/* Fullscreen Modal */}
          <Modal
            visible
            animationType="fade"
            presentationStyle="fullScreen"
            supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
            onRequestClose={() => setIsFullscreen(false)}>
            <TouchableWithoutFeedback onPress={handleVideoPress}>
              <View style={styles.fullscreenContainer}>
                {/* Video container - fit within screen while maintaining aspect ratio */}
                <View style={(() => {
                  const screenAspect = screenDimensions.width / screenDimensions.height;
                  // If video is wider than screen, constrain by width; else by height
                  if (videoAspectRatio > screenAspect) {
                    // Video is wider - fit to width
                    return {
                      width: screenDimensions.width,
                      height: screenDimensions.width / videoAspectRatio,
                    };
                  } else {
                    // Video is taller - fit to height
                    return {
                      height: screenDimensions.height,
                      width: screenDimensions.height * videoAspectRatio,
                    };
                  }
                })()}>
                  {videoElement}
                  {loadingOverlay}
                  {renderControls()}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </>
      );
    }

    // Inline (non-fullscreen) view
    return (
      <>
        <StatusBar hidden={false} />
        
        <View style={styles.container}>
          <TouchableWithoutFeedback onPress={handleVideoPress}>
            <View style={[styles.videoWrapper, {aspectRatio: videoAspectRatio}]}>
              {videoElement}
              {loadingOverlay}
              {renderControls()}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  videoWrapper: {
    backgroundColor: '#000',
    width: '100%',
  },
  video: {
    flex: 1,
  },
  placeholderBackground: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenVideo: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  playButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
  },
  skipText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginTop: -4,
  },
  spacer: {
    flex: 1,
  },
  overlayTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.semibold,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  progressContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressFill: {
    position: 'absolute',
    height: 4,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  commentMarker: {
    position: 'absolute',
    width: 3,
    height: 8,
    backgroundColor: theme.colors.warning,
    top: -2.5,
    marginLeft: -1.5,
  },
  progressHandle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    marginLeft: -7,
    top: -5,
  },
  timeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
  },
});
