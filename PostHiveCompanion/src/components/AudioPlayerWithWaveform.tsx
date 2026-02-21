import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
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
import {
  AudioContext,
  AudioBufferSourceNode,
  AnalyserNode,
  AudioBuffer,
} from 'react-native-audio-api';
import {
  Play,
  Pause,
  Minimize,
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

const FFT_SIZE = 256;
const BAR_COUNT = 36;
const MIN_BAR_HEIGHT = 6;
const MAX_BAR_HEIGHT = 52;

interface CommentMarker {
  id: string;
  time: number;
}

interface AudioPlayerWithWaveformProps {
  source: string;
  onTimeUpdate?: (currentTime: number) => void;
  commentMarkers?: CommentMarker[];
  onFullscreenChange?: (isFullscreen: boolean) => void;
  fillContainer?: boolean;
  title?: string;
  onBack?: () => void;
  onMenuPress?: () => void;
  showOverlayHeader?: boolean;
  onCommentPress?: (currentTime: number) => void;
  commentPopupOverlay?: React.ReactNode;
}

export interface AudioPlayerWithWaveformRef {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  play: () => void;
  pause: () => void;
}

const AUDIO_ASPECT_RATIO = 16 / 5;

export const AudioPlayerWithWaveform = forwardRef<
  AudioPlayerWithWaveformRef,
  AudioPlayerWithWaveformProps
>(
  (
    {
      source,
      onTimeUpdate,
      commentMarkers = [],
      onFullscreenChange,
      fillContainer,
      title,
      onBack,
      onMenuPress,
      showOverlayHeader = false,
      onCommentPress,
      commentPopupOverlay,
    },
    ref,
  ) => {
    const insets = useSafeAreaInsets();
    const windowDims = useWindowDimensions();

    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [frequencyData, setFrequencyData] = useState<number[]>(
      Array(BAR_COUNT).fill(0),
    );

    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);
    const playbackStartTimeRef = useRef<number>(0);
    const playbackOffsetRef = useRef<number>(0);
    const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
      null,
    );
    const rafRef = useRef<number>(0);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );
    const controlsOpacity = useRef(new Animated.Value(1)).current;
    const progressBarLayout = useRef({x: 0, width: 0});

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        playbackOffsetRef.current = Math.max(0, Math.min(duration, time));
        setCurrentTime(playbackOffsetRef.current);
        onTimeUpdate?.(playbackOffsetRef.current);
        if (isPlaying) {
          stopPlayback();
          startPlayback();
        }
      },
      getCurrentTime: () => currentTime,
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
    }));

    const stopPlayback = useCallback(() => {
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch (_) {}
        sourceNodeRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    }, []);

    const startPlayback = useCallback(() => {
      const ctx = audioContextRef.current;
      const buffer = audioBufferRef.current;
      const analyser = analyserRef.current;
      if (!ctx || !buffer || !analyser) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);
      const bufDuration = buffer.duration;
      source.onEnded = () => {
        setIsPlaying(false);
        setCurrentTime(bufDuration);
        playbackOffsetRef.current = bufDuration;
        onTimeUpdate?.(bufDuration);
      };
      sourceNodeRef.current = source;

      const offset = playbackOffsetRef.current;
      const remaining = duration - offset;
      if (remaining <= 0) return;

      playbackStartTimeRef.current = ctx.currentTime;
      source.start(0, offset, remaining);

      progressIntervalRef.current = setInterval(() => {
        const elapsed = ctx.currentTime - playbackStartTimeRef.current;
        const pos = playbackOffsetRef.current + elapsed;
        if (pos >= duration) {
          setCurrentTime(duration);
          playbackOffsetRef.current = duration;
          onTimeUpdate?.(duration);
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
        } else {
          setCurrentTime(pos);
          onTimeUpdate?.(pos);
        }
      }, 100);

      const draw = () => {
        if (!analyserRef.current || !isPlaying) return;
        const freqs = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freqs);

        const binCount = freqs.length;
        const step = Math.floor(binCount / BAR_COUNT);
        const bars: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          const idx = Math.min(i * step, binCount - 1);
          const val = freqs[idx] ?? 0;
          bars.push(val / 255);
        }
        setFrequencyData(bars);
        rafRef.current = requestAnimationFrame(draw);
      };
      draw();
    }, [duration, onTimeUpdate]);

    useEffect(() => {
      if (!source) return;

      let cancelled = false;
      setIsLoading(true);
      setError(null);

      const init = async () => {
        try {
          const ctx = new AudioContext();
          audioContextRef.current = ctx;

          const buffer = await ctx.decodeAudioData(source);
          if (cancelled) return;

          audioBufferRef.current = buffer;
          setDuration(buffer.duration);

          const analyser = ctx.createAnalyser();
          analyser.fftSize = FFT_SIZE;
          analyser.smoothingTimeConstant = 0.7;
          analyser.connect(ctx.destination);
          analyserRef.current = analyser;

          setIsLoading(false);
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : 'Failed to load audio');
            setIsLoading(false);
          }
        }
      };

      init();
      return () => {
        cancelled = true;
        stopPlayback();
        audioContextRef.current?.close();
        audioContextRef.current = null;
        analyserRef.current = null;
        audioBufferRef.current = null;
      };
    }, [source, stopPlayback]);

    useEffect(() => {
      if (isPlaying) {
        startPlayback();
      } else {
        stopPlayback();
      }
      return () => stopPlayback();
    }, [isPlaying, startPlayback, stopPlayback]);

    useEffect(() => {
      onFullscreenChange?.(isFullscreen);
    }, [isFullscreen, onFullscreenChange]);

    useEffect(() => {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (isFullscreen) {
            setIsFullscreen(false);
            return true;
          }
          return false;
        },
      );
      return () => backHandler.remove();
    }, [isFullscreen]);

    const resetControlsTimer = useCallback(() => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      setShowControls(true);
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => {
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
        if (controlsTimeoutRef.current)
          clearTimeout(controlsTimeoutRef.current);
      };
    }, [isPlaying, resetControlsTimer]);

    const progress = duration > 0 ? currentTime / duration : 0;

    const handleScrub = useCallback(
      (evt: GestureResponderEvent) => {
        const barWidth = progressBarLayout.current.width;
        if (barWidth > 0 && duration > 0) {
          const prog = Math.max(
            0,
            Math.min(1, evt.nativeEvent.locationX / barWidth),
          );
          const seekTime = prog * duration;
          playbackOffsetRef.current = seekTime;
          setCurrentTime(seekTime);
          onTimeUpdate?.(seekTime);
          if (isPlaying) {
            stopPlayback();
            startPlayback();
          }
          resetControlsTimer();
        }
      },
      [duration, isPlaying, onTimeUpdate, resetControlsTimer, startPlayback, stopPlayback],
    );

    const handleSkip = useCallback(
      (seconds: number) => {
        const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
        playbackOffsetRef.current = newTime;
        setCurrentTime(newTime);
        onTimeUpdate?.(newTime);
        if (isPlaying) {
          stopPlayback();
          startPlayback();
        }
        resetControlsTimer();
      },
      [currentTime, duration, isPlaying, onTimeUpdate, resetControlsTimer, startPlayback, stopPlayback],
    );

    const togglePlayPause = useCallback(() => {
      setIsPlaying((prev) => !prev);
      resetControlsTimer();
    }, [resetControlsTimer]);

    const toggleFullscreen = useCallback(() => {
      setIsFullscreen((prev) => !prev);
      resetControlsTimer();
    }, [resetControlsTimer]);

    const handlePress = useCallback(() => {
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

    const renderWaveform = () => (
      <View style={styles.waveformContainer}>
        {frequencyData.map((norm, i) => (
          <View
            key={i}
            style={[
              styles.waveformBar,
              {
                height:
                  MIN_BAR_HEIGHT +
                  (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT) * Math.max(0.1, norm),
              },
            ]}
          />
        ))}
      </View>
    );

    const renderControls = (forFullscreen: boolean) => (
      <Animated.View
        style={[
          styles.controlsOverlay,
          {opacity: controlsOpacity},
        ]}
        pointerEvents={showControls ? 'auto' : 'none'}>
        <View
          style={[
            styles.topBar,
            {
              paddingTop: forFullscreen ? Math.max(insets.top, 12) : 8,
              paddingHorizontal: forFullscreen
                ? Math.max(insets.left, insets.right, 20)
                : Math.max(insets.left, insets.right, 12),
            },
          ]}>
          {showOverlayHeader && onBack && !forFullscreen ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onBack}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <ChevronLeft size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}
          {showOverlayHeader && title && !forFullscreen ? (
            <Text style={styles.overlayTitle} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <View style={styles.spacer} />
          )}
          {showOverlayHeader && onMenuPress && !forFullscreen ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onMenuPress}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <MoreVertical size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>

        {onCommentPress && (
          <View
            style={[
              styles.floatingCommentButton,
              forFullscreen && {
                bottom: Math.max(insets.bottom, 20) + 50,
                right: Math.max(insets.right, 16),
              },
            ]}
            pointerEvents="box-none">
            <TouchableOpacity
              style={styles.floatingCommentButtonInner}
              onPress={() => {
                setIsPlaying(false);
                resetControlsTimer();
                onCommentPress(currentTime);
              }}
              hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
              <MessageCircle size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.centerControls}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => handleSkip(-10)}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <RotateCcw size={24} color="#fff" />
            <Text style={styles.skipText}>10</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
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

        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: forFullscreen ? Math.max(insets.bottom, 20) : 8,
              paddingHorizontal: forFullscreen
                ? Math.max(insets.left, insets.right, 44)
                : Math.max(insets.left, insets.right, 12),
            },
          ]}>
          <Text style={styles.timeText}>
            {formatVideoTimestamp(currentTime)}
          </Text>
          <View
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
              {duration > 0 &&
                commentMarkers.map((marker) => (
                  <View
                    key={marker.id}
                    style={[
                      styles.commentMarker,
                      {left: `${(marker.time / duration) * 100}%`},
                    ]}
                  />
                ))}
              <View style={[styles.progressFill, {width: `${progress * 100}%`}]} />
              <View style={[styles.progressHandle, {left: `${progress * 100}%`}]} />
            </View>
          </View>
          <Text style={styles.timeText}>
            {formatVideoTimestamp(duration)}
          </Text>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={toggleFullscreen}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            {forFullscreen ? (
              <Minimize size={20} color="#fff" />
            ) : (
              <Fullscreen size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    );

    if (error) {
      return (
        <View style={[styles.container, styles.errorContainer]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    const content = (
      <View
        style={[
          styles.waveformWrapper,
          fillContainer && styles.fillWrapper,
          {aspectRatio: AUDIO_ASPECT_RATIO},
        ]}>
        {renderWaveform()}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
        {renderControls(false)}
      </View>
    );

    if (isFullscreen) {
      return (
        <>
          <StatusBar hidden />
          <View style={[styles.container, fillContainer && styles.fillContainer]}>
            <View
              style={[
                styles.waveformWrapper,
                {aspectRatio: AUDIO_ASPECT_RATIO},
              ]}
            />
          </View>
          <Modal
            visible
            animationType="fade"
            presentationStyle="fullScreen"
            statusBarTranslucent
            supportedOrientations={[
              'portrait',
              'landscape',
              'landscape-left',
              'landscape-right',
            ]}
            onRequestClose={() => setIsFullscreen(false)}>
            <View style={styles.fullscreenContainer}>
              <TouchableWithoutFeedback onPress={handlePress}>
                <View style={styles.fullscreenInner}>
                  <View style={styles.fullscreenWaveformWrapper}>
                    {renderWaveform()}
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
        <TouchableWithoutFeedback onPress={handlePress}>
          {content}
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
  fillWrapper: {
    flex: 1,
  },
  waveformWrapper: {
    backgroundColor: '#000',
    width: '100%',
    overflow: 'hidden',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 24,
    paddingHorizontal: 16,
    flex: 1,
  },
  waveformBar: {
    width: 4,
    minHeight: MIN_BAR_HEIGHT,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignSelf: 'center',
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
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenWaveformWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
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
  },
  playButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
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
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
  },
});
