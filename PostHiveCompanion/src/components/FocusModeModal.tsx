import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Alert,
  BackHandler,
  Dimensions,
  StatusBar,
  AppState,
  AppStateStatus,
  Vibration,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import KeepAwake from 'react-native-keep-awake';
import {
  X,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Target,
  AlertTriangle,
} from 'lucide-react-native';
import {theme} from '../theme';
import {Todo} from '../lib/types';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

interface FocusModeModalProps {
  visible: boolean;
  task: Todo | null;
  onClose: () => void;
  onComplete: () => void;
  scheduledEnd?: string | null;
}

// Motivational quotes for intro
const MOTIVATIONAL_QUOTES = [
  {quote: "The secret of getting ahead is getting started.", author: "Mark Twain"},
  {quote: "Focus on being productive instead of busy.", author: "Tim Ferriss"},
  {quote: "Do the hard jobs first. The easy jobs will take care of themselves.", author: "Dale Carnegie"},
  {quote: "It's not about having time, it's about making time.", author: "Unknown"},
  {quote: "The way to get started is to quit talking and begin doing.", author: "Walt Disney"},
  {quote: "Your focus determines your reality.", author: "Qui-Gon Jinn"},
  {quote: "Eliminate distractions. Dominate your day.", author: "Unknown"},
  {quote: "Deep work is the ability to focus without distraction.", author: "Cal Newport"},
];

export function FocusModeModal({
  visible,
  task,
  onClose,
  onComplete,
  scheduledEnd,
}: FocusModeModalProps) {
  const insets = useSafeAreaInsets();
  
  // Phase: 'intro' -> 'countdown' -> 'active'
  const [phase, setPhase] = useState<'intro' | 'countdown' | 'active'>('intro');
  const [countdown, setCountdown] = useState(3);
  const [currentQuote] = useState(() => 
    MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  );
  
  // Time tracking using timestamps for accuracy
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [totalFocusedMs, setTotalFocusedMs] = useState(0);
  const [totalDistractedMs, setTotalDistractedMs] = useState(0);
  const [currentSegmentStart, setCurrentSegmentStart] = useState<Date | null>(null);
  const [isInApp, setIsInApp] = useState(true);
  
  const [isPaused, setIsPaused] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [distractionCount, setDistractionCount] = useState(0);
  const [showDistractionWarning, setShowDistractionWarning] = useState(false);
  
  // Display values (updated every second)
  const [displayFocusSeconds, setDisplayFocusSeconds] = useState(0);
  const [displayDistractedSeconds, setDisplayDistractedSeconds] = useState(0);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownAnim = useRef(new Animated.Value(1)).current;
  const introFadeAnim = useRef(new Animated.Value(0)).current;
  const appState = useRef(AppState.currentState);

  // Create a default focus session if no task
  const displayTask = task || {
    id: 'focus-session',
    title: 'Focus Session',
    project_name: null,
    status: 'in_progress' as const,
    priority: 'medium' as const,
    workspace_id: '',
    created_by: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const hasRealTask = !!task;

  // Reset when modal opens - start with intro phase
  useEffect(() => {
    if (visible) {
      // Reset everything
      setPhase('intro');
      setCountdown(3);
      setTotalFocusedMs(0);
      setTotalDistractedMs(0);
      setDisplayFocusSeconds(0);
      setDisplayDistractedSeconds(0);
      setIsInApp(true);
      setIsPaused(false);
      setShowExitConfirm(false);
      setDistractionCount(0);
      setShowDistractionWarning(false);
      setSessionStartTime(null);
      setCurrentSegmentStart(null);
      
      // Fade in the intro
      introFadeAnim.setValue(0);
      Animated.timing(introFadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, introFadeAnim]);

  // Handle countdown phase
  useEffect(() => {
    if (phase !== 'countdown') return;
    
    if (countdown > 0) {
      // Animate the number
      countdownAnim.setValue(0.5);
      Animated.spring(countdownAnim, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }).start();
      
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      // Countdown finished, start the session
      const now = new Date();
      setSessionStartTime(now);
      setCurrentSegmentStart(now);
      setPhase('active');
      Vibration.vibrate(100);
    }
  }, [phase, countdown, countdownAnim]);

  // Start countdown when user taps "Begin"
  const handleBeginFocus = useCallback(() => {
    setPhase('countdown');
  }, []);

  // Update display every second based on accumulated time + current segment
  useEffect(() => {
    if (!visible || isPaused || phase !== 'active') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const segmentMs = currentSegmentStart ? now - currentSegmentStart.getTime() : 0;
      
      if (isInApp) {
        // Currently focused - add current segment to focused time
        setDisplayFocusSeconds(Math.floor((totalFocusedMs + segmentMs) / 1000));
        setDisplayDistractedSeconds(Math.floor(totalDistractedMs / 1000));
      } else {
        // Currently distracted - add current segment to distracted time
        setDisplayFocusSeconds(Math.floor(totalFocusedMs / 1000));
        setDisplayDistractedSeconds(Math.floor((totalDistractedMs + segmentMs) / 1000));
      }
    }, 100); // Update frequently for smooth display

    return () => clearInterval(interval);
  }, [visible, isPaused, phase, isInApp, totalFocusedMs, totalDistractedMs, currentSegmentStart]);

  // APP STATE DETECTION - Track when user leaves/returns to app
  useEffect(() => {
    if (!visible) return;

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const now = new Date();
      
      if (
        appState.current === 'active' &&
        (nextAppState === 'inactive' || nextAppState === 'background')
      ) {
        // User is leaving the app
        console.log('🚨 Focus Mode: User left the app!');
        
        // Finalize the focused segment
        if (currentSegmentStart && isInApp) {
          const segmentMs = now.getTime() - currentSegmentStart.getTime();
          setTotalFocusedMs(prev => prev + segmentMs);
        }
        
        // Start tracking distracted time
        setCurrentSegmentStart(now);
        setIsInApp(false);
      }

      if (
        (appState.current === 'inactive' || appState.current === 'background') &&
        nextAppState === 'active'
      ) {
        // User came back
        console.log('👀 Focus Mode: User returned!');
        
        // Finalize the distracted segment
        if (currentSegmentStart && !isInApp) {
          const segmentMs = now.getTime() - currentSegmentStart.getTime();
          setTotalDistractedMs(prev => prev + segmentMs);
          
          // Only count as distraction if > 2 seconds
          if (segmentMs > 2000) {
            setDistractionCount(prev => prev + 1);
            setShowDistractionWarning(true);
            Vibration.vibrate(200);
          }
        }
        
        // Start tracking focused time again
        setCurrentSegmentStart(now);
        setIsInApp(true);
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [visible, currentSegmentStart, isInApp]);

  // Pulse animation for the timer
  useEffect(() => {
    if (!visible || isPaused) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => pulse.stop();
  }, [visible, isPaused, pulseAnim]);

  // Handle back button on Android
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExitAttempt();
      return true;
    });

    return () => backHandler.remove();
  }, [visible]);

  const handleExitAttempt = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  const handleConfirmExit = useCallback(() => {
    setShowExitConfirm(false);
    onClose();
  }, [onClose]);

  const handleCancelExit = useCallback(() => {
    setShowExitConfirm(false);
  }, []);

  const handleComplete = useCallback(() => {
    Alert.alert(
      'Complete Task?',
      'Mark this task as completed?',
      [
        {text: 'Keep Working', style: 'cancel'},
        {
          text: 'Complete',
          style: 'default',
          onPress: () => {
            onComplete();
            onClose();
          },
        },
      ],
    );
  }, [onComplete, onClose]);

  const handleDismissWarning = useCallback(() => {
    setShowDistractionWarning(false);
    setIsPaused(false); // Resume after acknowledging
  }, []);

  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getRemainingTime = (): string | null => {
    if (!scheduledEnd) return null;
    try {
      const end = new Date(scheduledEnd);
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      if (diff <= 0) return 'OVERTIME';
      
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      
      if (hours > 0) {
        return `${hours}H ${mins}M REMAINING`;
      }
      return `${mins}M REMAINING`;
    } catch {
      return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <View style={styles.container}>
        {/* Close button - only show during intro */}
        {phase === 'intro' && (
          <TouchableOpacity
            style={[styles.closeButton, {top: insets.top + 16}]}
            onPress={onClose}
          >
            <X size={20} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
        
        {/* Close button during active - requires confirmation */}
        {phase === 'active' && (
          <TouchableOpacity
            style={[styles.closeButton, {top: insets.top + 16}]}
            onPress={handleExitAttempt}
          >
            <X size={20} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}

        {/* ===== INTRO PHASE ===== */}
        {phase === 'intro' && (
          <Animated.View style={[styles.introContainer, {opacity: introFadeAnim, paddingTop: insets.top + 60}]}>
            <View style={styles.introContent}>
              {/* Quote */}
              <View style={styles.quoteContainer}>
                <Text style={styles.quoteText}>"{currentQuote.quote}"</Text>
                <Text style={styles.quoteAuthor}>— {currentQuote.author}</Text>
              </View>
              
              {/* Task preview */}
              {hasRealTask && (
                <View style={styles.introTaskCard}>
                  <Text style={styles.introTaskLabel}>YOU'RE ABOUT TO FOCUS ON</Text>
                  <Text style={styles.introTaskTitle}>{displayTask.title}</Text>
                  {displayTask.project_name && (
                    <Text style={styles.introProjectName}>{displayTask.project_name}</Text>
                  )}
                </View>
              )}
              
              {/* Tip */}
              <View style={styles.tipContainer}>
                <Text style={styles.tipText}>
                  Leaving the app will count as distracted time
                </Text>
              </View>
            </View>
            
            {/* Begin button */}
            <TouchableOpacity
              style={styles.beginButton}
              onPress={handleBeginFocus}
              activeOpacity={0.8}
            >
              <Text style={styles.beginButtonText}>BEGIN FOCUS</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ===== COUNTDOWN PHASE ===== */}
        {phase === 'countdown' && (
          <View style={[styles.countdownContainer, {paddingTop: insets.top}]}>
            <Animated.Text style={[styles.countdownNumber, {transform: [{scale: countdownAnim}]}]}>
              {countdown === 0 ? 'GO' : countdown}
            </Animated.Text>
            <Text style={styles.countdownLabel}>
              {countdown === 0 ? 'FOCUS NOW' : 'GET READY'}
            </Text>
          </View>
        )}

        {/* ===== ACTIVE PHASE ===== */}
        {phase === 'active' && (
          <React.Fragment>
            {/* Keep screen awake during focus mode */}
            <KeepAwake />
            <View style={[styles.content, {paddingTop: insets.top + 80}]}>
              {/* Focus indicator */}
              <View style={styles.focusIndicator}>
                <View style={styles.focusDot} />
                <Text style={styles.focusLabel}>FOCUS MODE</Text>
              </View>

            {/* Timer */}
            <Animated.View style={[styles.timerContainer, {transform: [{scale: pulseAnim}]}]}>
              <Text style={styles.timerText}>{formatTime(displayFocusSeconds)}</Text>
              <Text style={styles.timerLabel}>FOCUSED</Text>
            </Animated.View>

            {/* Distracted time counter */}
            {displayDistractedSeconds > 0 && (
              <View style={styles.distractedTimeContainer}>
                <Text style={styles.distractedTimeText}>{formatTime(displayDistractedSeconds)}</Text>
                <Text style={styles.distractedTimeLabel}>DISTRACTED</Text>
              </View>
            )}

            {/* Focus score */}
            {(displayFocusSeconds > 0 || displayDistractedSeconds > 0) && (
              <View style={styles.focusScoreContainer}>
                <Text style={styles.focusScoreLabel}>FOCUS SCORE</Text>
                <Text style={styles.focusScoreValue}>
                  {Math.round((displayFocusSeconds / Math.max(displayFocusSeconds + displayDistractedSeconds, 1)) * 100)}%
                </Text>
              </View>
            )}

            {/* Task info */}
            <View style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <Target size={14} color={theme.colors.textMuted} />
                <Text style={styles.taskLabel}>
                  {hasRealTask ? 'CURRENT TASK' : 'FOCUS SESSION'}
                </Text>
              </View>
              <Text style={styles.taskTitle}>{displayTask.title}</Text>
              {displayTask.project_name && (
                <Text style={styles.projectName}>{displayTask.project_name}</Text>
              )}
              {getRemainingTime() && (
                <View style={styles.remainingTime}>
                  <Clock size={12} color={theme.colors.textMuted} />
                  <Text style={styles.remainingText}>{getRemainingTime()}</Text>
                </View>
              )}
            </View>

            {/* Motivational text */}
            <Text style={styles.motivationalText}>
              {isPaused ? 'PAUSED' : 'STAY FOCUSED'}
            </Text>

            {/* Controls */}
            <View style={styles.controls}>
              {/* Pause/Resume button */}
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => setIsPaused(!isPaused)}
              >
                {isPaused ? (
                  <Play size={24} color={theme.colors.textPrimary} />
                ) : (
                  <Pause size={24} color={theme.colors.textPrimary} />
                )}
                <Text style={styles.controlLabel}>{isPaused ? 'RESUME' : 'PAUSE'}</Text>
              </TouchableOpacity>

              {/* Complete button (only for real tasks) or End Session */}
              {hasRealTask ? (
                <TouchableOpacity
                  style={[styles.controlButton, styles.primaryButton]}
                  onPress={handleComplete}
                >
                  <CheckCircle2 size={24} color="#000" />
                  <Text style={[styles.controlLabel, styles.primaryLabel]}>COMPLETE</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={handleExitAttempt}
                >
                  <X size={24} color={theme.colors.textPrimary} />
                  <Text style={styles.controlLabel}>END</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          </React.Fragment>
        )}

        {/* Distraction Warning Overlay */}
        {showDistractionWarning && (
          <View style={styles.warningOverlay}>
            <View style={styles.warningCard}>
              <AlertTriangle size={40} color={theme.colors.error} />
              <Text style={styles.warningTitle}>DISTRACTION DETECTED</Text>
              <Text style={styles.warningMessage}>
                You left the app during your focus session.{'\n'}
                Stay focused to be more productive.
              </Text>
              <TouchableOpacity
                style={styles.warningButton}
                onPress={handleDismissWarning}
              >
                <Text style={styles.warningButtonText}>BACK TO FOCUS</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Exit confirmation */}
        {showExitConfirm && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>END FOCUS SESSION?</Text>
              <Text style={styles.confirmMessage}>
                Focused: {formatTime(displayFocusSeconds)}
                {displayDistractedSeconds > 0 && `\nDistracted: ${formatTime(displayDistractedSeconds)}`}
                {(displayFocusSeconds > 0 || displayDistractedSeconds > 0) && `\nFocus Score: ${Math.round((displayFocusSeconds / Math.max(displayFocusSeconds + displayDistractedSeconds, 1)) * 100)}%`}
              </Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={styles.confirmButtonPrimary}
                  onPress={handleCancelExit}
                >
                  <Text style={styles.confirmButtonPrimaryText}>STAY FOCUSED</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButtonSecondary}
                  onPress={handleConfirmExit}
                >
                  <Text style={styles.confirmButtonSecondaryText}>EXIT</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  // ===== INTRO PHASE STYLES =====
  introContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  introContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quoteContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 48,
  },
  quoteText: {
    fontSize: 22,
    fontFamily: theme.typography.fontFamily.regular,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 32,
    fontStyle: 'italic',
  },
  quoteAuthor: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textMuted,
    marginTop: 16,
  },
  introTaskCard: {
    backgroundColor: theme.colors.surfaceElevated,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  introTaskLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textMuted,
    letterSpacing: 2,
    marginBottom: 12,
  },
  introTaskTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semibold,
    color: '#fff',
    textAlign: 'center',
  },
  introProjectName: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  tipContainer: {
    marginTop: 32,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  tipText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  beginButton: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    alignItems: 'center',
  },
  beginButtonText: {
    color: '#000',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 3,
  },
  // ===== COUNTDOWN PHASE STYLES =====
  countdownContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontSize: 160,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  countdownLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textMuted,
    letterSpacing: 4,
    marginTop: 20,
  },
  // ===== ACTIVE PHASE STYLES =====
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  focusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  focusDot: {
    width: 8,
    height: 8,
    backgroundColor: theme.colors.textPrimary,
  },
  focusLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 3,
  },
  timerContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 72,
    fontFamily: theme.typography.fontFamily.regular,
    color: '#fff',
    letterSpacing: -4,
  },
  timerLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.success,
    letterSpacing: 3,
    marginTop: 8,
  },
  distractedTimeContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  distractedTimeText: {
    fontSize: 28,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error,
    letterSpacing: -1,
  },
  distractedTimeLabel: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.error,
    letterSpacing: 2,
    marginTop: 4,
  },
  focusScoreContainer: {
    marginTop: 24,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  focusScoreLabel: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textMuted,
    letterSpacing: 2,
  },
  focusScoreValue: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
    marginTop: 4,
  },
  taskCard: {
    marginTop: 32,
    backgroundColor: theme.colors.surfaceElevated,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  taskLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
  },
  taskTitle: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.semibold,
    color: '#fff',
  },
  projectName: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  remainingTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  remainingText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  motivationalText: {
    marginTop: 40,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textMuted,
    letterSpacing: 4,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
    marginBottom: 40,
    width: '100%',
  },
  controlButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  controlLabel: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
  },
  primaryButton: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  primaryLabel: {
    color: '#000',
  },
  warningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  warningCard: {
    backgroundColor: theme.colors.surfaceElevated,
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
  },
  warningTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.error,
    marginTop: 20,
    letterSpacing: 2,
  },
  warningMessage: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 28,
  },
  warningButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  warningButtonText: {
    color: '#000',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 2,
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    backgroundColor: theme.colors.surfaceElevated,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  confirmTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
    letterSpacing: 2,
  },
  confirmMessage: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 28,
  },
  confirmButtons: {
    width: '100%',
    gap: 12,
  },
  confirmButtonPrimary: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonPrimaryText: {
    color: '#000',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 2,
  },
  confirmButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonSecondaryText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
  },
});
