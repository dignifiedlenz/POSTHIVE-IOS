import React, {type ComponentType} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
  requireNativeComponent,
  type HostComponent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {theme} from '../../theme';

const NATIVE_VIEW_NAME = 'AppleNativeGlassIconButton';

type NativeProps = {
  systemImage: string;
  prominent?: boolean;
  active?: boolean;
  enabled?: boolean;
  collapsable?: boolean;
  onNativePress?: (e: {nativeEvent: Record<string, unknown>}) => void;
  style?: StyleProp<ViewStyle>;
};

let cached: HostComponent<NativeProps> | null | undefined;

function getHost(): HostComponent<NativeProps> | null {
  if (cached !== undefined) {
    return cached;
  }
  if (Platform.OS !== 'ios' || UIManager.getViewManagerConfig(NATIVE_VIEW_NAME) == null) {
    cached = null;
    return null;
  }
  cached = requireNativeComponent<NativeProps>(NATIVE_VIEW_NAME);
  return cached;
}

export function isAppleNativeGlassIconButtonAvailable(): boolean {
  return getHost() != null;
}

export type AppleNativeGlassIconButtonProps = {
  systemImage: string;
  /** Stronger emphasis when using native SwiftUI (iOS) or flat fallback (Android). */
  prominent?: boolean;
  active?: boolean;
  enabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Lucide fallback */
  fallbackIcon: ComponentType<{size?: number; color?: string}>;
  fallbackIconColor: string;
};

export function AppleNativeGlassIconButton({
  systemImage,
  prominent = true,
  active = false,
  enabled = true,
  onPress,
  style,
  accessibilityLabel,
  fallbackIcon: FallbackIcon,
  fallbackIconColor,
}: AppleNativeGlassIconButtonProps) {
  const Host = getHost();
  const wrapStyle = [{width: 40, height: 40, alignSelf: 'center'}, style] as StyleProp<ViewStyle>;

  if (Host) {
    return (
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{disabled: !enabled}}
        collapsable={false}
        style={[wrapStyle, styles.nativeWrap]}>
        <Host
          collapsable={false}
          systemImage={systemImage}
          prominent={prominent}
          active={active}
          enabled={enabled}
          onNativePress={onPress ? () => onPress() : undefined}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={!enabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.fallbackBtn,
        prominent && styles.fallbackProminent,
        active && styles.fallbackActive,
        pressed && enabled && styles.fallbackPressed,
        !enabled && styles.fallbackDisabled,
        style,
      ]}>
      <FallbackIcon size={20} color={fallbackIconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nativeWrap: {
    backgroundColor: 'transparent',
  },
  fallbackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  fallbackProminent: {
    backgroundColor: theme.colors.secondaryBackground,
    borderColor: theme.colors.secondaryBorder,
  },
  fallbackActive: {
    backgroundColor: theme.colors.accentBackground,
    borderColor: theme.colors.accentBackground,
  },
  fallbackPressed: {
    opacity: 0.9,
  },
  fallbackDisabled: {
    opacity: 0.4,
  },
});
