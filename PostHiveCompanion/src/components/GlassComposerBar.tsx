import React, {useEffect, useRef} from 'react';
import {
  View,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {theme} from '../theme';
import {
  isAppleLiquidGlassComposer,
  logGlassComposerRenderPath,
} from '../lib/nativeGlassStatus';
import {AppleNativeGlassPanel} from './native/AppleNativeGlassPanel';

/**
 * Composer chrome: **SwiftUI Liquid Glass only** when iOS 26+ and `AppleNativeGlassPanel` is registered.
 * Otherwise **flat** surface (no BlurView, no frosted RN layers).
 */
type GlassComposerBarProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
  stacked?: boolean;
};

export function GlassComposerBar({
  children,
  style,
  contentStyle,
  borderRadius = 22,
  stacked = false,
}: GlassComposerBarProps) {
  const liquidGlass = isAppleLiquidGlassComposer();
  const loggedPath = useRef(false);
  useEffect(() => {
    if (loggedPath.current) return;
    loggedPath.current = true;
    logGlassComposerRenderPath();
  }, []);

  const row = (
    <View style={[styles.row, stacked && styles.stack, contentStyle]}>{children}</View>
  );

  return (
    <View
      style={[
        styles.shellBase,
        {borderRadius},
        liquidGlass ? styles.shellLiquidNative : styles.shellFlat,
        style,
      ]}>
      {liquidGlass ? (
        <AppleNativeGlassPanel cornerRadius={borderRadius} />
      ) : null}
      {row}
    </View>
  );
}

const styles = StyleSheet.create({
  shellBase: {
    overflow: 'hidden',
  },
  shellFlat: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    ...Platform.select({
      ios: {
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: {width: 0, height: 0},
      },
      android: {
        elevation: 0,
      },
    }),
  },
  /**
   * SwiftUI `glassEffect` draws its own edge + depth — no RN border, shadow, or fill.
   */
  shellLiquidNative: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: {width: 0, height: 0},
    elevation: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  stack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
});
