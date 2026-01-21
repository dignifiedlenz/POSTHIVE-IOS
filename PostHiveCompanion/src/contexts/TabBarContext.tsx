import React, {createContext, useContext, useState, useCallback, ReactNode} from 'react';

interface VoiceCommandState {
  isListening: boolean;
  transcript: string;
  isProcessing: boolean;
  showConfirmation: boolean;
  aborted: boolean;
  result: {success: boolean; message: string; isAnswer?: boolean} | null;
}

interface TabBarContextType {
  isVisible: boolean;
  showTabBar: () => void;
  hideTabBar: () => void;
  // Hold-to-talk voice command state
  voiceState: VoiceCommandState;
  startListening: () => void;
  stopListening: (transcript: string) => void;
  abortVoice: () => void;
  updateTranscript: (text: string) => void;
  setProcessing: (processing: boolean) => void;
  setResult: (result: {success: boolean; message: string} | null) => void;
  showConfirmation: (show: boolean) => void;
  resetVoice: () => void;
}

const initialVoiceState: VoiceCommandState = {
  isListening: false,
  transcript: '',
  isProcessing: false,
  showConfirmation: false,
  aborted: false,
  result: null,
};

const TabBarContext = createContext<TabBarContextType>({
  isVisible: true,
  showTabBar: () => {},
  hideTabBar: () => {},
  voiceState: initialVoiceState,
  startListening: () => {},
  stopListening: () => {},
  abortVoice: () => {},
  updateTranscript: () => {},
  setProcessing: () => {},
  setResult: () => {},
  showConfirmation: () => {},
  resetVoice: () => {},
});

export function TabBarProvider({children}: {children: ReactNode}) {
  const [isVisible, setIsVisible] = useState(true);
  const [voiceState, setVoiceState] = useState<VoiceCommandState>(initialVoiceState);

  const showTabBar = useCallback(() => {
    setIsVisible(true);
  }, []);

  const hideTabBar = useCallback(() => {
    setIsVisible(false);
  }, []);

  const startListening = useCallback(() => {
    setVoiceState({
      isListening: true,
      transcript: '',
      isProcessing: false,
      showConfirmation: false,
      result: null,
    });
  }, []);

  const stopListening = useCallback((transcript: string) => {
    setVoiceState(prev => ({
      ...prev,
      isListening: false,
      transcript,
    }));
  }, []);

  const abortVoice = useCallback(() => {
    setVoiceState(prev => ({
      ...prev,
      isListening: false,
      aborted: true,
    }));
  }, []);

  const updateTranscript = useCallback((text: string) => {
    setVoiceState(prev => ({...prev, transcript: text}));
  }, []);

  const setProcessing = useCallback((processing: boolean) => {
    setVoiceState(prev => ({...prev, isProcessing: processing}));
  }, []);

  const setResult = useCallback((result: {success: boolean; message: string; isAnswer?: boolean} | null) => {
    setVoiceState(prev => ({...prev, result}));
  }, []);

  const showConfirmationFn = useCallback((show: boolean) => {
    setVoiceState(prev => ({...prev, showConfirmation: show}));
  }, []);

  const resetVoice = useCallback(() => {
    setVoiceState(initialVoiceState);
  }, []);

  return (
    <TabBarContext.Provider value={{
      isVisible,
      showTabBar,
      hideTabBar,
      voiceState,
      startListening,
      stopListening,
      abortVoice,
      updateTranscript,
      setProcessing,
      setResult,
      showConfirmation: showConfirmationFn,
      resetVoice,
    }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  return useContext(TabBarContext);
}

