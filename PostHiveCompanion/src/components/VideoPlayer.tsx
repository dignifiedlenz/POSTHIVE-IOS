import React, {useRef, useState, useCallback, useImperativeHandle, forwardRef, useEffect} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Text,
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  Modal,
  BackHandler,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import Video, {OnProgressData, OnLoadData} from 'react-native-video';
import {
  Play,
  Pause,
  Minimize,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  ChevronLeft,
  MoreVertical,
  MessageCircle,
  Fullscreen,
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
  onAspectRatioChange?: (aspectRatio: number) => void;
  fillContainer?: boolean;
  // Overlay props
  title?: string;
  onBack?: () => void;
  onMenuPress?: () => void;
  showOverlayHeader?: boolean;
  onCommentPress?: (currentTime: number) => void;
  /** Rendered inside fullscreen modal when provided - use for comment popup that must appear over video */
  commentPopupOverlay?: React.ReactNode;
}

export interface VideoPlayerRef {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  play: () => void;
  pause: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({source, poster, onTimeUpdate, commentMarkers = [], onFullscreenChange, onAspectRatioChange, fillContainer, title, onBack, onMenuPress, showOverlayHeader = false, onCommentPress, commentPopupOverlay}, ref) => {
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
    const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9);
    const progressBarRef = useRef<View>(null);
    const progressBarLayout = useRef({x: 0, width: 0});
    const windowDims = useWindowDimensions();

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
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      setShowControls(true);
      Animated.timing(controlsOpacity, {toValue: 1, duration: 150, useNativeDriver: true}).start();
      if (isPlaying) {
        controlsTimeout.current = setTimeout(() => {
          Animated.timing(controlsOpacity, {toValue: 0, duration: 300, useNativeDriver: true}).start(() => setShowControls(false));
        }, 3000);
      }
    }, [isPlaying, controlsOpacity]);

    useEffect(() => {
      resetControlsTimer();
      return () => { if (controlsTimeout.current) clearTimeout(controlsTimeout.current); };
    }, [isPlaying, resetControlsTimer]);

    useEffect(() => {
      onFullscreenChange?.(isFullscreen);
    }, [isFullscreen, onFullscreenChange]);

    // Orientation = fullscreen state: landscape = fullscreen, portrait = normal layout
    useEffect(() => {
      const isLandscape = windowDims.width > windowDims.height;
      if (isLandscape && !isFullscreen) {
        setIsFullscreen(true);
      } else if (!isLandscape && isFullscreen) {
        setIsFullscreen(false);
      }
    }, [windowDims.width, windowDims.height, isFullscreen]);

    // Android back button - exit fullscreen modal
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

    const handleProgress = useCallback((data: OnProgressData) => {
      setCurrentTime(data.currentTime);
      onTimeUpdate?.(data.currentTime);
    }, [onTimeUpdate]);

    const handleLoad = useCallback((data: OnLoadData) => {
      setDuration(data.duration);
      setIsLoading(false);
      if (data.naturalSize?.width && data.naturalSize?.height) {
        const ratio = data.naturalSize.width / data.naturalSize.height;
        setVideoAspectRatio(ratio);
        onAspectRatioChange?.(ratio);
      }
      // Restore playback position when video (re)loads (e.g. after fullscreen toggle)
      if (currentTime > 0) {
        videoRef.current?.seek(currentTime);
      }
    }, [onAspectRatioChange, currentTime]);

    const handleScrub = useCallback((evt: GestureResponderEvent) => {
      const barWidth = progressBarLayout.current.width;
      if (barWidth > 0 && duration > 0) {
        const prog = Math.max(0, Math.min(1, evt.nativeEvent.locationX / barWidth));
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

    const screenDimensions = {width: windowDims.width, height: windowDims.height};
    const isLandscape = screenDimensions.width > screenDimensions.height;

    // Fullscreen: fit video to screen (no cropping)
    const fullscreenVideoDimensions = (() => {
      const {width: sw, height: sh} = screenDimensions;
      const screenAspect = sw / sh;
      if (videoAspectRatio > screenAspect) {
        return {width: sw, height: sw / videoAspectRatio};
      }
      return {width: sh * videoAspectRatio, height: sh};
    })();

    const handleVideoPress = useCallback(() => {
      if (showControls) {
        Animated.timing(controlsOpacity, {toValue: 0, duration: 200, useNativeDriver: true}).start(() => setShowControls(false));
      } else {
        resetControlsTimer();
      }
    }, [showControls, controlsOpacity, resetControlsTimer]);

    const progress = duration > 0 ? currentTime / duration : 0;

    const effectiveIsLandscape = isFullscreen && isLandscape;
    const renderControls = (forFullscreen: boolean) => (
      <Animated.View style={[styles.controlsOverlay, {opacity: controlsOpacity}]} pointerEvents={showControls ? 'auto' : 'none'}>
        {!effectiveIsLandscape && (
        <View style={[styles.topBar, {paddingTop: forFullscreen ? Math.max(insets.top, 12) : 8, paddingHorizontal: forFullscreen ? Math.max(insets.left, insets.right, 20) : Math.max(insets.left, insets.right, 12)}]}>
          {showOverlayHeader && onBack && !forFullscreen ? (
            <TouchableOpacity style={styles.iconButton} onPress={onBack} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <ChevronLeft size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.iconButton} onPress={toggleMute} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              {isMuted ? <VolumeX size={18} color="#fff" /> : <Volume2 size={18} color="#fff" />}
            </TouchableOpacity>
          )}
          {showOverlayHeader && title && !forFullscreen ? (
            <Text style={styles.overlayTitle} numberOfLines={1}>{title}</Text>
          ) : (
            <View style={styles.spacer} />
          )}
          {showOverlayHeader && onMenuPress && !forFullscreen ? (
            <TouchableOpacity style={styles.iconButton} onPress={onMenuPress} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <MoreVertical size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>
        )}
        {effectiveIsLandscape && <View style={styles.spacer} />}

        {onCommentPress && (
          <View style={[styles.floatingCommentButton, forFullscreen && {bottom: Math.max(insets.bottom, 20) + 50, right: Math.max(insets.right, 16)}]} pointerEvents="box-none">
            <TouchableOpacity style={styles.floatingCommentButtonInner} onPress={() => { setIsPlaying(false); resetControlsTimer(); onCommentPress(currentTime); }} hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
              <MessageCircle size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.centerControls}>
          <TouchableOpacity style={styles.skipButton} onPress={() => handleSkip(-10)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <RotateCcw size={24} color="#fff" />
            <Text style={styles.skipText}>10</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
            {isPlaying ? <Pause size={28} color="#fff" fill="#fff" /> : <Play size={28} color="#fff" fill="#fff" />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={() => handleSkip(10)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <RotateCw size={24} color="#fff" />
            <Text style={styles.skipText}>10</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.bottomBar, {paddingBottom: forFullscreen ? Math.max(insets.bottom, 20) : 8, paddingHorizontal: forFullscreen ? Math.max(insets.left, insets.right, 44) : Math.max(insets.left, insets.right, 12)}]}>
          {effectiveIsLandscape && (
            <TouchableOpacity style={styles.iconButton} onPress={toggleMute} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              {isMuted ? <VolumeX size={18} color="#fff" /> : <Volume2 size={18} color="#fff" />}
            </TouchableOpacity>
          )}
          <Text style={styles.timeText}>{formatVideoTimestamp(currentTime)}</Text>
          <View
            ref={progressBarRef}
            style={styles.progressContainer}
            onLayout={(e) => { progressBarLayout.current = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width }; }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleScrub}
            onResponderMove={handleScrub}
            onResponderRelease={handleScrub}>
            <View style={styles.progressBackground}>
              {duration > 0 && commentMarkers.map(marker => (
                <View key={marker.id} style={[styles.commentMarker, {left: `${(marker.time / duration) * 100}%`}]} />
              ))}
              <View style={[styles.progressFill, {width: `${progress * 100}%`}]} />
              <View style={[styles.progressHandle, {left: `${progress * 100}%`}]} />
            </View>
          </View>
          <Text style={styles.timeText}>{formatVideoTimestamp(duration)}</Text>
          <TouchableOpacity style={styles.iconButton} onPress={toggleFullscreen} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            {forFullscreen ? <Minimize size={20} color="#fff" /> : <Fullscreen size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </Animated.View>
    );

    const videoElement = (
      <Video
        ref={videoRef}
        source={{uri: source}}
        poster={poster}
        style={isFullscreen ? fullscreenVideoDimensions : styles.video}
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

    if (isFullscreen) {
      return (
        <>
          <StatusBar hidden />
          <View style={[styles.container, fillContainer && styles.fillContainer]}>
            <View style={[styles.videoWrapper, fillContainer ? styles.fillWrapper : {aspectRatio: videoAspectRatio}]} />
          </View>
          <Modal
            visible
            animationType="fade"
            presentationStyle="fullScreen"
            statusBarTranslucent
            supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
            onRequestClose={() => setIsFullscreen(false)}>
            <View style={styles.fullscreenContainer}>
              <TouchableWithoutFeedback onPress={handleVideoPress}>
                <View style={styles.fullscreenInner}>
                  <View
                    style={[
                      styles.fullscreenVideoWrapper,
                      {
                        position: 'absolute',
                        left: (screenDimensions.width - fullscreenVideoDimensions.width) / 2,
                        top: (screenDimensions.height - fullscreenVideoDimensions.height) / 2,
                        width: fullscreenVideoDimensions.width,
                        height: fullscreenVideoDimensions.height,
                      },
                    ]}>
                    {videoElement}
                    {isLoading && (
                      <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#fff" />
                      </View>
                    )}
                  </View>
                  {renderControls(true)}
                  {commentPopupOverlay}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </Modal>
        </>
      );
    }

    return (
      <View style={[styles.container, fillContainer && styles.fillContainer]}>
        <TouchableWithoutFeedback onPress={handleVideoPress}>
          <View style={[styles.videoWrapper, fillContainer ? styles.fillWrapper : {aspectRatio: videoAspectRatio}]}>
            {videoElement}
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
            {renderControls(false)}
          </View>
        </TouchableWithoutFeedback>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  fillContainer: {
    flex: 1,
  },
  videoWrapper: {
    backgroundColor: '#000',
    width: '100%',
    overflow: 'hidden',
  },
  fillWrapper: {
    flex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenVideoWrapper: {
    backgroundColor: '#000',
    overflow: 'hidden',
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
  floatingCommentButton: {
    position: 'absolute',
    bottom: 56,
    right: 12,
    alignItems: 'flex-end',
  },
  floatingCommentButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
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
