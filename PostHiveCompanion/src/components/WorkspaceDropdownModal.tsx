import React, {useRef, useState, useEffect} from 'react';
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
import {Workspace} from '../lib/types';

interface WorkspaceDropdownModalProps {
  visible: boolean;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onClose: () => void;
}

export function WorkspaceDropdownModal({
  visible,
  workspaces,
  currentWorkspace,
  onSelectWorkspace,
  onClose,
}: WorkspaceDropdownModalProps) {
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(false);
  const itemAnimationsRef = useRef<Array<{opacity: Animated.Value; translateY: Animated.Value}>>([]);

  // Initialize animations for workspace items
  useEffect(() => {
    if (itemAnimationsRef.current.length !== workspaces.length) {
      itemAnimationsRef.current = workspaces.map(() => ({
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(12),
      }));
    }
  }, [workspaces.length]);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      // Fade in container
      Animated.timing(containerOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();

      // Staggered entry for workspace items (like CongratulationsModal)
      const staggerDelay = 80;
      itemAnimationsRef.current.forEach((anim, index) => {
        Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 400,
            delay: 100 + index * staggerDelay,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateY, {
            toValue: 0,
            duration: 400,
            delay: 100 + index * staggerDelay,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else if (isMounted) {
      // Animate modal exit
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        // Reset item animations
        itemAnimationsRef.current.forEach(anim => {
          anim.opacity.setValue(0);
          anim.translateY.setValue(12);
        });
        setIsMounted(false);
      });
    }
  }, [visible, containerOpacity, isMounted]);

  if (!isMounted && !visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <Animated.View style={[styles.container, {opacity: containerOpacity}]}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <TouchableOpacity
              style={styles.touchable}
              activeOpacity={1}
              onPress={() => {
                // Only allow closing if onClose is provided and not required
                if (onClose) {
                  onClose();
                }
              }}>
            <View style={styles.content}>
              {workspaces.map((workspace, index) => {
                const anim = itemAnimationsRef.current[index] || {
                  opacity: new Animated.Value(0),
                  translateY: new Animated.Value(12),
                };
                return (
                  <Animated.View
                    key={workspace.id}
                    style={{
                      opacity: anim.opacity,
                      transform: [{translateY: anim.translateY}],
                    }}>
                    <TouchableOpacity
                      onPress={() => {
                        onSelectWorkspace(workspace);
                        onClose();
                      }}
                      activeOpacity={0.6}
                      style={styles.workspaceButton}>
                      <Text
                        style={[
                          styles.workspaceName,
                          currentWorkspace?.id === workspace.id && styles.workspaceNameActive,
                        ]}>
                        {workspace.name}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  workspaceButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  workspaceName: {
    color: theme.colors.textPrimary,
    fontSize: 36,
    fontFamily: theme.typography.fontFamily.bold,
    textAlign: 'center',
  },
  workspaceNameActive: {
    color: theme.colors.textPrimary,
  },
});
