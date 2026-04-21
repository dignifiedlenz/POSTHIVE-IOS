import React, {useState, useCallback, useRef, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Mic, Send, RotateCcw} from 'lucide-react-native';

/** Same constant the floating create FAB uses to clear the native tab bar. */
const TAB_BAR_CLEARANCE = Platform.OS === 'ios' ? 54 : 56;
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {executeAICommand, type AICommandTurn} from '../../lib/api';
import {GlassComposerBar} from '../../components/GlassComposerBar';
import {AppleNativeGlassIconButton} from '../../components/native/AppleNativeGlassIconButton';
import {MarkdownText} from '../../components/MarkdownText';

let Voice: any = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch {
  /* optional native module */
}

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

const ROTATING_HINTS = [
  'Ask anything…',
  'What\'s due this week?',
  'Will it rain tomorrow?',
  'When am I free Monday afternoon?',
  'Remind me to review the wedding video tomorrow',
];

const MAX_PRIOR_TURNS = 16;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AssistantChatScreen() {
  const {currentWorkspace} = useAuth();
  const insets = useSafeAreaInsets();
  const bottomClearance =
    Math.max(insets.bottom, 8) + TAB_BAR_CLEARANCE + theme.spacing.sm;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(!!Voice);
  const [hintIndex, setHintIndex] = useState(0);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const submitRef = useRef<(text: string) => Promise<void>>(async () => {});
  const busyRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Cycle through placeholder hints in the empty state.
  useEffect(() => {
    if (messages.length > 0) return;
    const id = setInterval(() => {
      setHintIndex(i => (i + 1) % ROTATING_HINTS.length);
    }, 3500);
    return () => clearInterval(id);
  }, [messages.length]);

  const submit = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;
      if (!currentWorkspace?.slug) {
        Alert.alert('Workspace', 'Select a workspace to run commands.');
        return;
      }

      const priorConversation: AICommandTurn[] = messagesRef.current
        .slice(-MAX_PRIOR_TURNS)
        .map(m => ({role: m.role, content: m.text}));

      setMessages(prev => [...prev, {id: newId(), role: 'user', text}]);
      setInput('');
      busyRef.current = true;
      setSending(true);
      try {
        const result = await executeAICommand(text, currentWorkspace.slug, {
          priorConversation,
        });
        setMessages(prev => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            text:
              result.message ||
              (result.success ? 'Done.' : 'Something went wrong.'),
          },
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        setMessages(prev => [...prev, {id: newId(), role: 'assistant', text: msg}]);
      } finally {
        busyRef.current = false;
        setSending(false);
      }
    },
    [currentWorkspace?.slug],
  );

  submitRef.current = submit;

  useEffect(() => {
    if (!Voice) return;

    try {
      Voice.onSpeechStart = () => setIsListening(true);
      Voice.onSpeechEnd = () => setIsListening(false);
      Voice.onSpeechResults = (e: {value?: string[]}) => {
        const t = e.value?.[0]?.trim();
        setIsListening(false);
        if (t) void submitRef.current(t);
      };
      Voice.onSpeechError = (e: {error?: {code?: string; message?: string}}) => {
        setIsListening(false);
        if (e.error?.code !== '7') {
          Alert.alert('Voice', e.error?.message || 'Speech recognition failed');
        }
      };
    } catch {
      setVoiceOk(false);
    }

    return () => {
      try {
        Voice?.destroy?.().then(() => Voice?.removeAllListeners?.()).catch(() => {});
      } catch {
        /* ignore */
      }
    };
  }, []);

  const toggleMic = useCallback(async () => {
    if (!Voice || !voiceOk) {
      Alert.alert('Voice', 'Voice recognition is not available on this build.');
      return;
    }
    if (isListening) {
      try {
        await Voice.stop();
      } catch {
        /* ignore */
      }
      setIsListening(false);
      return;
    }
    try {
      await Voice.start('en-US');
    } catch (err) {
      console.error(err);
      Alert.alert('Voice', 'Could not start listening. Check microphone permission.');
    }
  }, [isListening, voiceOk]);

  const resetChat = useCallback(() => {
    if (busyRef.current) return;
    setMessages([]);
    setInput('');
  }, []);

  const renderMessage = useCallback(({item}: {item: ChatMessage}) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.bubbleWrap,
          isUser ? styles.bubbleWrapUser : styles.bubbleWrapAssistant,
        ]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          {isUser ? (
            <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{item.text}</Text>
          ) : (
            <MarkdownText style={styles.bubbleText}>{item.text}</MarkdownText>
          )}
        </View>
      </View>
    );
  }, []);

  const hasMessages = messages.length > 0;
  const placeholder = useMemo(
    () => (hasMessages ? 'Ask a follow-up…' : ROTATING_HINTS[hintIndex]),
    [hasMessages, hintIndex],
  );

  const composer = (
    <GlassComposerBar borderRadius={22} contentStyle={styles.composerInner}>
      <AppleNativeGlassIconButton
        systemImage="mic.fill"
        prominent={false}
        active={isListening}
        enabled={voiceOk && !sending}
        onPress={toggleMic}
        accessibilityLabel={isListening ? 'Stop listening' : 'Speak command'}
        fallbackIcon={Mic}
        fallbackIconColor={
          isListening ? theme.colors.textInverse : theme.colors.textPrimary
        }
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        value={input}
        onChangeText={setInput}
        multiline
        maxLength={4000}
        editable={!sending}
        onSubmitEditing={() => void submit(input)}
        blurOnSubmit={false}
        returnKeyType="send"
      />
      <AppleNativeGlassIconButton
        systemImage="paperplane.fill"
        prominent
        enabled={!!input.trim() && !sending}
        onPress={() => void submit(input)}
        accessibilityLabel="Send"
        fallbackIcon={Send}
        fallbackIconColor={
          input.trim() && !sending
            ? theme.colors.textPrimary
            : theme.colors.textMuted
        }
      />
    </GlassComposerBar>
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={
          Platform.OS === 'ios' ? bottomClearance : 0
        }>
        {hasMessages ? (
          <>
            <View style={styles.chatHeader} pointerEvents="box-none">
              <View style={styles.chatHeaderSpacer} />
              <TouchableOpacity
                onPress={resetChat}
                disabled={sending}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                style={[styles.resetBtn, sending && styles.resetBtnDisabled]}
                accessibilityLabel="New chat">
                <RotateCcw size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => m.id}
              renderItem={renderMessage}
              contentContainerStyle={[
                styles.listContent,
                {paddingBottom: theme.spacing.md},
              ]}
              onContentSizeChange={() =>
                listRef.current?.scrollToEnd({animated: true})
              }
              ListFooterComponent={
                sending ? (
                  <View style={styles.thinkingRow}>
                    <ActivityIndicator size="small" color={theme.colors.textMuted} />
                    <Text style={styles.thinkingText}>Thinking…</Text>
                  </View>
                ) : null
              }
            />

            <View
              style={[
                styles.composerPad,
                {paddingBottom: bottomClearance},
              ]}>
              {composer}
            </View>
          </>
        ) : (
          <View style={[styles.emptyWrap, {paddingBottom: bottomClearance}]}>
            <View style={styles.emptyCenter}>
              <View style={styles.emptyComposer}>{composer}</View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  chatHeaderSpacer: {flex: 1},
  resetBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  resetBtnDisabled: {
    opacity: 0.4,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
    flexGrow: 1,
  },
  bubbleWrap: {
    marginBottom: theme.spacing.sm,
  },
  bubbleWrapUser: {
    alignItems: 'flex-end',
  },
  bubbleWrapAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '88%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bubbleAssistant: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bubbleText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: theme.colors.textPrimary,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  thinkingText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
  },
  composerPad: {
    paddingHorizontal: theme.spacing.md,
  },
  composerInner: {
    alignItems: 'flex-end',
    minHeight: 48,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginLeft: 8,
  },
  emptyWrap: {
    flex: 1,
  },
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  emptyComposer: {
    width: '100%',
  },
});
