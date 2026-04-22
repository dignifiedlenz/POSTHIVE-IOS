import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated, Easing, Pressable} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {theme} from '../../theme';
import {AppleNativeButton} from '../../components/native/AppleNativeButton';

interface AuthWelcomeScreenProps {
  onGetStarted: () => void;
  error?: string | null;
  clearError?: () => void;
}

export function AuthWelcomeScreen({
  onGetStarted,
  error,
  clearError,
}: AuthWelcomeScreenProps) {
  const contentOpacity = useRef(new Animated.Value(0)).current;
  // Drives the staggered entrance for the italic "welcome back" line:
  // 0 → 1 maps to (translateY 18 → 0, top text 0 → 0.98 opacity, glow halo
  // ramp 0 → 0.55).
  const welcomeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        delay: 100,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(welcomeAnim, {
        toValue: 1,
        duration: 850,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [contentOpacity, welcomeAnim]);

  const welcomeTranslateY = welcomeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const welcomeTopOpacity = welcomeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.98],
  });
  // Glow blooms slightly later than the crisp top layer.
  const welcomeGlowOpacity = welcomeAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, 0.2, 0.55],
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.content} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Animated.View
            style={[styles.titleContainer, {opacity: contentOpacity}]}>
            <Text
              style={styles.brand}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              allowFontScaling={false}>
              POSTHIVE
            </Text>
            {/* Editorial Miller Banner italic overline that sits on top of the
                lower portion of the wordmark for an editorial collage feel.
                Two stacked layers create a soft halo glow without requiring
                a native blur view. The whole stack staggers in after the
                wordmark with a gentle rise + glow bloom. */}
            <Animated.View
              style={[
                styles.welcomeBackStack,
                {transform: [{translateY: welcomeTranslateY}]},
              ]}>
              <Animated.Text
                style={[
                  styles.welcomeBack,
                  styles.welcomeBackGlow,
                  {opacity: welcomeGlowOpacity},
                ]}
                numberOfLines={1}
                allowFontScaling={false}>
                welcome back.
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.welcomeBack,
                  styles.welcomeBackTop,
                  {opacity: welcomeTopOpacity},
                ]}
                numberOfLines={1}
                allowFontScaling={false}>
                welcome back.
              </Animated.Text>
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.buttonContainer, {opacity: contentOpacity}]}>
            {error && clearError && (
              <Pressable onPress={clearError} style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </Pressable>
            )}
            <AppleNativeButton
              title="Get Started"
              buttonStyle="bordered"
              onPress={onGetStarted}
              style={styles.button}
              fallbackTextStyle={styles.buttonText}
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  center: {
    alignItems: 'center',
  },
  titleContainer: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  brand: {
    color: theme.colors.textPrimary,
    fontSize: 72,
    // The wordmark needs to render on a single line. We rely on
    // `numberOfLines={1}` + `adjustsFontSizeToFit` (set on the <Text/>) and a
    // small letter-spacing so the glyphs don't get clipped at the right edge.
    fontFamily: theme.typography.fontFamily.wordmark,
    letterSpacing: 0,
    textTransform: 'uppercase',
    textAlign: 'center',
    alignSelf: 'stretch',
    includeFontPadding: false,
  },
  welcomeBackStack: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    // Pull the italic line UP so it overlaps the bottom of the POSTHIVE
    // wordmark — creates the layered editorial look. Keep the overlap
    // subtle so the italic is clearly readable.
    marginTop: -36,
  },
  welcomeBack: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontSize: 54,
    lineHeight: 68,
    letterSpacing: 0.2,
    textAlign: 'center',
    includeFontPadding: false,
  },
  // Soft warm glow halo behind the crisp top layer. Opacity is animated
  // separately so the glow can bloom in.
  welcomeBackGlow: {
    position: 'absolute',
    color: '#FFE7B3',
    textShadowColor: 'rgba(255, 209, 128, 0.95)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 28,
  },
  welcomeBackTop: {
    textShadowColor: 'rgba(255, 224, 170, 0.45)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 10,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 240,
  },
  button: {
    width: '100%',
    minHeight: 60,
    alignSelf: 'stretch',
  },
  buttonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    fontWeight: '500',
    letterSpacing: theme.typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  errorContainer: {
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
  },
});
