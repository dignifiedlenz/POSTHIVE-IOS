import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Animated, Dimensions} from 'react-native';
import Svg, {Line, Defs, Pattern, Rect} from 'react-native-svg';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

interface BlueprintBackgroundProps {
  animate?: boolean;
}

export function BlueprintBackground({animate = true}: BlueprintBackgroundProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const gridOpacity = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    if (animate) {
      // Fade in the background
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

      // Subtle pulsing effect on the grid
      Animated.loop(
        Animated.sequence([
          Animated.timing(gridOpacity, {
            toValue: 0.25,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(gridOpacity, {
            toValue: 0.15,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [animate, opacity, gridOpacity]);

  return (
    <Animated.View style={[styles.container, {opacity: animate ? opacity : 1}]}>
      {/* Blueprint grid background */}
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={styles.svg}>
        <Defs>
          {/* Fine grid pattern */}
          <Pattern
            id="smallGrid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse">
            <Rect width="20" height="20" fill="transparent" />
            <Line
              x1="0"
              y1="0"
              x2="0"
              y2="20"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="0.5"
            />
            <Line
              x1="0"
              y1="0"
              x2="20"
              y2="0"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="0.5"
            />
          </Pattern>

          {/* Large grid pattern */}
          <Pattern
            id="largeGrid"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse">
            <Rect width="100" height="100" fill="url(#smallGrid)" />
            <Line
              x1="0"
              y1="0"
              x2="0"
              y2="100"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="1"
            />
            <Line
              x1="0"
              y1="0"
              x2="100"
              y2="0"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="1"
            />
          </Pattern>
        </Defs>

        {/* Apply the grid pattern */}
        <Rect width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#largeGrid)" />

        {/* Diagonal accent lines */}
        <Line
          x1="0"
          y1={SCREEN_HEIGHT * 0.3}
          x2={SCREEN_WIDTH}
          y2={SCREEN_HEIGHT * 0.3}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="2"
          strokeDasharray="10,5"
        />
        <Line
          x1="0"
          y1={SCREEN_HEIGHT * 0.7}
          x2={SCREEN_WIDTH}
          y2={SCREEN_HEIGHT * 0.7}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="2"
          strokeDasharray="10,5"
        />

        {/* Vertical center line */}
        <Line
          x1={SCREEN_WIDTH / 2}
          y1="0"
          x2={SCREEN_WIDTH / 2}
          y2={SCREEN_HEIGHT}
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth="1"
          strokeDasharray="5,5"
        />
      </Svg>

      {/* Animated overlay for pulsing effect */}
      {animate && (
        <Animated.View
          style={[
            styles.pulseOverlay,
            {
              opacity: gridOpacity,
            },
          ]}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  pulseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(59, 130, 246, 0.03)', // Very subtle blue tint
  },
});
