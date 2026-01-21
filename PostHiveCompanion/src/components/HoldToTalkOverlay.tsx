import React, {useEffect, useRef, useCallback, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  Easing,
} from 'react-native';
import {Mic, X, Sparkles} from 'lucide-react-native';

// AI-style animated loader with pulsing dots
function AILoader() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const scale3 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const createPulse = (opacity: Animated.Value, scale: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 1,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1.3,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 0.3,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    };

    const anim1 = createPulse(dot1, scale1, 0);
    const anim2 = createPulse(dot2, scale2, 150);
    const anim3 = createPulse(dot3, scale3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3, scale1, scale2, scale3]);

  return (
    <View style={aiLoaderStyles.container}>
      <Animated.View style={[aiLoaderStyles.dot, {opacity: dot1, transform: [{scale: scale1}]}]} />
      <Animated.View style={[aiLoaderStyles.dot, {opacity: dot2, transform: [{scale: scale2}]}]} />
      <Animated.View style={[aiLoaderStyles.dot, {opacity: dot3, transform: [{scale: scale3}]}]} />
    </View>
  );
}

const aiLoaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
});
import {theme} from '../theme';
import {useTabBar} from '../contexts/TabBarContext';
import {useAuth} from '../hooks/useAuth';
import {executeAICommand} from '../lib/api';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export function HoldToTalkOverlay() {
  const {currentWorkspace} = useAuth();
  const {
    voiceState,
    setProcessing,
    setResult,
    resetVoice,
  } = useTabBar();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const handleConfirmRef = useRef<(() => void) | null>(null);
  
  // Typing effect state for AI answers
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const userScrolledRef = useRef(false);

  // Fade in/out animation
  useEffect(() => {
    const shouldShow = voiceState.isListening || voiceState.isProcessing || voiceState.result || voiceState.aborted;
    Animated.timing(fadeAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [voiceState.isListening, voiceState.isProcessing, voiceState.result, voiceState.aborted, fadeAnim]);

  // Pulse animation while listening
  useEffect(() => {
    if (voiceState.isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [voiceState.isListening, pulseAnim]);

  // Execute command immediately when listening stops and we have transcript
  useEffect(() => {
    if (!voiceState.isListening && voiceState.transcript && !voiceState.isProcessing && !voiceState.result && !voiceState.aborted) {
      // Skip confirmation - execute immediately
      handleConfirmRef.current?.();
    }
  }, [voiceState.isListening, voiceState.transcript, voiceState.isProcessing, voiceState.result, voiceState.aborted]);

  // Handle aborted state - just reset
  useEffect(() => {
    if (voiceState.aborted) {
      const timer = setTimeout(() => {
        resetVoice();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [voiceState.aborted, resetVoice]);

  // Typing effect for AI answers
  useEffect(() => {
    if (voiceState.result?.success && voiceState.result?.isAnswer && voiceState.result?.message) {
      const fullText = voiceState.result.message;
      setDisplayedText('');
      setIsTyping(true);
      userScrolledRef.current = false; // Reset user scroll tracking
      
      let currentIndex = 0;
      const typingSpeed = 8; // ms per character (faster)
      
      typingIntervalRef.current = setInterval(() => {
        if (currentIndex < fullText.length) {
          setDisplayedText(fullText.slice(0, currentIndex + 1));
          currentIndex++;
          // Only auto-scroll if user hasn't manually scrolled
          if (!userScrolledRef.current) {
            scrollViewRef.current?.scrollToEnd({animated: false});
          }
        } else {
          // Finished typing
          setIsTyping(false);
          if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
          }
        }
      }, typingSpeed);
      
      return () => {
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
      };
    } else {
      // Reset when not showing an answer
      setDisplayedText('');
      setIsTyping(false);
    }
  }, [voiceState.result]);

  const handleConfirm = useCallback(async () => {
    if (!voiceState.transcript.trim() || !currentWorkspace) return;

    setProcessing(true);
    
    try {
      const result = await executeAICommand(voiceState.transcript, currentWorkspace.slug || '');
      setResult(result);
      
      // Only auto-close if it's a successful action (not an answer/clarification)
      if (result.success && !result.isAnswer) {
        setTimeout(() => {
          resetVoice();
        }, 1500);
      }
      // If isAnswer is true, the overlay stays open so user can see the message and respond
    } catch (error) {
      console.error('AI command error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process command';
      setResult({
        success: false, 
        message: errorMessage
      });
    } finally {
      setProcessing(false);
    }
  }, [voiceState.transcript, currentWorkspace, setProcessing, setResult, resetVoice]);

  // Keep ref updated with latest handleConfirm
  useEffect(() => {
    handleConfirmRef.current = handleConfirm;
  }, [handleConfirm]);

  const handleCancel = useCallback(() => {
    resetVoice();
  }, [resetVoice]);

  // Don't render if nothing to show
  if (!voiceState.isListening && !voiceState.isProcessing && !voiceState.result && !voiceState.aborted) {
    return null;
  }

  return (
    <Animated.View style={[styles.overlay, {opacity: fadeAnim}]} pointerEvents="box-none">
      <View style={styles.container}>
        {/* Listening State */}
        {voiceState.isListening && (
          <View style={styles.listeningContainer}>
            <Text style={styles.swipeHint}>↑ SLIDE UP TO CANCEL</Text>
            <Animated.View style={[styles.micCircle, {transform: [{scale: pulseAnim}]}]}>
              <Mic size={32} color="#FFFFFF" />
            </Animated.View>
            <Text style={styles.transcript}>
              {voiceState.transcript || 'Listening...'}
            </Text>
            <Text style={styles.releaseHint}>Release to send</Text>
          </View>
        )}

        {/* Aborted State */}
        {voiceState.aborted && (
          <View style={styles.abortedContainer}>
            <X size={32} color={theme.colors.textMuted} />
            <Text style={styles.abortedText}>Cancelled</Text>
          </View>
        )}

        {/* Processing State */}
        {voiceState.isProcessing && (
          <View style={styles.processingContainer}>
            <View style={styles.aiLoaderWrapper}>
              <Sparkles size={24} color="rgba(255, 255, 255, 0.6)" style={{marginBottom: 12}} />
              <AILoader />
            </View>
            <Text style={styles.processingLabel}>Thinking...</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Result State */}
        {voiceState.result && (
          <View style={styles.resultContainer}>
            {voiceState.result.success && voiceState.result.isAnswer ? (
              // Clarification/Answer state - show message in scrollable container with typing effect
              <>
                <View style={styles.aiIcon}>
                  <Sparkles size={28} color={theme.colors.accent} />
                </View>
                <View style={styles.answerScrollContainer}>
                  <ScrollView 
                    ref={scrollViewRef}
                    style={styles.answerScrollView}
                    contentContainerStyle={styles.answerScrollContent}
                    showsVerticalScrollIndicator={true}
                    indicatorStyle="white"
                    scrollEventThrottle={16}
                    onScrollBeginDrag={() => {
                      userScrolledRef.current = true;
                    }}
                  >
                    <Text style={styles.answerMessage}>
                      {displayedText}
                      {isTyping && <Text style={styles.cursor}>|</Text>}
                    </Text>
                  </ScrollView>
                </View>
                {isTyping ? (
                  <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <Text style={styles.hintText}>Hold to respond</Text>
                    <TouchableOpacity style={styles.dismissButton} onPress={handleCancel}>
                      <Text style={styles.dismissText}>DISMISS</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            ) : voiceState.result.success ? (
              // Success state - show AI icon (auto-closes, but allow dismiss)
              <>
                <View style={styles.aiIcon}>
                  <Sparkles size={28} color={theme.colors.accent} />
                </View>
                <Text style={styles.resultMessage}>{voiceState.result.message}</Text>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                  <Text style={styles.cancelText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Error state
              <>
                <View style={[styles.resultIcon, styles.errorIcon]}>
                  <X size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.resultLabel}>FAILED</Text>
                <Text style={styles.resultMessage}>{voiceState.result.message}</Text>
                <TouchableOpacity style={styles.dismissButton} onPress={handleCancel}>
                  <Text style={styles.dismissText}>DISMISS</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    width: SCREEN_WIDTH - 64,
    maxWidth: 320,
    alignItems: 'center',
  },
  // Listening
  listeningContainer: {
    alignItems: 'center',
  },
  swipeHint: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginBottom: theme.spacing.xl,
    opacity: 0.6,
  },
  micCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  transcript: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'center',
    lineHeight: 28,
    minHeight: 56,
  },
  releaseHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    marginTop: theme.spacing.lg,
    opacity: 0.5,
  },
  // Aborted
  abortedContainer: {
    alignItems: 'center',
    opacity: 0.6,
  },
  abortedText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    marginTop: theme.spacing.sm,
  },
  // Processing
  processingContainer: {
    alignItems: 'center',
  },
  aiLoaderWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    marginTop: theme.spacing.sm,
  },
  // Result
  resultContainer: {
    alignItems: 'center',
    width: '100%',
  },
  resultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  aiIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  errorIcon: {
    backgroundColor: theme.colors.error,
  },
  resultLabel: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: theme.spacing.sm,
  },
  resultMessage: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 24,
  },
  answerScrollContainer: {
    width: '100%',
    minHeight: 100,
    maxHeight: Dimensions.get('window').height * 0.5,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: theme.spacing.md,
  },
  answerScrollView: {
    flexGrow: 1,
  },
  answerScrollContent: {
    padding: theme.spacing.lg,
    flexGrow: 1,
  },
  answerMessage: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'left',
    lineHeight: 28,
  },
  cursor: {
    color: theme.colors.accent,
    fontWeight: '100',
  },
  hintText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  dismissButton: {
    marginTop: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  dismissText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 2,
  },
  cancelButton: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  cancelText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
  },
});




