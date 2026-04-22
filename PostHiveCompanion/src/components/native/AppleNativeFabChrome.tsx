import React from 'react';
import {
  Platform,
  StyleSheet,
  UIManager,
  View,
  requireNativeComponent,
  type HostComponent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {Plus} from 'lucide-react-native';
import {theme} from '../../theme';

const NATIVE_VIEW_NAME = 'AppleNativeFabChrome';

/** Mirrors the native `fabCreateMenuItems` ids in `AppleNativeFabChrome.swift`. */
export type FabCreateMenuAction = 'task' | 'event' | 'project' | 'deliverable';

type NativeProps = {
  systemImage?: string;
  interactive?: boolean;
  collapsable?: boolean;
  onNativeShortTap?: (e: {nativeEvent: {action?: string}}) => void;
  onVoiceBegan?: (e: {nativeEvent: Record<string, unknown>}) => void;
  onVoiceEnded?: (e: {nativeEvent: {aborted?: boolean}}) => void;
  style?: StyleProp<ViewStyle>;
};

let cachedNative: HostComponent<NativeProps> | null | undefined;

function getIosNativeHost(): HostComponent<NativeProps> | null {
  if (cachedNative !== undefined) {
    return cachedNative;
  }
  if (UIManager.getViewManagerConfig(NATIVE_VIEW_NAME) == null) {
    cachedNative = null;
    return null;
  }
  cachedNative = requireNativeComponent<NativeProps>(NATIVE_VIEW_NAME);
  return cachedNative;
}

/** True when the SwiftUI FAB view manager is registered (New Arch interop). */
export function isSwiftUIFabChromeAvailable(): boolean {
  return Platform.OS === 'ios' && getIosNativeHost() != null;
}

export type AppleNativeFabChromeProps = {
  size: number;
  systemImage?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * When true (iOS native path): Liquid Glass `.interactive()`, UIKit tap + long-press + swipe-up;
   * do not wrap in RN Pressable.
   */
  interactive?: boolean;
  /**
   * Fires after the user picks an option in the system context menu (tap path).
   * `action` is undefined only on legacy code paths that don't carry a selection.
   */
  onNativeShortTap?: (action?: FabCreateMenuAction) => void;
  onVoiceBegan?: () => void;
  onVoiceEnded?: (aborted: boolean) => void;
};

export function AppleNativeFabChrome({
  size,
  systemImage = 'plus',
  style,
  interactive = false,
  onNativeShortTap,
  onVoiceBegan,
  onVoiceEnded,
}: AppleNativeFabChromeProps) {
  const NativeHost = Platform.OS === 'ios' ? getIosNativeHost() : null;
  // Avoid RN borderRadius/clip on the native view — it can interfere with real glass backdrop sampling.
  const dim = {width: size, height: size};

  if (NativeHost) {
    return (
      <NativeHost
        collapsable={false}
        systemImage={systemImage}
        interactive={interactive}
        onNativeShortTap={
          onNativeShortTap
            ? e => {
                const a = e.nativeEvent?.action;
                if (a === 'task' || a === 'event' || a === 'project' || a === 'deliverable') {
                  onNativeShortTap(a);
                } else {
                  onNativeShortTap(undefined);
                }
              }
            : undefined
        }
        onVoiceBegan={onVoiceBegan ? () => onVoiceBegan() : undefined}
        onVoiceEnded={
          onVoiceEnded
            ? e => onVoiceEnded(!!e.nativeEvent?.aborted)
            : undefined
        }
        style={[dim, style]}
      />
    );
  }

  return (
    <View style={[{width: size, height: size, borderRadius: size / 2}, styles.fallbackFab, style]}>
      <Plus size={Math.round(size * 0.5)} color="#FFFFFF" strokeWidth={2.4} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackFab: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
