import {Platform, UIManager} from 'react-native';

/**
 * Composer policy: mount `AppleNativeGlassPanel` only when `isAppleLiquidGlassComposer()` (iOS 26+ + view manager).
 * Older iOS / missing manager: **flat** RN chrome — no BlurView faux glass in `GlassComposerBar`.
 */
export type GlassComposerRenderPath =
  | 'swiftui-glass-effect-ios26'
  | 'swiftui-regular-material'
  | 'rn-community-blur'
  | 'android-blur'
  | 'unknown';

const PANEL = 'AppleNativeGlassPanel';

function iosMajorVersion(): number {
  if (Platform.OS !== 'ios') return 0;
  const raw = Platform.constants?.osVersion ?? '0';
  const major = parseInt(String(raw).split('.')[0] ?? '0', 10);
  return Number.isFinite(major) ? major : 0;
}

export function getGlassComposerRenderPath(): GlassComposerRenderPath {
  if (Platform.OS === 'android') return 'android-blur';
  if (Platform.OS !== 'ios') return 'unknown';

  const nativeRegistered = UIManager.getViewManagerConfig(PANEL) != null;
  if (!nativeRegistered) return 'rn-community-blur';

  if (iosMajorVersion() >= 26) return 'swiftui-glass-effect-ios26';
  return 'swiftui-regular-material';
}

/** True only when the composer should mount `AppleNativeGlassPanel` (SwiftUI Liquid Glass). */
export function isAppleLiquidGlassComposer(): boolean {
  return getGlassComposerRenderPath() === 'swiftui-glass-effect-ios26';
}

/** One-line explanation for Metro / debugging. */
export function describeGlassComposerRenderPath(): string {
  switch (getGlassComposerRenderPath()) {
    case 'swiftui-glass-effect-ios26':
      return 'Native SwiftUI `glassEffect` (Liquid Glass). UIView via RCTViewManager.';
    case 'swiftui-regular-material':
      return 'iOS &lt; 26: composer is flat RN chrome (Liquid Glass not used; no Swift panel mounted from JS).';
    case 'rn-community-blur':
      return 'No AppleNativeGlassPanel: flat RN chrome (no BlurView imitation).';
    case 'android-blur':
      return 'Android: flat composer chrome (no faux glass).';
    default:
      return 'Unknown platform.';
  }
}

/**
 * Logs to the **Metro / JS** console (not Xcode). For Xcode, search: `POSTHIVE_GLASS` (native NSLog, DEBUG builds).
 */
export function logGlassComposerRenderPath(): void {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.warn(`[POSTHIVE_GLASS] (JS) ${describeGlassComposerRenderPath()}`);
}
