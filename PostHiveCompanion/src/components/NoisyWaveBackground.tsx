import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Dimensions, Image, Animated, Easing} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

// Wave images are 2000x400 pixels - aspect ratio 5:1
const IMAGE_ASPECT_RATIO = 5;

interface NoisyWaveBackgroundProps {
  tabIndex?: number; // Optional: tab index for animation
  looping?: boolean; // Optional: continuous slow wave drift (for auth welcome, etc.)
}

export function NoisyWaveBackground({tabIndex, looping}: NoisyWaveBackgroundProps = {}) {
  const wave1TranslateX = useRef(new Animated.Value(0)).current;
  const wave2TranslateX = useRef(new Animated.Value(0)).current;
  const wave3TranslateX = useRef(new Animated.Value(0)).current;
  const wave1TranslateY = useRef(new Animated.Value(0)).current;
  const wave2TranslateY = useRef(new Animated.Value(0)).current;
  const wave3TranslateY = useRef(new Animated.Value(0)).current;
  const prevTabIndex = useRef(tabIndex);

  // Looping mode: gentle continuous wave drift up and down (like breathing)
  useEffect(() => {
    if (!looping) return;

    const DURATION = 7500; // Slow ~7.5s per direction
    const createYLoop = (animValue: Animated.Value, distance: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: distance,
            duration: DURATION,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(animValue, {
            toValue: -distance,
            duration: DURATION,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: DURATION / 2,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      );

    // Staggered Y movement - back wave moves most, front least (parallax)
    const loop1Y = createYLoop(wave1TranslateY, 25, 0);
    const loop2Y = createYLoop(wave2TranslateY, 18, 300);
    const loop3Y = createYLoop(wave3TranslateY, 12, 600);

    // Subtle X drift for extra organic feel
    const createXLoop = (animValue: Animated.Value, distance: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: distance,
            duration: DURATION * 1.2,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(animValue, {
            toValue: -distance,
            duration: DURATION * 1.2,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      );
    const loop1X = createXLoop(wave1TranslateX, 40, 0);
    const loop2X = createXLoop(wave2TranslateX, 25, 200);
    const loop3X = createXLoop(wave3TranslateX, 15, 400);

    loop1Y.start();
    loop2Y.start();
    loop3Y.start();
    loop1X.start();
    loop2X.start();
    loop3X.start();

    return () => {
      loop1Y.stop();
      loop2Y.stop();
      loop3Y.stop();
      loop1X.stop();
      loop2X.stop();
      loop3X.stop();
      wave1TranslateX.setValue(0);
      wave2TranslateX.setValue(0);
      wave3TranslateX.setValue(0);
      wave1TranslateY.setValue(0);
      wave2TranslateY.setValue(0);
      wave3TranslateY.setValue(0);
    };
  }, [looping, wave1TranslateX, wave2TranslateX, wave3TranslateX, wave1TranslateY, wave2TranslateY, wave3TranslateY]);

  // Tab mode: smooth shift on tab change
  useEffect(() => {
    if (looping) return;

    if (tabIndex !== undefined && tabIndex !== prevTabIndex.current) {
      const direction = (tabIndex ?? 0) > (prevTabIndex.current ?? 0) ? -1 : 1;

      const animateWave = (animValue: Animated.Value, distance: number, delay: number) => {
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: distance * direction,
            duration: 400,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]).start();
      };

      animateWave(wave1TranslateX, 120, 0);
      animateWave(wave2TranslateX, 80, 40);
      animateWave(wave3TranslateX, 40, 80);

      prevTabIndex.current = tabIndex;
    }
  }, [looping, tabIndex, wave1TranslateX, wave2TranslateX, wave3TranslateX]);

  // Scale factors for each wave (larger = bigger wave)
  const wave1Scale = 10.0;  // Largest - back layer
  const wave2Scale = 5.5;   // Medium
  const wave3Scale = 3.5;   // Front layer - increased to extend lower

  // Calculate base image dimensions
  const baseWidth = SCREEN_WIDTH * 1.3; // Extra width for animation
  const baseHeight = baseWidth / IMAGE_ASPECT_RATIO;

  return (
    <View style={styles.container}>
      {/* Noisy background texture - fills entire screen */}
      <Image
        source={require('../assets/waves/noisy-background.png')}
        style={styles.noisyBackground}
        resizeMode="cover"
      />

      {/* Bottom glow - subtle light emanating from bottom */}
      <LinearGradient
        colors={[
          'transparent',
          'transparent',
          'rgba(20, 20, 40, 0.08)',
          'rgba(25, 25, 50, 0.02)',
          'rgba(30, 30, 55, 0.05)',
        ]}
        locations={[0, 0.5, 0.75, 0.9, 1]}
        style={styles.bottomGlow}
      />

      {/* Wave 1 - Back layer (largest) */}
      <Animated.View
        style={[
          styles.waveContainer,
          looping ? styles.wave1StyleProminent : styles.wave1Style,
          {
            bottom: 0,
            transform: [
              {translateX: wave1TranslateX},
              {translateY: wave1TranslateY},
            ],
          },
        ]}>
        <Image
          source={require('../assets/waves/wave1.png')}
          style={{
            width: baseWidth * wave1Scale,
            height: baseHeight * wave1Scale,
            marginLeft: -(baseWidth * wave1Scale - SCREEN_WIDTH - 2 * WAVE_PADDING) / 2 - 40,
          }}
          resizeMode="contain"
          blendMode="screen"
        />
        <LinearGradient
          colors={['transparent', 'transparent', 'rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.7)']}
          locations={[0, 0.5, 0.8, 1]}
          style={styles.waveBottomGradient}
        />
      </Animated.View>

      {/* Wave 2 - Middle layer */}
      <Animated.View
        style={[
          styles.waveContainer,
          looping ? styles.wave2StyleProminent : styles.wave2Style,
          {
            bottom: 0,
            transform: [
              {translateX: wave2TranslateX},
              {translateY: wave2TranslateY},
            ],
          },
        ]}>
        <Image
          source={require('../assets/waves/wave2.png')}
          style={{
            width: baseWidth * wave2Scale,
            height: baseHeight * wave2Scale,
            marginLeft: -(baseWidth * wave2Scale - SCREEN_WIDTH - 2 * WAVE_PADDING) / 2 - 40,
          }}
          resizeMode="contain"
          blendMode="screen"
        />
        <LinearGradient
          colors={['transparent', 'transparent', 'rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.7)']}
          locations={[0, 0.5, 0.8, 1]}
          style={styles.waveBottomGradient}
        />
      </Animated.View>

      {/* Wave 3 - Front layer (smallest) */}
      <Animated.View
        style={[
          styles.waveContainer,
          looping ? styles.wave3StyleProminent : styles.wave3Style,
          {
            bottom: 0,
            transform: [
              {translateX: wave3TranslateX},
              {translateY: wave3TranslateY},
            ],
          },
        ]}>
        <Image
          source={require('../assets/waves/wave3.png')}
          style={{
            width: baseWidth * wave3Scale,
            height: baseHeight * wave3Scale,
            marginLeft: -(baseWidth * wave3Scale - SCREEN_WIDTH - 2 * WAVE_PADDING) / 2 - 40,
          }}
          resizeMode="contain"
          blendMode="screen"
        />
        <LinearGradient
          colors={['transparent', 'transparent', 'rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.7)']}
          locations={[0, 0.5, 0.8, 1]}
          style={styles.waveBottomGradient}
        />
      </Animated.View>

      {/* Bottom dark overlay - lighter when looping so waves stay bright */}
      <LinearGradient
        colors={
          looping
            ? [
                'transparent',
                'rgba(0, 0, 0, 0.05)',
                'rgba(0, 0, 0, 0.15)',
                'rgba(0, 0, 0, 0.35)',
                'rgba(0, 0, 0, 0.55)',
              ]
            : [
                'transparent',
                'rgba(0, 0, 0, 0.1)',
                'rgba(0, 0, 0, 0.35)',
                'rgba(0, 0, 0, 0.6)',
                'rgba(0, 0, 0, 0.8)',
              ]
        }
        locations={[0, 0.3, 0.55, 0.8, 1]}
        style={styles.bottomDarkOverlay}
      />

      {/* Top fade to black gradient - softer when looping so waves show through more */}
      <LinearGradient
        colors={
          looping
            ? [
                'rgba(0, 0, 0, 0.75)',
                'rgba(0, 0, 0, 0.45)',
                'rgba(0, 0, 0, 0.2)',
                'rgba(0, 0, 0, 0.05)',
                'transparent',
              ]
            : [
                'rgba(0, 0, 0, 1)',
                'rgba(0, 0, 0, 1)',
                'rgba(0, 0, 0, 0.85)',
                'rgba(0, 0, 0, 0.5)',
                'rgba(0, 0, 0, 0.2)',
                'transparent',
              ]
        }
        locations={looping ? [0, 0.2, 0.45, 0.7, 0.9] : [0, 0.2, 0.4, 0.6, 0.75, 0.9]}
        style={styles.topFade}
      />
    </View>
  );
}

// Extra padding so waves don't clip during translate animation
const WAVE_PADDING = 60;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -WAVE_PADDING,
    left: -WAVE_PADDING,
    right: -WAVE_PADDING,
    bottom: -WAVE_PADDING,
    backgroundColor: '#000000',
    zIndex: -1, // Behind everything
    pointerEvents: 'none', // Don't block touches
    overflow: 'hidden', // Clip at extended bounds
  },
  noisyBackground: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.5, // Subtle noise texture
  },
  bottomGlow: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  waveContainer: {
    position: 'absolute',
    left: 0,
  },
  waveBottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    pointerEvents: 'none',
  },
  wave1Style: {
    opacity: 0.12,
    mixBlendMode: 'screen',
  },
  wave2Style: {
    opacity: 0.12,
    mixBlendMode: 'screen',
  },
  wave3Style: {
    opacity: 0.12,
    mixBlendMode: 'screen',
  },
  wave1StyleProminent: {
    opacity: 0.38,
    mixBlendMode: 'screen',
  },
  wave2StyleProminent: {
    opacity: 0.38,
    mixBlendMode: 'screen',
  },
  wave3StyleProminent: {
    opacity: 0.38,
    mixBlendMode: 'screen',
  },
  bottomDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  topFade: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
});
