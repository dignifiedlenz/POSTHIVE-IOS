import React, {createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode} from 'react';
import {Alert, Platform} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  prepareIosAudioSessionForRecording,
  restoreIosAudioSessionForPlayback,
} from '../lib/iosAudioSession';

let Voice: any = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch {
  /* optional native module */
}

/**
 * Voice flow used to be a full-screen "hold to talk" overlay flow with confirmation, processing,
 * and result steps. We've simplified: any voice capture from anywhere in the app (FAB, assistant
 * mic, etc.) just produces a text transcript. The transcript is then consumed by the assistant
 * chat which submits it as a normal user message. App.tsx watches `pendingVoiceCommand` and
 * routes the user to the assistant tab when one comes in from outside the assistant.
 */
interface VoiceCommandState {
  isListening: boolean;
  transcript: string;
  aborted: boolean;
}

interface TabBarContextType {
  isVisible: boolean;
  showTabBar: () => void;
  hideTabBar: () => void;
  /** When true, Productivity tab should open CreateTodo and then clear this */
  pendingOpenCreateTodo: boolean;
  setPendingOpenCreateTodo: (v: boolean) => void;

  /** Whether the OS speech recognizer is currently capturing audio. */
  voiceState: VoiceCommandState;
  /** True when the underlying Voice native module is wired up. */
  voiceAvailable: boolean;
  /** Start a voice capture session. Resolves once Voice.start has fired. */
  startVoiceCapture: () => Promise<void>;
  /**
   * Stop the active voice session. If `abort` is true the resulting transcript is discarded,
   * otherwise the transcript is committed as a `pendingVoiceCommand` for the assistant to consume.
   */
  stopVoiceCapture: (opts?: {abort?: boolean}) => Promise<void>;

  /**
   * The latest committed voice transcript (paired with a monotonic nonce so consumers can react
   * to repeated commits of the same string). `null` when nothing is pending.
   */
  pendingVoiceCommand: {text: string; nonce: number} | null;
  /** Mark the current pendingVoiceCommand as consumed. */
  consumePendingVoiceCommand: () => void;

  /**
   * Re-attach the app's default `Voice` event handlers (FAB + assistant). Call this after any
   * screen temporarily replaced handlers (e.g. VoiceCommandModal) so press-and-hold voice works.
   */
  rebindSharedVoiceListeners: () => void;
}

const initialVoiceState: VoiceCommandState = {
  isListening: false,
  transcript: '',
  aborted: false,
};

const TabBarContext = createContext<TabBarContextType>({
  isVisible: true,
  showTabBar: () => {},
  hideTabBar: () => {},
  pendingOpenCreateTodo: false,
  setPendingOpenCreateTodo: () => {},
  voiceState: initialVoiceState,
  voiceAvailable: false,
  startVoiceCapture: async () => {},
  stopVoiceCapture: async () => {},
  pendingVoiceCommand: null,
  consumePendingVoiceCommand: () => {},
  rebindSharedVoiceListeners: () => {},
});

async function safeHaptic(style: 'start' | 'end') {
  try {
    if (Platform.OS === 'web') return;
    if (style === 'start') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    /* haptics are best-effort */
  }
}

export function TabBarProvider({children}: {children: ReactNode}) {
  const [isVisible, setIsVisible] = useState(true);
  const [pendingOpenCreateTodo, setPendingOpenCreateTodo] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceCommandState>(initialVoiceState);
  const [pendingVoiceCommand, setPendingVoiceCommand] = useState<{text: string; nonce: number} | null>(null);
  const voiceAvailable = !!Voice;

  /**
   * Press-and-hold voice model.
   *
   * iOS's Speech framework emits final results mid-utterance whenever it finalizes a segment, so
   * we cannot commit on `onSpeechResults` — we'd send the first word the moment iOS thinks it has
   * a stable result, then send the rest later, exactly the bug the user reported. Instead:
   *
   *   1. While the user holds the button, accumulate the best transcript we've seen across all
   *      `onSpeechPartialResults` and `onSpeechResults` events into `transcriptRef`.
   *   2. iOS may also auto-stop the session on silence detection (~1.5s). If that happens while
   *      the user is still holding, restart the recognizer so the session feels continuous.
   *   3. Only commit the transcript on user release (`stopVoiceCapture`).
   */
  const transcriptRef = useRef('');
  const userHoldingRef = useRef(false);
  const restartingRef = useRef(false);
  const abortRef = useRef(false);
  const nonceRef = useRef(0);

  const showTabBar = useCallback(() => setIsVisible(true), []);
  const hideTabBar = useCallback(() => setIsVisible(false), []);

  const commitTranscript = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    nonceRef.current += 1;
    setPendingVoiceCommand({text: trimmed, nonce: nonceRef.current});
  }, []);

  const consumePendingVoiceCommand = useCallback(() => {
    setPendingVoiceCommand(null);
  }, []);

  // Partials: always show the latest hypothesis (length can dip briefly while iOS revises).
  const updatePartialTranscript = useCallback((next: string) => {
    if (!next) return;
    transcriptRef.current = next;
    setVoiceState(prev => ({...prev, transcript: next}));
  }, []);

  // Final segments: prefer the longer string so a short "final" doesn't wipe a good partial.
  const updateFinalTranscript = useCallback((next: string) => {
    if (!next) return;
    if (next.length >= transcriptRef.current.length) {
      transcriptRef.current = next;
    }
    setVoiceState(prev => ({...prev, transcript: transcriptRef.current}));
  }, []);

  const restartRecognizer = useCallback(async () => {
    if (!Voice) return;
    if (restartingRef.current) return;
    restartingRef.current = true;
    try {
      try {
        await Voice.stop();
      } catch {
        /* ignore */
      }
      // Give iOS enough time to fully tear down the prior recognition task and release the
      // audio session before we re-acquire it. Too short (<150ms) and AVAudioEngine's inputNode
      // still reports a 0-channel format on the next start, throwing IsFormatSampleRateAndChannelCountValid.
      await new Promise(r => setTimeout(r, 220));
      if (!userHoldingRef.current || abortRef.current) return;
      // Re-prep the session (the native probe waits for the input format to become valid).
      await prepareIosAudioSessionForRecording();
      if (!userHoldingRef.current || abortRef.current) return;
      await Voice.start('en-US');
    } catch (err) {
      console.warn('Voice restart failed:', err);
    } finally {
      restartingRef.current = false;
    }
  }, []);

  const rebindSharedVoiceListeners = useCallback(() => {
    if (!Voice) return;
    try {
      Voice.onSpeechStart = () => {
        setVoiceState(prev => ({...prev, isListening: true}));
      };
      Voice.onSpeechEnd = () => {
        if (userHoldingRef.current && !abortRef.current) {
          void restartRecognizer();
        } else {
          setVoiceState(prev => ({...prev, isListening: false}));
        }
      };
      Voice.onSpeechPartialResults = (e: {value?: string[]}) => {
        const t = e.value?.[0] ?? '';
        updatePartialTranscript(t);
      };
      Voice.onSpeechResults = (e: {value?: string[]}) => {
        const t = e.value?.[0] ?? '';
        updateFinalTranscript(t);
      };
      Voice.onSpeechError = (e: {error?: {code?: string; message?: string}}) => {
        const msg = e.error?.message ?? '';
        const msgLower = msg.toLowerCase();
        const formatInvalid =
          e.error?.code === 'start_recording' ||
          msg.includes('IsFormatSampleRateAndChannelCountValid');
        // Common after a bad engine start or a quiet moment — same recovery as code 7.
        const noSpeechDetected =
          e.error?.code === 'recognition_fail' &&
          (msg.includes('1110') || msgLower.includes('no speech'));
        if (formatInvalid && userHoldingRef.current && !abortRef.current) {
          void restartRecognizer();
          return;
        }
        if (e.error?.code === '7' || e.error?.code === '203') {
          if (userHoldingRef.current && !abortRef.current) {
            void restartRecognizer();
          }
          return;
        }
        if (noSpeechDetected && userHoldingRef.current && !abortRef.current) {
          void restartRecognizer();
          return;
        }
        if (e.error) {
          console.warn('Voice error:', e.error);
        }
        if (!userHoldingRef.current) {
          setVoiceState(prev => ({...prev, isListening: false}));
        }
      };
    } catch (err) {
      console.warn('Voice listeners failed:', err);
    }
  }, [restartRecognizer, updatePartialTranscript, updateFinalTranscript]);

  // `@react-native-voice/voice` is a single native singleton — only one JS owner of onSpeech* at a time.
  // VoiceCommandModal may temporarily replace these; `rebindSharedVoiceListeners` / `startVoiceCapture` restore.
  useEffect(() => {
    rebindSharedVoiceListeners();
    return () => {
      try {
        Voice?.destroy?.()
          .then(() => Voice?.removeAllListeners?.())
          .catch(() => {});
      } catch {
        /* ignore */
      }
    };
  }, [rebindSharedVoiceListeners]);

  const startVoiceCapture = useCallback(async () => {
    if (!Voice) {
      Alert.alert('Voice', 'Voice recognition is not available on this build.');
      return;
    }
    transcriptRef.current = '';
    abortRef.current = false;
    userHoldingRef.current = true;
    setVoiceState({isListening: true, transcript: '', aborted: false});
    void safeHaptic('start');
    rebindSharedVoiceListeners();

    // Reconfigure the shared audio session for recording BEFORE Voice.start(). On iOS, if an
    // HLS player (dashboard background, music, etc.) has the session in `.playback`, the
    // recognizer's AVAudioEngine input format is invalid and Voice.start() throws
    // "IsFormatSampleRateAndChannelCountValid(format)". The native prepare also probes the
    // input format until it's valid, but iOS can still race on the very first activation, so
    // we retry Voice.start() once with a longer wait if it throws the format error inline.
    const tryStart = async (): Promise<void> => {
      await prepareIosAudioSessionForRecording();
      if (!userHoldingRef.current || abortRef.current) return;
      await Voice.start('en-US');
    };

    try {
      await tryStart();
    } catch (err: any) {
      const msg = String(err?.message ?? err ?? '');
      const isFormatErr = msg.includes('IsFormatSampleRateAndChannelCountValid');
      if (isFormatErr && userHoldingRef.current && !abortRef.current) {
        try {
          try {
            await Voice.stop();
          } catch {
            /* ignore */
          }
          // Wait noticeably longer on the recovery attempt — iOS needs a beat after the failed
          // engine start to re-publish a valid input format.
          await new Promise(r => setTimeout(r, 350));
          if (!userHoldingRef.current || abortRef.current) return;
          await tryStart();
          return;
        } catch (retryErr) {
          console.error('Voice start retry failed:', retryErr);
        }
      }
      userHoldingRef.current = false;
      setVoiceState(prev => ({...prev, isListening: false}));
      console.error('Voice start failed:', err);
      void restoreIosAudioSessionForPlayback();
      Alert.alert('Voice', 'Could not start listening. Check microphone permission.');
    }
  }, [rebindSharedVoiceListeners]);

  const stopVoiceCapture = useCallback(
    async (opts: {abort?: boolean} = {}) => {
      const abort = !!opts.abort;
      abortRef.current = abort;
      userHoldingRef.current = false;
      void safeHaptic('end');
      try {
        if (Voice) await Voice.stop();
      } catch {
        /* ignore */
      }
      // Hand the shared audio session back to playback so HLS backgrounds / music keep
      // working after we release the mic.
      void restoreIosAudioSessionForPlayback();
      setVoiceState(prev => ({...prev, isListening: false, aborted: abort}));
      if (!abort) {
        // Give the recognizer a brief moment to deliver any final result for the tail of the
        // utterance, then commit whatever we've accumulated.
        await new Promise(r => setTimeout(r, 180));
        const finalText = transcriptRef.current.trim();
        if (!abortRef.current && finalText) {
          commitTranscript(finalText);
        }
      }
    },
    [commitTranscript],
  );

  return (
    <TabBarContext.Provider value={{
      isVisible,
      showTabBar,
      hideTabBar,
      pendingOpenCreateTodo,
      setPendingOpenCreateTodo,
      voiceState,
      voiceAvailable,
      startVoiceCapture,
      stopVoiceCapture,
      pendingVoiceCommand,
      consumePendingVoiceCommand,
      rebindSharedVoiceListeners,
    }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  return useContext(TabBarContext);
}

