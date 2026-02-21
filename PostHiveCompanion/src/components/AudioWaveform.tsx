import React, {useRef, useEffect} from 'react';
import {View, StyleSheet, Animated, Easing} from 'react-native';

const BAR_COUNT = 36;
const MIN_HEIGHT = 8;
const MAX_HEIGHT = 52;

interface AudioWaveformProps {
  /** When true, bars pulse with higher amplitude and faster. When false, subtle idle pulse. */
  isPlaying: boolean;
  color?: string;
}

/**
 * Live pulsing waveform animation for audio playback.
 * Uses a master animation with phase-offset interpolation per bar for smooth wave effect.
 */
export function AudioWaveform({isPlaying, color = 'rgba(255, 255, 255, 0.9)'}: AudioWaveformProps) {
  const masterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = isPlaying ? 800 : 2000;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(masterAnim, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(masterAnim, {
          toValue: 0,
          duration: duration / 2,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isPlaying, masterAnim]);

  return (
    <View style={styles.container}>
      {Array.from({length: BAR_COUNT}, (_, i) => {
        // Phase offset: each bar is offset in the wave (0 to 1 maps to full cycle)
        const phase = i / (BAR_COUNT - 1);
        return (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                backgroundColor: color,
                height: masterAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2)),
                    MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * (0.5 + 0.5 * Math.cos(phase * Math.PI * 2)),
                  ],
                }),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  bar: {
    width: 4,
    minHeight: MIN_HEIGHT,
    alignSelf: 'center',
  },
});
