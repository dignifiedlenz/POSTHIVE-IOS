import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Dimensions, Image, Animated, Easing} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

// Wave images are 2000x400 pixels - aspect ratio 5:1
const IMAGE_ASPECT_RATIO = 5;

interface NoisyWaveBackgroundProps {
  tabIndex?: number; // Optional: tab index for animation
}

export function NoisyWaveBackground({tabIndex}: NoisyWaveBackgroundProps = {}) {
  const wave1TranslateX = useRef(new Animated.Value(0)).current;
  const wave2TranslateX = useRef(new Animated.Value(0)).current;
  const wave3TranslateX = useRef(new Animated.Value(0)).current;
  const prevTabIndex = useRef(tabIndex);

  useEffect(() => {
    // Smooth shift animation on tab change
    if (tabIndex !== undefined && tabIndex !== prevTabIndex.current) {
      const direction = (tabIndex ?? 0) > (prevTabIndex.current ?? 0) ? -1 : 1;
      
      // Smooth single-direction shift with staggered timing
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

      // Staggered distances - back waves move more than front waves (parallax)
      animateWave(wave1TranslateX, 120, 0);    // Back wave - most movement
      animateWave(wave2TranslateX, 80, 40);    // Middle wave
      animateWave(wave3TranslateX, 40, 80);    // Front wave - least movement

      prevTabIndex.current = tabIndex;
    }
  }, [tabIndex, wave1TranslateX, wave2TranslateX, wave3TranslateX]);

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
          styles.wave1Style,
          {
            bottom: 0,
            transform: [{translateX: wave1TranslateX}],
          },
        ]}>
        <Image
          source={require('../assets/waves/wave1.png')}
          style={{
            width: baseWidth * wave1Scale,
            height: baseHeight * wave1Scale,
            marginLeft: -(baseWidth * wave1Scale - SCREEN_WIDTH) / 2 - 40,
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
          styles.wave2Style,
          {
            bottom: 0,
            transform: [{translateX: wave2TranslateX}],
          },
        ]}>
        <Image
          source={require('../assets/waves/wave2.png')}
          style={{
            width: baseWidth * wave2Scale,
            height: baseHeight * wave2Scale,
            marginLeft: -(baseWidth * wave2Scale - SCREEN_WIDTH) / 2 - 40,
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
          styles.wave3Style,
          {
            bottom: 0,
            transform: [{translateX: wave3TranslateX}],
          },
        ]}>
        <Image
          source={require('../assets/waves/wave3.png')}
          style={{
            width: baseWidth * wave3Scale,
            height: baseHeight * wave3Scale,
            marginLeft: -(baseWidth * wave3Scale - SCREEN_WIDTH) / 2 - 40,
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

      {/* Bottom dark overlay - darkens lower portion of waves */}
      <LinearGradient
        colors={[
          'transparent',
          'rgba(0, 0, 0, 0.1)',
          'rgba(0, 0, 0, 0.35)',
          'rgba(0, 0, 0, 0.6)',
          'rgba(0, 0, 0, 0.8)',
        ]}
        locations={[0, 0.3, 0.55, 0.8, 1]}
        style={styles.bottomDarkOverlay}
      />

      {/* Top fade to black gradient */}
      <LinearGradient
        colors={[
          'rgba(0, 0, 0, 1)',
          'rgba(0, 0, 0, 1)',
          'rgba(0, 0, 0, 0.85)',
          'rgba(0, 0, 0, 0.5)',
          'rgba(0, 0, 0, 0.2)',
          'transparent',
        ]}
        locations={[0, 0.2, 0.4, 0.6, 0.75, 0.9]}
        style={styles.topFade}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: -1, // Behind everything
    pointerEvents: 'none', // Don't block touches
    overflow: 'hidden', // Clip waves at screen edges
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
  bottomDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  topFade: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
});
