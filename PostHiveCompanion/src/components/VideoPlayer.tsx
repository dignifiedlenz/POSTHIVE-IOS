import React, {useRef, useState, useCallback, useImperativeHandle, forwardRef, useEffect, useMemo} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Text,
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  BackHandler,
  Platform,
  Modal,
  Dimensions,
  ScaledSize,
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
  /** When true, forces video to pause (e.g. when off-screen in a carousel) */
  forcePaused?: boolean;
}

export interface VideoPlayerRef {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  play: () => void;
  pause: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({source, poster, onTimeUpdate, commentMarkers = [], onFullscreenChange, onAspectRatioChange, fillContainer, title, onBack, onMenuPress, showOverlayHeader = false, onCommentPress, commentPopupOverlay, forcePaused = false}, ref) => {
    const videoRef = useRef<Video>(null);
    const fullscreenVideoRef = useRef<Video>(null);
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

    // Track window dimensions so the fullscreen modal can react to rotation. The Modal below opts
    // into all orientations, so it rotates even when the rest of the app is portrait-locked.
    const [windowSize, setWindowSize] = useState<ScaledSize>(() => Dimensions.get('window'));
    useEffect(() => {
      const sub = Dimensions.addEventListener('change', ({window}) => {
        setWindowSize(window);
      });
      return () => sub.remove();
    }, []);
    const isLandscape = windowSize.width > windowSize.height;
    const progressBarRef = useRef<View>(null);
    const progressBarLayout = useRef({x: 0, width: 0});
    const lastScrubTime = useRef(0);
    const scrubThrottleMs = 80;

    useEffect(() => {
      if (forcePaused) setIsPlaying(false);
    }, [forcePaused]);

    // Pick whichever Video instance is currently mounted as the playback target so
    // imperative seek calls hit the right player when the modal is open.
    const activeVideoRef = isFullscreen ? fullscreenVideoRef : videoRef;

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        activeVideoRef.current?.seek(time);
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

    // Auto enter/exit fullscreen when the device rotates. The app is portrait-locked
    // at the iOS level, but the fullscreen modal opts into all orientations so the
    // video can fill the rotated screen with proper safe-area letterboxing.
    useEffect(() => {
      setIsFullscreen(isLandscape);
    }, [isLandscape]);

    // Android back button - exit native fullscreen
    useEffect(() => {
      if (Platform.OS !== 'android') return;
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isFullscreen) {
          setIsFullscreen(false);
          return true;
        }
        return false;
      });
      return () => backHandler.remove();
    }, [isFullscreen]);

    // When fullscreen toggles, the *other* <Video> instance (inline ↔ fullscreen)
    // becomes the active one. The newly active player needs to be seeked back to
    // wherever the previous one left off so the user doesn't lose their place.
    // The inline player stays mounted (hidden) across toggles, so we seek it on
    // exit; the fullscreen player is mounted on entry and seeked in its onLoad.
    const prevFullscreenRef = useRef(isFullscreen);
    useEffect(() => {
      const wasFullscreen = prevFullscreenRef.current;
      prevFullscreenRef.current = isFullscreen;
      if (wasFullscreen && !isFullscreen) {
        const resumeAt = savedPositionRef.current;
        if (resumeAt > 0) {
          // Defer one frame so the inline <Video> is visible/active before seeking.
          requestAnimationFrame(() => {
            videoRef.current?.seek(resumeAt);
          });
        }
      }
    }, [isFullscreen]);

    const handleProgress = useCallback((data: OnProgressData) => {
      setCurrentTime(data.currentTime);
      savedPositionRef.current = data.currentTime;
      onTimeUpdate?.(data.currentTime);
    }, [onTimeUpdate]);

    useEffect(() => {
      savedPlayingRef.current = isPlaying;
    }, [isPlaying]);

    const savedPositionRef = useRef(0);
    const savedPlayingRef = useRef(false);

    const handleLoad = useCallback((data: OnLoadData) => {
      setDuration(data.duration);
      setIsLoading(false);
      if (data.naturalSize?.width && data.naturalSize?.height) {
        const ratio = data.naturalSize.width / data.naturalSize.height;
        setVideoAspectRatio(ratio);
        onAspectRatioChange?.(ratio);
      }
    }, [onAspectRatioChange]);

    // The fullscreen <Video> mounts fresh every time the modal opens, so its onLoad
    // is the correct place to resume playback at the position the inline player was
    // last at. This prevents the visible "jump back to 0" on rotation/fullscreen.
    const handleFullscreenLoad = useCallback(
      (data: OnLoadData) => {
        handleLoad(data);
        const resumeAt = savedPositionRef.current;
        if (resumeAt > 0) {
          fullscreenVideoRef.current?.seek(resumeAt);
        }
      },
      [handleLoad],
    );

    const getScrubPosition = useCallback((evt: GestureResponderEvent) => {
      const {width} = progressBarLayout.current;
      if (width <= 0 || duration <= 0) return null;
      const locX = evt.nativeEvent.locationX ?? 0;
      const prog = Math.max(0, Math.min(1, locX / width));
      return prog * duration;
    }, [duration]);

    const handleScrub = useCallback((evt: GestureResponderEvent, isRelease: boolean) => {
      const seekTime = getScrubPosition(evt);
      if (seekTime == null) return;
      const now = Date.now();
      if (!isRelease && now - lastScrubTime.current < scrubThrottleMs) return;
      lastScrubTime.current = now;
      activeVideoRef.current?.seek(seekTime);
      setCurrentTime(seekTime);
      savedPositionRef.current = seekTime;
      resetControlsTimer();
    }, [getScrubPosition, resetControlsTimer, activeVideoRef]);

    const handleSkip = useCallback((seconds: number) => {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      activeVideoRef.current?.seek(newTime);
      setCurrentTime(newTime);
      resetControlsTimer();
    }, [currentTime, duration, resetControlsTimer, activeVideoRef]);

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
        Animated.timing(controlsOpacity, {toValue: 0, duration: 200, useNativeDriver: true}).start(() => setShowControls(false));
      } else {
        resetControlsTimer();
      }
    }, [showControls, controlsOpacity, resetControlsTimer]);

    const progress = duration > 0 ? currentTime / duration : 0;

    const renderControls = (forFullscreen: boolean) => (
      <Animated.View style={[styles.controlsOverlay, {opacity: controlsOpacity}]} pointerEvents={showControls ? 'auto' : 'none'}>
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
          <TouchableOpacity style={styles.iconButton} onPress={toggleMute} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            {isMuted ? <VolumeX size={18} color="#fff" /> : <Volume2 size={18} color="#fff" />}
          </TouchableOpacity>
          <Text style={styles.timeText}>{formatVideoTimestamp(currentTime)}</Text>
          <View
            ref={progressBarRef}
            style={styles.progressContainer}
            onLayout={(e) => { progressBarLayout.current = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width }; }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => handleScrub(e, false)}
            onResponderMove={(e) => handleScrub(e, false)}
            onResponderRelease={(e) => handleScrub(e, true)}>
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

    // NOTE: don't include `startPosition` here — useMemo with deps [source] would
    // freeze it at 0 (the value of savedPositionRef on first render), and the
    // fullscreen <Video> would always start over. We seek imperatively in
    // handleFullscreenLoad / the exit-fullscreen effect instead.
    const videoSource = React.useMemo(() => ({uri: source}), [source]);

    // Compute the fullscreen video frame so the video stays inside the device's safe-area
    // rectangle (no bleed under the notch / Dynamic Island / home indicator) and is letterboxed
    // to match the source aspect ratio. Only the *actual* safe-area insets are respected —
    // no extra padding — so the video gets as close to edge-to-edge as the hardware allows.
    const fullscreenLayout = useMemo(() => {
      // In landscape the notch ends up on one side; mirror it so the video stays centred.
      const horizontalInset = isLandscape ? Math.max(insets.left, insets.right) : 0;
      const verticalInset = isLandscape ? Math.max(insets.top, insets.bottom) : insets.top;

      const availableWidth = Math.max(0, windowSize.width - horizontalInset * 2);
      const availableHeight = Math.max(0, windowSize.height - verticalInset * 2);

      // Fit to available rect while preserving aspect ratio (object-fit: contain).
      let videoWidth = availableWidth;
      let videoHeight = availableWidth / videoAspectRatio;
      if (videoHeight > availableHeight) {
        videoHeight = availableHeight;
        videoWidth = availableHeight * videoAspectRatio;
      }

      return {
        horizontalInset,
        verticalInset,
        availableWidth,
        availableHeight,
        videoWidth,
        videoHeight,
      };
    }, [isLandscape, insets.left, insets.right, insets.top, insets.bottom, windowSize.width, windowSize.height, videoAspectRatio]);

    return (
      <View style={[styles.container, fillContainer && styles.fillContainer]}>
        <TouchableWithoutFeedback onPress={handleVideoPress}>
          <View style={[styles.videoWrapper, fillContainer ? styles.fillWrapper : {aspectRatio: videoAspectRatio}]}>
            {/* Inline player. Hidden visually while fullscreen modal is up so we don't
                double-render frames or fight for the audio session. */}
            <Video
              ref={videoRef}
              source={videoSource}
              poster={poster}
              style={[styles.video, isFullscreen && styles.hiddenVideo]}
              paused={!isPlaying || forcePaused || isFullscreen}
              muted={isMuted}
              repeat={false}
              resizeMode="contain"
              onProgress={isFullscreen ? undefined : handleProgress}
              onLoad={handleLoad}
              onLoadStart={() => setIsLoading(true)}
              onReadyForDisplay={() => setIsLoading(false)}
            />
            {isLoading && !isFullscreen && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
            {!isFullscreen && renderControls(false)}
            {!isFullscreen && commentPopupOverlay}
          </View>
        </TouchableWithoutFeedback>

        {/* Custom fullscreen modal. supportedOrientations lets it rotate to landscape on its
            own, even though the rest of the app is portrait-locked at the iOS level. */}
        <Modal
          visible={isFullscreen}
          presentationStyle="overFullScreen"
          transparent
          animationType="fade"
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          onRequestClose={() => setIsFullscreen(false)}>
          <TouchableWithoutFeedback onPress={handleVideoPress}>
            <View style={styles.fullscreenContainer}>
              <View
                style={[
                  styles.fullscreenSafeArea,
                  {
                    paddingTop: fullscreenLayout.verticalInset,
                    paddingBottom: fullscreenLayout.verticalInset,
                    paddingLeft: fullscreenLayout.horizontalInset,
                    paddingRight: fullscreenLayout.horizontalInset,
                  },
                ]}>
                <View
                  style={[
                    styles.fullscreenVideoWrapper,
                    {
                      width: fullscreenLayout.videoWidth,
                      height: fullscreenLayout.videoHeight,
                    },
                  ]}>
                  <Video
                    ref={fullscreenVideoRef}
                    source={videoSource}
                    poster={poster}
                    style={styles.video}
                    paused={!isPlaying || forcePaused}
                    muted={isMuted}
                    repeat={false}
                    resizeMode="contain"
                    onProgress={handleProgress}
                    onLoad={handleFullscreenLoad}
                    onLoadStart={() => setIsLoading(true)}
                    onReadyForDisplay={() => setIsLoading(false)}
                  />
                  {isLoading && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color="#fff" />
                    </View>
                  )}
                </View>
              </View>
              {renderControls(true)}
              {commentPopupOverlay}
            </View>
          </TouchableWithoutFeedback>
        </Modal>
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
  hiddenVideo: {
    opacity: 0,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenSafeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
