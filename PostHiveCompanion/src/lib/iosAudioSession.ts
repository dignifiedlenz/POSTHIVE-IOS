import {NativeModules, Platform} from 'react-native';

type AudioSessionNative = {
  prepareForRecording: () => Promise<void>;
  restoreForPlayback: () => Promise<void>;
};

const AudioSessionModule = NativeModules.AudioSessionModule as AudioSessionNative | undefined;

/** Configure AVAudioSession for @react-native-voice before Voice.start (iOS only). */
export async function prepareIosAudioSessionForRecording(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (!AudioSessionModule) {
    console.warn(
      'AudioSessionModule missing: iOS voice may fail with invalid input format. Rebuild the native app.',
    );
    return;
  }
  await AudioSessionModule.prepareForRecording();
}

/** Hand session back to playback after recording (iOS only). */
export async function restoreIosAudioSessionForPlayback(): Promise<void> {
  if (Platform.OS !== 'ios' || !AudioSessionModule) return;
  try {
    await AudioSessionModule.restoreForPlayback();
  } catch (err) {
    console.warn('AudioSession restoreForPlayback failed:', err);
  }
}
