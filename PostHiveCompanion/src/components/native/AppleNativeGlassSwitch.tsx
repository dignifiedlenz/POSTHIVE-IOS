import React from 'react';
import {
  Platform,
  StyleSheet,
  Switch,
  UIManager,
  View,
  requireNativeComponent,
  type HostComponent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {theme} from '../../theme';

const NATIVE_VIEW_NAME = 'AppleNativeGlassSwitch';

type NativeProps = {
  value: boolean;
  enabled?: boolean;
  /** Hex string used as the "on" tint, e.g. "#4ade80". */
  tint?: string;
  onNativeChange?: (e: {nativeEvent: {value: boolean}}) => void;
  collapsable?: boolean;
  style?: StyleProp<ViewStyle>;
};

let cached: HostComponent<NativeProps> | null | undefined;

function getHost(): HostComponent<NativeProps> | null {
  if (cached !== undefined) {
    return cached;
  }
  if (
    Platform.OS !== 'ios' ||
    UIManager.getViewManagerConfig(NATIVE_VIEW_NAME) == null
  ) {
    cached = null;
    return null;
  }
  cached = requireNativeComponent<NativeProps>(NATIVE_VIEW_NAME);
  return cached;
}

export function isAppleNativeGlassSwitchAvailable(): boolean {
  return getHost() != null;
}

export type AppleNativeGlassSwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  /** Hex tint for the "on" state. Defaults to brand success green. */
  tint?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const DEFAULT_TINT = theme.colors.success;
// SwiftUI's `Toggle` lays out at roughly the system Switch size (51 x 31 pt).
// We pin a stable hit area so RN layout doesn't collapse the host view.
const SWITCH_WIDTH = 51;
const SWITCH_HEIGHT = 31;

/**
 * iOS: real SwiftUI `Toggle` (system Switch) — automatically picks up Liquid
 * Glass styling on iOS 26+.
 * Other platforms / older bundles: RN `Switch` fallback styled to match.
 */
export function AppleNativeGlassSwitch({
  value,
  onValueChange,
  disabled = false,
  tint = DEFAULT_TINT,
  style,
  accessibilityLabel,
}: AppleNativeGlassSwitchProps) {
  const Host = getHost();

  if (Host) {
    return (
      <View
        accessible
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{checked: value, disabled}}
        collapsable={false}
        style={[styles.wrap, style]}>
        <Host
          collapsable={false}
          value={value}
          enabled={!disabled}
          tint={tint}
          onNativeChange={e => onValueChange(e.nativeEvent.value)}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    );
  }

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{false: theme.colors.border, true: tint}}
      thumbColor={theme.colors.textPrimary}
      ios_backgroundColor={theme.colors.border}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SWITCH_WIDTH,
    height: SWITCH_HEIGHT,
    backgroundColor: 'transparent',
  },
});
