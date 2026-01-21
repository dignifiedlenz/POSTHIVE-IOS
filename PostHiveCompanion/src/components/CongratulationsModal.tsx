import React, {useEffect, useRef, useCallback, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {theme} from '../theme';

interface CongratulationsModalProps {
  visible: boolean;
  todoTitle: string | null;
  onClose: () => void;
}

export function CongratulationsModal({
  visible,
  todoTitle,
  onClose,
}: CongratulationsModalProps) {
  const [internalVisible, setInternalVisible] = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(12)).current;
  const isClosingRef = useRef(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const animateOut = useCallback(
    (after?: () => void) => {
      Animated.parallel([
        Animated.timing(successOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 18,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        after?.();
      });
    },
    [successOpacity, contentTranslateY, containerOpacity],
  );

  const requestClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    clearTimers();

    animateOut(() => {
      // If parent still thinks we're visible, ask it to close now
      if (visible) {
        onClose();
      }
      setInternalVisible(false);
      isClosingRef.current = false;
    });
  }, [animateOut, clearTimers, onClose, visible]);

  const handleShow = useCallback(() => {
    // Ensure we never "replay" while already visible
    clearTimers();
    isClosingRef.current = false;
    successOpacity.setValue(0);
    containerOpacity.setValue(0);
    contentTranslateY.setValue(12);

    // Match CreationFlowScreen's timing:
    // - delay 100ms
    // - fade in 400ms
    // - auto close after 1500ms (from fade start) → 1600ms total from show
    fadeTimerRef.current = setTimeout(() => {
      Animated.timing(containerOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 100);

    closeTimerRef.current = setTimeout(() => {
      requestClose();
    }, 1600);
  }, [clearTimers, requestClose, successOpacity, containerOpacity, contentTranslateY]);

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      return;
    }

    // Parent hid us: animate out smoothly, then unmount
    if (internalVisible) {
      clearTimers();
      animateOut(() => {
        setInternalVisible(false);
        isClosingRef.current = false;
      });
      return;
    }
    return () => {
      clearTimers();
    };
  }, [visible, internalVisible, clearTimers, animateOut, successOpacity]);

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onShow={handleShow}
      onRequestClose={requestClose}>
      <Animated.View style={[styles.container, {opacity: containerOpacity}]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <TouchableOpacity
          style={styles.touchable}
          activeOpacity={1}
          onPress={requestClose}>
          <Animated.View
            style={[
              styles.successContent,
              {
                opacity: successOpacity,
                transform: [{translateY: contentTranslateY}],
              },
            ]}>
            <Text style={styles.successLabel}>TASK COMPLETED</Text>
            <Text style={styles.successTitle}>Done.</Text>
          </Animated.View>
        </TouchableOpacity>
      </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  touchable: {
    flex: 1,
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  successLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 4,
    marginBottom: theme.spacing.md,
  },
  successTitle: {
    color: theme.colors.textPrimary,
    fontSize: 56,
    fontFamily: theme.typography.fontFamily.bold,
  },
});

