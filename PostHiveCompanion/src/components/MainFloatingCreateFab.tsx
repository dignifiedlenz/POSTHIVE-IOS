import React, {useEffect, useRef, useCallback, useState} from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  Vibration,
  Alert,
  GestureResponderEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  withTiming,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {useTabBar} from '../contexts/TabBarContext';
import {
  AppleNativeFabChrome,
  isSwiftUIFabChromeAvailable,
  type FabCreateMenuAction,
} from './native/AppleNativeFabChrome';
import {
  AppleNativeCreateGlassMenu,
  type CreationMenuAction,
} from './native/AppleNativeCreateGlassMenu';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SWIPE_UP_THRESHOLD = 80;
const FAB_SIZE = 52;
/** Space above tab bar / home indicator */
const TAB_BAR_CLEARANCE = Platform.OS === 'ios' ? 54 : 56;
const FAB_PRESS_SPRING_IN = {
  damping: 17,
  stiffness: 440,
  mass: 0.32,
  overshootClamping: true,
} as const;
const FAB_PRESS_SPRING_OUT = {
  damping: 19,
  stiffness: 300,
  mass: 0.42,
  overshootClamping: true,
} as const;

/** Same target as `AuthenticatedApp` when routing a committed voice command to the assistant. */
function navigateToAssistantChat(nav: {navigate: (name: string, params?: object) => void}) {
  nav.navigate('MainTabs', {
    screen: 'Assistant',
    params: {screen: 'AssistantChat'},
  });
}

/**
 * Floating create FAB above the bottom tab bar (native on iOS, material on Android).
 * Short tap → system create menu. Long press → open Assistant with live dictation in the composer.
 */
export function MainFloatingCreateFab() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    isVisible,
    voiceState,
    voiceAvailable,
    startVoiceCapture,
    stopVoiceCapture,
  } = useTabBar();

  const [createMenuVisible, setCreateMenuVisible] = useState(false);

  const visibility = useSharedValue(isVisible ? 1 : 0);
  useEffect(() => {
    visibility.value = withTiming(isVisible ? 1 : 0, {duration: 220});
  }, [isVisible, visibility]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(visibility.value, [0, 1], [0, 1]),
    transform: [{translateY: interpolate(visibility.value, [0, 1], [24, 0])}],
  }));

  const pressed = useSharedValue(0);
  const isLongPressing = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startY = useRef(0);
  const hasAborted = useRef(false);

  const animatedFabStyle = useAnimatedStyle(() => {
    const p = pressed.value;
    return {
      transform: [{scale: interpolate(p, [0, 1], [1, 0.84])}],
      opacity: interpolate(p, [0, 1], [1, 0.86]),
    };
  });

  const startVoiceListening = useCallback(async () => {
    if (!voiceAvailable) {
      Alert.alert('Voice Not Available', 'Voice recognition is not available on this device.');
      return;
    }
    navigateToAssistantChat(navigation);
    Vibration.vibrate(50);
    await startVoiceCapture();
  }, [voiceAvailable, navigation, startVoiceCapture]);

  const stopVoiceListening = useCallback(
    async (abort: boolean) => {
      await stopVoiceCapture({abort});
    },
    [stopVoiceCapture],
  );

  const getPageY = useCallback((event: GestureResponderEvent) => {
    const n = event.nativeEvent as {pageY?: number; locationY?: number; touches?: {pageY?: number}[]};
    return n.pageY ?? n.touches?.[0]?.pageY ?? n.locationY ?? 0;
  }, []);

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      pressed.value = withSpring(1, FAB_PRESS_SPRING_IN);
      startY.current = getPageY(event);
      hasAborted.current = false;
      longPressTimer.current = setTimeout(() => {
        isLongPressing.current = true;
        startVoiceListening();
      }, 300);
    },
    [pressed, startVoiceListening, getPageY],
  );

  const handleMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!isLongPressing.current || hasAborted.current) return;
      const deltaY = startY.current - getPageY(event);
      if (deltaY > SWIPE_UP_THRESHOLD) {
        hasAborted.current = true;
        Vibration.vibrate(30);
        stopVoiceListening(true);
      }
    },
    [stopVoiceListening, getPageY],
  );

  const handlePressOut = useCallback(() => {
    pressed.value = withSpring(0, FAB_PRESS_SPRING_OUT);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isLongPressing.current && !hasAborted.current) {
      isLongPressing.current = false;
      stopVoiceListening(false);
    } else {
      isLongPressing.current = false;
    }
  }, [pressed, stopVoiceListening]);

  const openCreationFlow = useCallback(
    (action: CreationMenuAction) => {
      setCreateMenuVisible(false);
      navigation.navigate('MainTabs', {
        screen: 'Home',
        params: {
          screen: 'CreateTodo',
          params: {initialCreationType: action},
        },
      });
    },
    [navigation],
  );

  const handleShortTap = useCallback(
    (action?: FabCreateMenuAction) => {
      if (voiceState.isListening) return;
      // Native iOS path: the system context menu has already been shown by UIKit, and we
      // arrive here only AFTER the user picked an item — open the matching creation flow.
      if (action) {
        openCreationFlow(action);
        return;
      }
      // Non-iOS / fallback path: no native menu, so fall back to the RN bottom sheet.
      setCreateMenuVisible(true);
    },
    [voiceState.isListening, openCreationFlow],
  );

  const handleFabPress = useCallback(() => {
    if (!isLongPressing.current && !voiceState.isListening) {
      handleShortTap();
    }
  }, [handleShortTap, voiceState.isListening]);

  const iosSwiftFab = isSwiftUIFabChromeAvailable();

  const legacyPressable = (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="Create new, hold for voice command"
      onPress={handleFabPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onResponderMove={handleMove}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      style={styles.innerPad}>
      <Animated.View style={[styles.fab, animatedFabStyle]}>
        <AppleNativeFabChrome size={FAB_SIZE} interactive={false} />
      </Animated.View>
    </AnimatedPressable>
  );

  // Native iOS FAB owns the entire interaction: tap shows the system context menu (Liquid
  // Glass on iOS 26+) hosted by `UIButton.menu`, and press-and-hold races the menu's tap and
  // wins → starts voice capture. The RN `AppleNativeCreateGlassMenu` is kept only as a
  // non-iOS / unavailable-host fallback (see `handleShortTap`).
  const fabNode = iosSwiftFab ? (
    <View
      pointerEvents="box-none"
      accessible
      accessibilityRole="button"
      accessibilityLabel="Create new, hold for voice command"
      accessibilityHint="Tap for the create menu. Touch and hold to open the assistant and dictate."
      style={{width: FAB_SIZE, height: FAB_SIZE}}>
      <AppleNativeFabChrome
        size={FAB_SIZE}
        interactive
        onNativeShortTap={handleShortTap}
        onVoiceBegan={startVoiceListening}
        onVoiceEnded={stopVoiceListening}
      />
    </View>
  ) : (
    <View style={styles.fabLegacyChrome}>{legacyPressable}</View>
  );

  const bottom = Math.max(insets.bottom, 8) + TAB_BAR_CLEARANCE + 6;

  return (
    <>
      {createMenuVisible ? (
        <AppleNativeCreateGlassMenu
          visible
          onDismiss={() => setCreateMenuVisible(false)}
          onSelect={openCreationFlow}
          style={[StyleSheet.absoluteFillObject, styles.createMenuLayer]}
        />
      ) : null}
      <Animated.View
        pointerEvents={isVisible ? 'box-none' : 'none'}
        style={[
          styles.wrap,
          {
            bottom,
            right: Math.max(insets.right, 16),
          },
          animatedContainerStyle,
        ]}>
        {fabNode}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  createMenuLayer: {
    zIndex: 920,
    elevation: 40,
  },
  wrap: {
    position: 'absolute',
    zIndex: 850,
  },
  fabLegacyChrome: {
    padding: 5,
    borderRadius: FAB_SIZE / 2 + 6,
    backgroundColor: '#18181b',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 6},
        shadowOpacity: 0.22,
        shadowRadius: 12,
      },
      android: {elevation: 12},
    }),
  },
  innerPad: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
