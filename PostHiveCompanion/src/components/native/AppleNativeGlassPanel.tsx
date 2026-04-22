import React from 'react';
import {
  Platform,
  StyleSheet,
  UIManager,
  requireNativeComponent,
  type HostComponent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const NATIVE_VIEW_NAME = 'AppleNativeGlassPanel';

type NativeProps = {
  cornerRadius?: number;
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

export function isAppleNativeGlassPanelAvailable(): boolean {
  return getHost() != null;
}

export type AppleNativeGlassPanelProps = {
  cornerRadius: number;
  style?: StyleProp<ViewStyle>;
};

/** iOS: SwiftUI Liquid Glass (26+) or material rounded rect. Use absolute fill behind composer content. */
export function AppleNativeGlassPanel({cornerRadius, style}: AppleNativeGlassPanelProps) {
  const Host = getHost();
  if (!Host) {
    return null;
  }
  return <Host cornerRadius={cornerRadius} style={[StyleSheet.absoluteFill, style]} />;
}
