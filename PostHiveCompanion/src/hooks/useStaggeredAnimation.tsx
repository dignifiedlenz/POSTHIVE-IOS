import React, {useRef, useCallback} from 'react';
import {Animated, Easing} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

interface UseStaggeredAnimationOptions {
  itemCount: number;
  staggerDelay?: number;
  duration?: number;
  initialDelay?: number;
}

export function useStaggeredAnimation({
  itemCount,
  staggerDelay = 50,
  duration = 300,
  initialDelay = 100,
}: UseStaggeredAnimationOptions) {
  // Create animated values for each item
  const animations = useRef<Animated.Value[]>([]);
  
  // Ensure we have enough animated values
  while (animations.current.length < itemCount) {
    animations.current.push(new Animated.Value(0));
  }

  const animate = useCallback(() => {
    // Reset all animations
    animations.current.forEach(anim => anim.setValue(0));

    // Create staggered animations
    const staggeredAnimations = animations.current.slice(0, itemCount).map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration,
        delay: initialDelay + index * staggerDelay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      })
    );

    // Run all animations in parallel (they'll stagger due to delays)
    Animated.parallel(staggeredAnimations).start();
  }, [itemCount, staggerDelay, duration, initialDelay]);

  // Animate on screen focus
  useFocusEffect(
    useCallback(() => {
      animate();
    }, [animate])
  );

  // Get animated style for a specific index
  const getAnimatedStyle = useCallback((index: number) => {
    const anim = animations.current[index];
    if (!anim) return {};

    return {
      opacity: anim,
      transform: [
        {
          translateY: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          }),
        },
      ],
    };
  }, []);

  return {
    getAnimatedStyle,
    animate,
  };
}

// Simple component wrapper for animated items
export function AnimatedItem({
  children,
  animation,
  style,
}: {
  children: React.ReactNode;
  animation: any;
  style?: any;
}) {
  return (
    <Animated.View style={[style, animation]}>
      {children}
    </Animated.View>
  );
}
