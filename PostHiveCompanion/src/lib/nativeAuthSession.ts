import {NativeModules, Platform} from 'react-native';

type PostHiveAuthSessionNative = {
  start: (url: string) => Promise<string>;
};

const {PostHiveAuthSession} = NativeModules as {PostHiveAuthSession?: PostHiveAuthSessionNative};

/**
 * iOS: system ASWebAuthenticationSession for OAuth-style sign-in (App Store Guideline 4.5.x).
 * Android: not available — use AuthWebViewModal fallback.
 */
export async function startNativeAuthSession(url: string): Promise<string> {
  if (Platform.OS !== 'ios') {
    throw new Error('Native auth session is iOS-only');
  }
  if (!PostHiveAuthSession?.start) {
    throw new Error('PostHiveAuthSession native module is not linked');
  }
  return PostHiveAuthSession.start(url);
}

export function isNativeAuthSessionAvailable(): boolean {
  return Platform.OS === 'ios' && typeof PostHiveAuthSession?.start === 'function';
}
