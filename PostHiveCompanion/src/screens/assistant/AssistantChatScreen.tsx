import React, {useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {Mic, RotateCcw} from 'lucide-react-native';

/** Same constant the floating create FAB uses to clear the native tab bar. */
const TAB_BAR_CLEARANCE = Platform.OS === 'ios' ? 54 : 56;
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {
  executeAICommand,
  getWorkspaceMembers,
  type AICommandTurn,
  type AICommandData,
  type AILastCreatedItem,
} from '../../lib/api';
import type {WorkspaceMember} from '../../lib/types';
import {
  getActiveMention,
  filterMembersForMentionQuery,
  extractResolvedMentions,
} from '../../lib/assistantMentions';
import {MarkdownText} from '../../components/MarkdownText';
import {AssistantResultCard} from '../../components/AssistantResultCard';
import {AssistantEventInline} from '../../components/AssistantEventInline';
import {AssistantTodoInline} from '../../components/AssistantTodoInline';
import {WebSearchInline} from '../../components/WebSearchInline';
import {AssistantMentionPicker} from '../../components/AssistantMentionPicker';
import {useTabBar} from '../../contexts/TabBarContext';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Structured tool result payload (when the assistant turn came from a tool call). */
  data?: AICommandData;
  /** True when the API explicitly flagged this as a direct answer rather than a tool action. */
  isAnswer?: boolean;
}

const ROTATING_HINTS = [
  'Ask anything…',
  'What\'s due this week?',
  'Will it rain tomorrow?',
  'When am I free Monday afternoon?',
  'Remind me to review the wedding video tomorrow',
  'Remind @teammate to follow up…',
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
  const {
    voiceState,
    voiceAvailable,
    startVoiceCapture,
    stopVoiceCapture,
    pendingVoiceCommand,
    consumePendingVoiceCommand,
  } = useTabBar();
  const isListening = voiceState.isListening;
  const prevListeningRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const submitRef = useRef<(text: string) => Promise<void>>(async () => {});
  const busyRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  // Last item the assistant created in this chat session. Sent on subsequent requests so
  // follow-up corrections like "actually it's between 4 and 6pm" can route to update_*.
  const lastCreatedRef = useRef<AILastCreatedItem | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  /** Cursor end position in the composer (for @mention detection). */
  const [cursorPos, setCursorPos] = useState(0);
  /** After "Done" on mention menu, hide until the user changes the text length. */
  const [mentionDismissedAtLen, setMentionDismissedAtLen] = useState<number | null>(null);

  const userTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!currentWorkspace?.id) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    getWorkspaceMembers(currentWorkspace.id)
      .then(rows => {
        if (!cancelled) setMembers(rows);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id]);

  const {showMentionPicker, filteredMentionMembers} = useMemo(() => {
    if (isListening || !currentWorkspace?.id || members.length === 0) {
      return {showMentionPicker: false, filteredMentionMembers: [] as WorkspaceMember[]};
    }
    const active = getActiveMention(input, cursorPos);
    if (!active) {
      return {showMentionPicker: false, filteredMentionMembers: [] as WorkspaceMember[]};
    }
    if (mentionDismissedAtLen !== null && mentionDismissedAtLen === input.length) {
      return {showMentionPicker: false, filteredMentionMembers: [] as WorkspaceMember[]};
    }
    const filtered = active.query.trim()
      ? filterMembersForMentionQuery(members, active.query)
      : [...members].sort((a, b) => (a.name || '').localeCompare(b.name || '')).slice(0, 24);
    return {
      showMentionPicker: filtered.length > 0,
      filteredMentionMembers: filtered,
    };
  }, [
    input,
    cursorPos,
    members,
    isListening,
    currentWorkspace?.id,
    mentionDismissedAtLen,
  ]);

  const insertMention = useCallback(
    (m: WorkspaceMember) => {
      const active = getActiveMention(input, cursorPos);
      if (!active) return;
      const {start, query} = active;
      const before = input.slice(0, start);
      const after = input.slice(start + 1 + query.length);
      const name = (m.name || '').trim();
      if (!name) return;
      const next = `${before}@${name} ${after}`;
      const pos = before.length + 1 + name.length + 1;
      setInput(next);
      setCursorPos(pos);
      setMentionDismissedAtLen(null);
      requestAnimationFrame(() => {
        const ref = inputRef.current as TextInput & {setSelection?: (s: number, e: number) => void};
        ref?.setSelection?.(pos, pos);
      });
    },
    [input, cursorPos],
  );

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
        const mentionAssignments = extractResolvedMentions(text, members);

        const result = await executeAICommand(text, currentWorkspace.slug, {
          priorConversation,
          lastCreatedItem: lastCreatedRef.current,
          userTimeZone,
          mentionAssignments: mentionAssignments.length ? mentionAssignments : undefined,
        });

        // Track newly-created items so follow-ups can correct them in-place.
        const data = result.data;
        if (data && typeof data === 'object') {
          const dType = (data as any).type;
          // We treat a created/updated event/todo/deliverable/project as the new "last item".
          if (dType === 'event' && (data as any).eventId) {
            lastCreatedRef.current = {
              type: 'event',
              eventId: (data as any).eventId,
              id: (data as any).eventId,
              name: (data as any).title,
            };
          } else if (dType === 'todo' && (data as any).id) {
            lastCreatedRef.current = {
              type: 'todo',
              id: (data as any).id,
              name: (data as any).title || (data as any).name,
            };
          } else if (dType === 'deliverable' && (data as any).id) {
            lastCreatedRef.current = {
              type: 'deliverable',
              id: (data as any).id,
              name: (data as any).name,
            };
          } else if (dType === 'project' && (data as any).id) {
            lastCreatedRef.current = {
              type: 'project',
              id: (data as any).id,
              name: (data as any).name,
            };
          }
        }

        setMessages(prev => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            text:
              result.message ||
              (result.success ? 'Done.' : 'Something went wrong.'),
            data: result.data,
            isAnswer: result.isAnswer,
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
    [currentWorkspace?.slug, userTimeZone, members],
  );

  submitRef.current = submit;

  // After release, copy the final transcript into `input` before paint so the field doesn't
  // flash empty while we wait for `pendingVoiceCommand` → `submit`.
  useLayoutEffect(() => {
    const was = prevListeningRef.current;
    prevListeningRef.current = isListening;
    if (was && !isListening && !voiceState.aborted && voiceState.transcript.trim()) {
      setInput(voiceState.transcript.trim());
    }
  }, [isListening, voiceState.aborted, voiceState.transcript]);

  const composerValue = isListening ? voiceState.transcript : input;

  // Auto-submit any committed voice transcript routed to the assistant — whether it came from
  // the assistant's own mic button or from the global FAB.
  useEffect(() => {
    if (!pendingVoiceCommand) return;
    const text = pendingVoiceCommand.text;
    consumePendingVoiceCommand();
    void submitRef.current(text);
  }, [pendingVoiceCommand, consumePendingVoiceCommand]);

  const startListening = useCallback(async () => {
    if (sending) return;
    await startVoiceCapture();
  }, [sending, startVoiceCapture]);

  const stopListening = useCallback(async () => {
    await stopVoiceCapture();
  }, [stopVoiceCapture]);

  const resetChat = useCallback(() => {
    if (busyRef.current) return;
    setMessages([]);
    setInput('');
    lastCreatedRef.current = null;
  }, []);

  const renderMessage = useCallback(({item}: {item: ChatMessage}) => {
    const isUser = item.role === 'user';
    // Assistant turns that carry structured tool-result data render as a rich card outside the
    // bubble chrome. Plain answers / fallbacks keep the existing bubble + markdown.
    const cardType =
      !isUser && item.data && typeof item.data === 'object'
        ? ((item.data as any).type as string | undefined)
        : undefined;
    const isWebSearch = cardType === 'web_search';
    const isEvent = cardType === 'event';
    const isTodo = cardType === 'todo';
    const todoTitleRaw =
      item.data && typeof item.data === 'object'
        ? String((item.data as any).title || (item.data as any).name || '').trim()
        : '';
    const hasTodoTile = isTodo && !!todoTitleRaw;
    const hasRichCard =
      !!cardType && !isWebSearch && !isEvent && !hasTodoTile;

    if (isEvent && item.data) {
      return (
        <View
          style={[
            styles.bubbleWrap,
            styles.bubbleWrapAssistant,
          ]}>
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <AssistantEventInline message={item.text} data={item.data} />
          </View>
        </View>
      );
    }

    if (hasTodoTile && item.data) {
      return (
        <View style={[styles.bubbleWrap, styles.bubbleWrapAssistant]}>
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <AssistantTodoInline
              data={item.data}
              onQuickAction={cmd => void submit(cmd)}
              quickActionsDisabled={sending}
            />
          </View>
        </View>
      );
    }

    if (hasRichCard) {
      return (
        <View style={[styles.bubbleWrap, styles.bubbleWrapAssistant, styles.cardWrap]}>
          <AssistantResultCard message={item.text} data={item.data} />
        </View>
      );
    }

    return (
      <View
        style={[
          styles.bubbleWrap,
          isUser ? styles.bubbleWrapUser : styles.bubbleWrapAssistant,
        ]}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
            !isUser && isWebSearch && styles.bubbleWebSearch,
          ]}>
          {isUser ? (
            <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{item.text}</Text>
          ) : isWebSearch ? (
            <WebSearchInline
              message={item.text}
              results={(item.data as any)?.results}
            />
          ) : (
            <MarkdownText style={styles.bubbleText}>{item.text}</MarkdownText>
          )}
        </View>
      </View>
    );
  }, [submit, sending]);

  const hasMessages = messages.length > 0;
  const placeholder = useMemo(
    () => (hasMessages ? 'Ask a follow-up…' : ROTATING_HINTS[hintIndex]),
    [hasMessages, hintIndex],
  );

  const composerChildren = (
    <>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        value={composerValue}
        onChangeText={t => {
          if (!isListening) {
            setInput(t);
            setMentionDismissedAtLen(prev =>
              prev !== null && t.length !== prev ? null : prev,
            );
          }
        }}
        onSelectionChange={e => {
          if (!isListening) setCursorPos(e.nativeEvent.selection.end);
        }}
        maxLength={4000}
        editable={!sending && !isListening}
        onSubmitEditing={() => void submit(input)}
        blurOnSubmit={false}
        returnKeyType="send"
        enablesReturnKeyAutomatically
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isListening ? 'Release to send voice' : 'Hold to speak'}
        disabled={!voiceAvailable || sending}
        onPressIn={() => void startListening()}
        onPressOut={() => void stopListening()}
        delayLongPress={120}
        hitSlop={6}
        style={({pressed}) => [
          styles.micBtn,
          pressed && styles.micBtnPressed,
          isListening && styles.micBtnActive,
          (!voiceAvailable || sending) && styles.micBtnDisabled,
        ]}>
        <Mic
          size={20}
          color={
            isListening
              ? theme.colors.textInverse ?? '#000'
              : theme.colors.textPrimary
          }
        />
      </Pressable>
    </>
  );

  // Flat composer: no surrounding bubble — just a row framed by horizontal
  // gradient hairlines that fade to transparent on either side. The empty
  // state shows hairlines above AND below (so the centered row feels framed
  // in open space); the chat state shows only the top hairline (separator
  // from the message list above).
  const renderFlatComposer = (framed: boolean) => (
    <View style={styles.composerStack}>
      <AssistantMentionPicker
        visible={showMentionPicker}
        members={filteredMentionMembers}
        onPick={insertMention}
        onDismiss={() => setMentionDismissedAtLen(input.length)}
      />
      <View style={styles.flatComposer}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          start={{x: 0, y: 0.5}}
          end={{x: 1, y: 0.5}}
          style={styles.flatDivider}
          pointerEvents="none"
        />
        <View style={styles.flatRow}>{composerChildren}</View>
        {framed ? (
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
            start={{x: 0, y: 0.5}}
            end={{x: 1, y: 0.5}}
            style={styles.flatDivider}
            pointerEvents="none"
          />
        ) : null}
      </View>
    </View>
  );

  const flatComposer = renderFlatComposer(false);
  const centeredFlatComposer = renderFlatComposer(true);

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
                styles.flatComposerPad,
                {paddingBottom: bottomClearance},
              ]}>
              {flatComposer}
            </View>
          </>
        ) : (
          <View style={[styles.emptyWrap, {paddingBottom: bottomClearance}]}>
            <View style={styles.emptyCenter}>
              <View style={styles.emptyComposer}>{centeredFlatComposer}</View>
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
    backgroundColor: theme.colors.background,
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
  cardWrap: {
    alignSelf: 'stretch',
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
  /** Web search chips use a horizontal ScrollView; clip so it cannot widen the bubble. */
  bubbleWebSearch: {
    overflow: 'hidden',
    maxWidth: '88%',
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
  flatComposerPad: {
    paddingHorizontal: 0,
  },
  composerStack: {
    width: '100%',
  },
  flatComposer: {
    paddingTop: 8,
  },
  flatDivider: {
    height: StyleSheet.hairlineWidth * 2,
    marginHorizontal: 0,
    marginBottom: 6,
  },
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    minHeight: 48,
  },
  input: {
    flex: 1,
    minHeight: 40,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: 4,
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
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  micBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{scale: 0.96}],
  },
  micBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  micBtnDisabled: {
    opacity: 0.4,
  },
});
