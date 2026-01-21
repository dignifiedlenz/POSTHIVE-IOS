import React, {useEffect, useRef, useCallback} from 'react';
import {View, Pressable, StyleSheet, Dimensions, Platform, Vibration, NativeModules, Alert, PanResponder, GestureResponderEvent} from 'react-native';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {BlurView} from '@react-native-community/blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Home, Calendar, Plus, FolderOpen, User} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import {useTabBar} from '../contexts/TabBarContext';

// Conditionally import Voice
let Voice: any = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch (error) {
  console.warn('Voice module not available:', error);
}

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const TAB_BAR_MARGIN = 16;
const TAB_BAR_WIDTH = SCREEN_WIDTH - TAB_BAR_MARGIN * 2;
const TAB_COUNT = 5; // 4 tabs + 1 FAB
const TAB_WIDTH = TAB_BAR_WIDTH / TAB_COUNT;
const INDICATOR_SIZE = 40;
const FAB_SIZE = 48;
const TAB_BAR_HEIGHT = 60;
const HIDE_OFFSET = 120; // How far to translate down when hidden

// Animated Pressable component
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const iconMap: Record<string, React.ComponentType<{size: number; color: string; strokeWidth?: number}>> = {
  DashboardTab: Home,
  CalendarTab: Calendar,
  ReviewTab: FolderOpen,
  ProfileTab: User,
};

// Tab positions: Home, Calendar, [FAB], Projects, Profile
const tabOrder = ['DashboardTab', 'CalendarTab', 'FAB', 'ReviewTab', 'ProfileTab'];

interface TabItemProps {
  route: {key: string; name: string};
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
}

function TabItem({route, isFocused, onPress, onLongPress, accessibilityLabel}: TabItemProps) {
  const Icon = iconMap[route.name] || Home;
  
  const pressed = useSharedValue(0);
  const iconOpacity = useSharedValue(isFocused ? 1 : 0.4);

  useEffect(() => {
    iconOpacity.value = withTiming(isFocused ? 1 : 0.4, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
  }, [isFocused, iconOpacity]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{scale: 1 - pressed.value * 0.08}],
    opacity: iconOpacity.value,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={isFocused ? {selected: true} : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        pressed.value = withTiming(1, {duration: 100, easing: Easing.out(Easing.quad)});
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, {duration: 150, easing: Easing.out(Easing.quad)});
      }}
      style={styles.tab}>
      <Animated.View style={[styles.iconWrapper, animatedIconStyle]}>
        <Icon
          size={24}
          color="#FFFFFF"
          strokeWidth={isFocused ? 2.2 : 1.5}
        />
      </Animated.View>
    </AnimatedPressable>
  );
}

const SWIPE_UP_THRESHOLD = 80; // pixels to swipe up to abort

function FABButton() {
  const navigation = useNavigation<any>();
  const {startListening, stopListening, abortVoice, updateTranscript, voiceState} = useTabBar();
  const pressed = useSharedValue(0);
  const isLongPressing = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTranscript = useRef('');
  const startY = useRef(0);
  const hasAborted = useRef(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: 1 - pressed.value * 0.1}],
  }));

  // Setup voice handlers
  useEffect(() => {
    if (!Voice) return;

    try {
      Voice.onSpeechResults = (e: any) => {
        if (e.value && e.value.length > 0) {
          currentTranscript.current = e.value[0];
          updateTranscript(e.value[0]);
        }
      };
      Voice.onSpeechPartialResults = (e: any) => {
        if (e.value && e.value.length > 0) {
          currentTranscript.current = e.value[0];
          updateTranscript(e.value[0]);
        }
      };
      Voice.onSpeechError = (e: any) => {
        console.error('Speech error:', e);
      };
    } catch (error) {
      console.warn('Error setting up Voice handlers:', error);
    }

    return () => {
      try {
        if (Voice) {
          Voice.destroy().then(() => Voice.removeAllListeners()).catch(() => {});
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    };
  }, [updateTranscript]);

  const startVoiceListening = useCallback(async () => {
    if (!Voice) {
      Alert.alert('Voice Not Available', 'Voice recognition is not available on this device.');
      return;
    }

    try {
      currentTranscript.current = '';
      Vibration.vibrate(50);
      startListening();
      await Voice.start('en-US');
    } catch (error) {
      console.error('Error starting voice:', error);
    }
  }, [startListening]);

  const stopVoiceListening = useCallback(async (abort: boolean = false) => {
    if (!Voice) return;

    try {
      await Voice.stop();
      if (abort) {
        abortVoice();
      } else {
        stopListening(currentTranscript.current);
      }
    } catch (error) {
      console.error('Error stopping voice:', error);
      if (abort) {
        abortVoice();
      } else {
        stopListening(currentTranscript.current);
      }
    }
  }, [stopListening, abortVoice]);

  const handlePressIn = useCallback((event: GestureResponderEvent) => {
    pressed.value = withTiming(1, {duration: 80, easing: Easing.out(Easing.quad)});
    startY.current = event.nativeEvent.pageY;
    hasAborted.current = false;
    
    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      isLongPressing.current = true;
      startVoiceListening();
    }, 300);
  }, [pressed, startVoiceListening]);

  const handleMove = useCallback((event: GestureResponderEvent) => {
    if (!isLongPressing.current || hasAborted.current) return;
    
    const currentY = event.nativeEvent.pageY;
    const deltaY = startY.current - currentY; // Positive = swiped up
    
    if (deltaY > SWIPE_UP_THRESHOLD) {
      // User swiped up enough to abort
      hasAborted.current = true;
      Vibration.vibrate(30);
      stopVoiceListening(true);
    }
  }, [stopVoiceListening]);

  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, {duration: 120, easing: Easing.out(Easing.quad)});
    
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // If we were long pressing and didn't abort, stop listening normally
    if (isLongPressing.current && !hasAborted.current) {
      isLongPressing.current = false;
      stopVoiceListening(false);
    } else {
      isLongPressing.current = false;
    }
  }, [pressed, stopVoiceListening]);

  const handlePress = useCallback(() => {
    // Only navigate if it wasn't a long press
    if (!isLongPressing.current && !voiceState.isListening) {
      navigation.navigate('DashboardTab', {screen: 'CreateTodo'});
    }
  }, [navigation, voiceState.isListening]);

  return (
    <View style={styles.fabContainer}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Create new, hold for voice command"
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onResponderMove={handleMove}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        style={styles.fabTouchable}>
        <Animated.View style={[styles.fab, animatedStyle]}>
          <Plus size={26} color="#000000" strokeWidth={2.5} />
        </Animated.View>
      </AnimatedPressable>
    </View>
  );
}

export function CustomTabBar({state, descriptors, navigation}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const {isVisible} = useTabBar();
  
  // Animation for show/hide
  const visibility = useSharedValue(isVisible ? 1 : 0);
  
  useEffect(() => {
    visibility.value = withTiming(isVisible ? 1 : 0, {
      duration: 280,
      easing: isVisible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [isVisible, visibility]);
  
  // Calculate indicator position based on visual order (accounting for FAB in middle)
  const getIndicatorPosition = (tabIndex: number) => {
    const routeName = state.routes[tabIndex]?.name;
    const visualIndex = tabOrder.indexOf(routeName);
    return visualIndex * TAB_WIDTH + (TAB_WIDTH - INDICATOR_SIZE) / 2;
  };
  
  const indicatorX = useSharedValue(getIndicatorPosition(state.index));

  useEffect(() => {
    indicatorX.value = withTiming(getIndicatorPosition(state.index), {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
  }, [state.index, indicatorX]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{translateX: indicatorX.value}],
  }));
  
  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [
      {translateY: interpolate(visibility.value, [0, 1], [HIDE_OFFSET, 0])},
    ],
    opacity: interpolate(visibility.value, [0, 0.5, 1], [0, 0.8, 1]),
  }));

  // Reorder routes to match visual order (with FAB space in middle)
  const leftRoutes = state.routes.filter(r => ['DashboardTab', 'CalendarTab'].includes(r.name));
  const rightRoutes = state.routes.filter(r => ['ReviewTab', 'ProfileTab'].includes(r.name));

  return (
    <Animated.View 
      style={[
        styles.container, 
        {paddingBottom: Math.max(insets.bottom, 8)},
        animatedContainerStyle,
      ]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      {/* Glass container */}
      <View style={styles.glassContainer}>
        {/* Subtle dark blur */}
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="dark"
          blurAmount={4}
          reducedTransparencyFallbackColor="rgba(20, 20, 22, 0.7)"
        />
        
        {/* Semi-transparent dark tint */}
        <View style={styles.darkTint} />
        
        {/* Subtle border */}
        <View style={styles.borderOverlay} />
        
        {/* Active indicator pill */}
        <Animated.View style={[styles.indicator, animatedIndicatorStyle]}>
          <View style={styles.indicatorInner} />
        </Animated.View>
        
        {/* Tab items */}
        <View style={styles.tabsContainer}>
          {/* Left tabs: Home, Calendar */}
          {leftRoutes.map((route) => {
            const {options} = descriptors[route.key];
            const isFocused = state.routes[state.index]?.name === route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TabItem
                key={route.key}
                route={route}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={options.tabBarAccessibilityLabel}
              />
            );
          })}
          
          {/* Center FAB */}
          <FABButton />
          
          {/* Right tabs: Projects, Profile */}
          {rightRoutes.map((route) => {
            const {options} = descriptors[route.key];
            const isFocused = state.routes[state.index]?.name === route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TabItem
                key={route.key}
                route={route}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={options.tabBarAccessibilityLabel}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: TAB_BAR_MARGIN,
  },
  glassContainer: {
    width: TAB_BAR_WIDTH,
    height: TAB_BAR_HEIGHT,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 10, 12, 0.35)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 6},
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  darkTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    position: 'absolute',
    top: 10,
    left: 0,
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorInner: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  fabContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  fabTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
