import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  requireNativeComponent,
  type GestureResponderEvent,
  type HostComponent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {theme} from '../../theme';

const NATIVE_VIEW_NAME = 'AppleNativeButton';

type NativeProps = {
  title: string;
  /** iOS SwiftUI: borderedProminent | bordered | borderless | plain | secondary | prominent | filled */
  buttonStyle?: string;
  enabled?: boolean;
  /** SF Symbol name, e.g. "arrow.right" */
  systemImage?: string;
  /** Native: must not be `onPress` — that maps to `topPress` and collides with RN touch events. */
  onNativePress?: (event: {nativeEvent: Record<string, unknown>}) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * New Architecture: `requireNativeComponent` registers a lazy view config loader. If
 * `getViewManagerConfig` is missing (common for legacy view managers until interop is
 * complete), that loader returns null and React throws "View config not found".
 * Only require the native host when the config exists.
 */
let cachedNativeHost: HostComponent<NativeProps> | null | undefined;

function getIosNativeHost(): HostComponent<NativeProps> | null {
  if (cachedNativeHost !== undefined) {
    return cachedNativeHost;
  }
  if (
    UIManager.getViewManagerConfig(NATIVE_VIEW_NAME) == null
  ) {
    cachedNativeHost = null;
    return null;
  }
  cachedNativeHost = requireNativeComponent<NativeProps>(NATIVE_VIEW_NAME);
  return cachedNativeHost;
}

export type AppleNativeButtonProps = {
  title: string;
  buttonStyle?: NativeProps['buttonStyle'];
  enabled?: boolean;
  systemImage?: string;
  onPress?: (e?: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  /** Android / fallback: text style */
  fallbackTextStyle?: object;
};

/**
 * iOS: real SwiftUI `Button` (system materials / Liquid Glass where the OS applies it).
 * Android: `Pressable` fallback with similar hierarchy (not identical to Material).
 */
export function AppleNativeButton({
  title,
  buttonStyle = 'borderedProminent',
  enabled = true,
  systemImage,
  onPress,
  style,
  fallbackTextStyle,
}: AppleNativeButtonProps) {
  const NativeHost = Platform.OS === 'ios' ? getIosNativeHost() : null;
  if (NativeHost) {
    return (
      <NativeHost
        title={title}
        buttonStyle={buttonStyle}
        enabled={enabled}
        systemImage={systemImage}
        onNativePress={onPress ? () => onPress() : undefined}
        style={style}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!enabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.fallbackBtn,
        pressed && styles.fallbackPressed,
        !enabled && styles.fallbackDisabled,
        style,
      ]}>
      <Text style={[styles.fallbackText, fallbackTextStyle]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fallbackBtn: {
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackPressed: {
    opacity: 0.85,
  },
  fallbackDisabled: {
    opacity: 0.45,
  },
  fallbackText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.sm,
    letterSpacing: theme.typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
});
