import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Alert,
  Platform,
  NativeModules,
  ScrollView,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Mic, X, Send, Loader2, Sparkles} from 'lucide-react-native';

// Conditionally import Voice to prevent crashes if native module isn't available
let Voice: any = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch (error) {
  console.warn('Voice module not available:', error);
}
import {theme} from '../theme';
import {executeAICommand, AICommandResult} from '../lib/api';
import {
  prepareIosAudioSessionForRecording,
  restoreIosAudioSessionForPlayback,
} from '../lib/iosAudioSession';
import {useAuth} from '../hooks/useAuth';
import {useTabBar} from '../contexts/TabBarContext';
import {GlassComposerBar} from './GlassComposerBar';

interface VoiceCommandModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When true, automatically starts listening when modal opens (for long-press FAB) */
  autoStartListening?: boolean;
  /** When true, hides voice input and only shows text input (for creation flow) */
  textOnly?: boolean;
}

interface ParsedCommand {
  type: 'todo' | 'event' | 'deliverable' | 'project' | 'unknown';
  title?: string;
  dueDate?: string;
  dueTime?: string;
  priority?: string;
  project?: string;
  description?: string;
}

export function VoiceCommandModal({
  visible,
  onClose,
  onSuccess,
  autoStartListening = false,
  textOnly = false,
}: VoiceCommandModalProps) {
  const {currentWorkspace} = useAuth();
  const {rebindSharedVoiceListeners} = useTabBar();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [parsedCommand, setParsedCommand] = useState<ParsedCommand | null>(null);
  const [commandResult, setCommandResult] = useState<AICommandResult | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  
  // Typing effect state for AI answers
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerScrollRef = useRef<ScrollView>(null);
  const userScrolledRef = useRef(false);

  // Check if Voice module is available
  useEffect(() => {
    const checkVoiceAvailability = async () => {
      if (!Voice) {
        setVoiceAvailable(false);
        return;
      }

      try {
        const VoiceModule = NativeModules.VoiceModule || NativeModules.RNVoice;
        if (VoiceModule && Voice.isAvailable) {
          const available = await Voice.isAvailable();
          setVoiceAvailable(available);
        } else {
          setVoiceAvailable(false);
          console.warn('Voice native module not found - voice commands will use text input only');
        }
      } catch (error) {
        console.warn('Voice module check failed:', error);
        setVoiceAvailable(false);
      }
    };
    
    if (visible) {
      checkVoiceAvailability();
    } else {
      // Reset auto-start flag when modal closes
      setHasAutoStarted(false);
    }
  }, [visible]);

  // Pulse animation for microphone
  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  // Wave animation
  useEffect(() => {
    if (isListening) {
      const wave = Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      wave.start();
      return () => wave.stop();
    }
  }, [isListening, waveAnim]);

  const startListening = useCallback(async () => {
    if (!Voice || !voiceAvailable) {
      Alert.alert(
        'Voice Not Available',
        'Voice recognition is not available. Please use the text input below or install the required native dependencies.',
      );
      return;
    }

    try {
      setTranscript('');
      setShowConfirmation(false);
      setParsedCommand(null);
      setCommandResult(null);
      await prepareIosAudioSessionForRecording();
      await Voice.start('en-US');
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      void restoreIosAudioSessionForPlayback();
      Alert.alert('Error', 'Failed to start voice recognition. Make sure the app has microphone permissions.');
    }
  }, [voiceAvailable]);

  // Auto-start listening when modal opens with autoStartListening prop
  useEffect(() => {
    if (visible && autoStartListening && voiceAvailable && !hasAutoStarted && !isListening) {
      setHasAutoStarted(true);
      // Small delay to ensure modal is fully visible
      const timer = setTimeout(() => {
        startListening();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, autoStartListening, voiceAvailable, hasAutoStarted, isListening, startListening]);

  // Typing effect for AI answers
  useEffect(() => {
    if (commandResult?.success && commandResult?.isAnswer && commandResult?.message) {
      const fullText = commandResult.message;
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
            answerScrollRef.current?.scrollToEnd({animated: false});
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
  }, [commandResult]);

  const stopListening = useCallback(async () => {
    if (!Voice) {
      setIsListening(false);
      return;
    }

    try {
      await Voice.stop();
      setIsListening(false);
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
      setIsListening(false); // Ensure state is updated even if stop fails
    } finally {
      void restoreIosAudioSessionForPlayback();
    }
  }, []);

  const handleProcessCommand = useCallback(async (commandText: string) => {
    if (!commandText.trim() || !currentWorkspace) return;

    setIsProcessing(true);
    try {
      // Parse the command to show preview
      const preview = parseCommandPreview(commandText);
      setParsedCommand(preview);
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error parsing command:', error);
    } finally {
      setIsProcessing(false);
      await stopListening();
    }
  }, [currentWorkspace, stopListening]);

  // While the modal is visible it owns the global Voice singleton callbacks. Never call
  // Voice.destroy() here — that tears down the native engine and breaks FAB / assistant dictation.
  useEffect(() => {
    if (!Voice || !voiceAvailable || !visible) {
      return;
    }

    try {
      Voice.onSpeechStart = () => {
        setIsListening(true);
      };
      Voice.onSpeechEnd = () => {
        setIsListening(false);
      };
      Voice.onSpeechPartialResults = (e: any) => {
        const t = e.value?.[0];
        if (t) setTranscript(t);
      };
      Voice.onSpeechResults = (e: any) => {
        if (e.value && e.value.length > 0) {
          const text = e.value[0];
          setTranscript(text);
          handleProcessCommand(text);
        }
      };
      Voice.onSpeechError = (e: any) => {
        console.error('Speech error:', e);
        setIsListening(false);
        if (e.error?.code !== '7') {
          Alert.alert('Speech Recognition Error', e.error?.message || 'Failed to recognize speech');
        }
      };
    } catch (error) {
      console.warn('Error setting up Voice handlers:', error);
      setVoiceAvailable(false);
    }

    return () => {
      rebindSharedVoiceListeners();
    };
  }, [visible, voiceAvailable, rebindSharedVoiceListeners, handleProcessCommand]);

  const handleConfirm = useCallback(async () => {
    if (!transcript.trim() || !currentWorkspace) return;

    setIsProcessing(true);
    try {
      const result = await executeAICommand(transcript, currentWorkspace.slug || '');
      setCommandResult(result);
      
      // Only auto-close if it's a successful action (not an answer/clarification)
      if (result.success && !result.isAnswer) {
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1500);
      } else if (!result.success) {
        Alert.alert('Error', result.message || 'Failed to execute command');
      }
      // If isAnswer is true, the modal stays open so user can see the message and respond
    } catch (error) {
      console.error('Error executing command:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to execute command',
      );
    } finally {
      setIsProcessing(false);
    }
  }, [transcript, currentWorkspace, onSuccess]);

  const handleClose = useCallback(async () => {
    await stopListening();
    setTranscript('');
    setShowConfirmation(false);
    setParsedCommand(null);
    setCommandResult(null);
    setIsProcessing(false);
    onClose();
  }, [stopListening, onClose]);

  const parseCommandPreview = (text: string): ParsedCommand => {
    const lower = text.toLowerCase();
    let type: ParsedCommand['type'] = 'unknown';
    
    if (lower.includes('todo') || lower.includes('task') || lower.includes('remind me')) {
      type = 'todo';
    } else if (lower.includes('event') || lower.includes('meeting') || lower.includes('calendar')) {
      type = 'event';
    } else if (lower.includes('deliverable') || lower.includes('video') || lower.includes('project')) {
      type = lower.includes('project') ? 'project' : 'deliverable';
    }

    // Extract title (first part before date/time keywords)
    const titleMatch = text.match(/^(?:create|add|make|new|remind me to)\s+(.+?)(?:\s+(?:by|due|at|on|for))|^(.+?)(?:\s+(?:by|due|at|on|for))|^(.+)$/i);
    const title = titleMatch ? (titleMatch[1] || titleMatch[2] || titleMatch[3]).trim() : text;

    // Extract date/time
    const dateMatch = text.match(/(?:by|due|at|on)\s+([^,]+)/i);
    const dueDate = dateMatch ? dateMatch[1].trim() : undefined;

    return {
      type,
      title: title.length > 50 ? title.substring(0, 50) + '...' : title,
      dueDate,
    };
  };

  const waveOpacity = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{textOnly ? 'AI Command' : 'Voice Command'}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {commandResult?.success && commandResult.isAnswer ? (
            // Answer/Clarification state - show message in scrollable container with typing effect
            <View style={styles.answerContainer}>
              <View style={styles.aiIcon}>
                <Sparkles size={28} color={theme.colors.accent} />
              </View>
              
              {/* Scrollable answer container */}
              <View style={styles.answerScrollContainer}>
                <ScrollView 
                  ref={answerScrollRef}
                  style={styles.answerScrollView}
                  contentContainerStyle={styles.answerScrollContent}
                  showsVerticalScrollIndicator={true}
                  indicatorStyle="white"
                  scrollEventThrottle={16}
                  onScrollBeginDrag={() => {
                    userScrolledRef.current = true;
                  }}
                >
                  <Text style={styles.answerText}>
                    {displayedText}
                    {isTyping && <Text style={styles.cursor}>|</Text>}
                  </Text>
                </ScrollView>
              </View>
              
              {/* Input for response and action buttons - only show when typing is complete */}
              {!isTyping && (
                <>
                  <GlassComposerBar style={styles.inputGlassWrap} contentStyle={styles.inputGlassInner}>
                    <TextInput
                      ref={textOnly ? inputRef : undefined}
                      style={styles.input}
                      placeholder={textOnly ? "Type your response..." : "Or type your response here..."}
                      placeholderTextColor={theme.colors.textMuted}
                      value={transcript}
                      onChangeText={setTranscript}
                      multiline
                      editable={!isListening && !isProcessing}
                      autoFocus={textOnly}
                    />
                    {transcript.trim() && !isListening && (
                      <TouchableOpacity
                        style={styles.sendButton}
                        onPress={async () => {
                          if (!transcript.trim() || !currentWorkspace) return;
                          const responseText = transcript.trim();
                          setTranscript('');
                          setCommandResult(null);
                          setIsProcessing(true);
                          try {
                            const result = await executeAICommand(responseText, currentWorkspace.slug || '');
                            setCommandResult(result);
                            if (result.success && !result.isAnswer) {
                              setTimeout(() => {
                                onSuccess();
                                handleClose();
                              }, 1500);
                            }
                          } catch (error) {
                            console.error('Error executing command:', error);
                            Alert.alert(
                              'Error',
                              error instanceof Error ? error.message : 'Failed to execute command',
                            );
                          } finally {
                            setIsProcessing(false);
                          }
                        }}>
                        <Send size={20} color={theme.colors.accentText} />
                      </TouchableOpacity>
                    )}
                  </GlassComposerBar>

                  <View style={styles.answerActions}>
                    {!textOnly && voiceAvailable && (
                      <>
                        {isListening ? (
                          <TouchableOpacity
                            style={[styles.actionButton, styles.stopButton]}
                            onPress={stopListening}>
                            <Text style={styles.actionButtonText}>STOP</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={[styles.actionButton, styles.listenButton]}
                            onPress={startListening}
                            disabled={isProcessing}>
                            <Mic size={20} color={theme.colors.accentText} />
                            <Text style={styles.actionButtonText}>SPEAK</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    <TouchableOpacity
                      style={[styles.actionButton, styles.dismissButton]}
                      onPress={handleClose}>
                      <Text style={styles.dismissButtonText}>DISMISS</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ) : commandResult?.success ? (
            // Success state (completed action)
            <View style={styles.successContainer}>
              <View style={styles.aiIcon}>
                <Sparkles size={32} color={theme.colors.accent} />
              </View>
              <Text style={styles.successMessage}>{commandResult.message}</Text>
            </View>
          ) : showConfirmation && parsedCommand ? (
            // Confirmation state
            <View style={styles.confirmationContainer}>
              <Text style={styles.confirmationLabel}>READY TO CREATE</Text>
              <Text style={styles.confirmationQuestion}>Does this{'\n'}look good?</Text>
              
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>COMMAND</Text>
                  <Text style={styles.summaryValue}>{transcript}</Text>
                </View>
                {parsedCommand.title && (
                  <>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>TITLE</Text>
                      <Text style={styles.summaryValue}>{parsedCommand.title}</Text>
                    </View>
                  </>
                )}
                {parsedCommand.dueDate && (
                  <>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>DUE</Text>
                      <Text style={styles.summaryValue}>{parsedCommand.dueDate}</Text>
                    </View>
                  </>
                )}
              </View>

              <View style={styles.confirmationActions}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() => {
                    setShowConfirmation(false);
                    setTranscript('');
                    startListening();
                  }}>
                  <Text style={styles.buttonSecondaryText}>TRY AGAIN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={handleConfirm}
                  disabled={isProcessing}>
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={theme.colors.accentText} />
                  ) : (
                    <Text style={styles.buttonPrimaryText}>CREATE</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Listening/Input state
            <View style={styles.listeningContainer}>
              {/* Microphone animation - only show for voice mode */}
              {!textOnly && (
              <View style={styles.micContainer}>
                <Animated.View
                  style={[
                    styles.micCircle,
                    {
                      transform: [{scale: pulseAnim}],
                      opacity: isListening ? waveOpacity : 0.3,
                    },
                  ]}
                />
                <View style={styles.micInner}>
                  {isListening ? (
                    <Loader2 size={48} color={theme.colors.accent} />
                  ) : (
                    <Mic size={48} color={theme.colors.accent} />
                  )}
                </View>
              </View>
              )}

              <Text style={styles.statusText}>
                {textOnly
                  ? 'Type your command below'
                  : isListening
                  ? 'Listening...'
                  : isProcessing
                  ? 'Thinking...'
                  : voiceAvailable
                  ? 'Tap to speak or type your command'
                  : 'Type your command (voice recognition requires pod install)'}
              </Text>

              {/* Transcript/Input */}
              <GlassComposerBar style={styles.inputGlassWrap} contentStyle={styles.inputGlassInner}>
                <TextInput
                  ref={textOnly ? inputRef : undefined}
                  style={styles.input}
                  placeholder={textOnly ? "e.g., Remind me to call client tomorrow at 3pm" : "Or type your command here..."}
                  placeholderTextColor={theme.colors.textMuted}
                  value={transcript}
                  onChangeText={setTranscript}
                  multiline
                  editable={!isListening && !isProcessing}
                  autoFocus={textOnly}
                />
                {transcript.trim() && !isListening && (
                  <TouchableOpacity
                    style={styles.sendButton}
                    onPress={() => handleProcessCommand(transcript)}>
                    <Send size={20} color={theme.colors.accentText} />
                  </TouchableOpacity>
                )}
              </GlassComposerBar>

              {/* Action buttons - only show for voice mode */}
              {!textOnly && (
              <View style={styles.actions}>
                {isListening ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.stopButton]}
                    onPress={stopListening}>
                    <Text style={styles.actionButtonText}>STOP</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.listenButton,
                      !voiceAvailable && styles.actionButtonDisabled,
                    ]}
                    onPress={startListening}
                    disabled={isProcessing || !voiceAvailable}>
                    <Mic size={20} color={theme.colors.accentText} />
                    <Text style={styles.actionButtonText}>START</Text>
                  </TouchableOpacity>
                )}
              </View>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceBorder,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  listeningContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  micContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  micCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.accent + '20',
    borderWidth: 2,
    borderColor: theme.colors.accent + '40',
  },
  micInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.accentBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.md,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  inputGlassWrap: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  inputGlassInner: {
    alignItems: 'flex-end',
    minHeight: 50,
  },
  input: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    maxHeight: 100,
  },
  sendButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    minWidth: 120,
  },
  listenButton: {
    backgroundColor: theme.colors.accentBackground,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  stopButton: {
    backgroundColor: theme.colors.errorBackground,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  actionButtonText: {
    color: theme.colors.accentText,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 1,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  confirmationContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  confirmationLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginBottom: theme.spacing.md,
  },
  confirmationQuestion: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    fontFamily: theme.typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  summaryRow: {
    paddingVertical: theme.spacing.sm,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginBottom: 4,
  },
  summaryValue: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
  },
  confirmationActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.accentBackground,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  buttonPrimaryText: {
    color: theme.colors.accentText,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 3,
  },
  buttonSecondaryText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 3,
  },
  successContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  aiIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  successMessage: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  answerContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  answerScrollContainer: {
    width: '100%',
    minHeight: 80,
    maxHeight: Dimensions.get('window').height * 0.4,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    marginBottom: theme.spacing.lg,
  },
  answerScrollView: {
    flexGrow: 1,
  },
  answerScrollContent: {
    padding: theme.spacing.lg,
    flexGrow: 1,
  },
  answerText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    textAlign: 'left',
    lineHeight: 26,
  },
  cursor: {
    color: theme.colors.accent,
    fontWeight: '100',
  },
  answerActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  dismissButton: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  dismissButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 1,
  },
});

