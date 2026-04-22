import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated, Easing} from 'react-native';
import {theme} from '../theme';

interface BrandedLoadingScreenProps {
  /**
   * Kept for API compatibility with existing call sites. Intentionally
   * unused — the loading screen now renders a uniform editorial
   * "loading…" mark on every surface.
   */
  message?: string;
}

const DOT_COUNT = 3;
// Tweak these together: a single "beat" is DOT_STAGGER_MS * DOT_COUNT for
// the in cascade plus FADE_OUT_MS for the collective fade out, then a
// short HOLD_MS pause before looping.
const DOT_STAGGER_MS = 220;
const DOT_FADE_IN_MS = 260;
const FADE_OUT_MS = 420;
const HOLD_MS = 280;

/**
 * Full-screen loading: solid black background with an italic Miller Banner
 * "loading" wordmark and three dots that cascade in then fade out together.
 * Replaces the older POSTHIVE wordmark + spinner combo so every loading
 * surface in the app shares the same quiet, editorial feel.
 */
export function BrandedLoadingScreen(_props: BrandedLoadingScreenProps) {
  const dotOpacities = useRef(
    Array.from({length: DOT_COUNT}, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const fadeIn = Animated.stagger(
      DOT_STAGGER_MS,
      dotOpacities.map(value =>
        Animated.timing(value, {
          toValue: 1,
          duration: DOT_FADE_IN_MS,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ),
    );

    const fadeOut = Animated.parallel(
      dotOpacities.map(value =>
        Animated.timing(value, {
          toValue: 0,
          duration: FADE_OUT_MS,
          useNativeDriver: true,
          easing: Easing.in(Easing.cubic),
        }),
      ),
    );

    const loop = Animated.loop(
      Animated.sequence([fadeIn, Animated.delay(HOLD_MS), fadeOut]),
    );

    loop.start();
    return () => loop.stop();
  }, [dotOpacities]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text
            style={styles.label}
            numberOfLines={1}
            allowFontScaling={false}>
            loading
          </Text>
          {dotOpacities.map((opacity, index) => (
            <Animated.Text
              key={index}
              style={[styles.dot, {opacity}]}
              numberOfLines={1}
              allowFontScaling={false}>
              .
            </Animated.Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  label: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
  dot: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: 0.2,
    includeFontPadding: false,
    // Slight nudge so the dots tuck in tight against "loading".
    marginLeft: 2,
  },
});
