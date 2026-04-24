import React, {useRef, useEffect, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Animated, Pressable} from 'react-native';
import {Check, Folder} from 'lucide-react-native';
import {formatDistanceToNow, isPast, parseISO} from 'date-fns';
import {theme} from '../theme';
import {Todo} from '../lib/types';
import {capitalizeFirst} from '../lib/utils';

interface TodoItemProps {
  todo: Todo;
  onToggleStatus: () => void;
  onPress: () => void;
  isCompleting?: boolean;
  wasRecentlyCompleted?: boolean;
}

export function TodoItem({
  todo,
  onToggleStatus,
  onPress,
  isCompleting = false,
  wasRecentlyCompleted = false,
}: TodoItemProps) {
  const isCompleted = todo.status === 'completed';
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(isCompleted ? 0.6 : 1)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const checkScaleAnim = useRef(new Animated.Value(isCompleted ? 1 : 0)).current;
  const checkRotateAnim = useRef(new Animated.Value(isCompleted ? 1 : 0)).current;
  const strikethroughAnim = useRef(new Animated.Value(isCompleted ? 1 : 0)).current;
  const strikethroughWidthAnim = useRef(new Animated.Value(0)).current;
  const checkboxCollapseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  // Handle completing animation - enhanced with spring physics
  useEffect(() => {
    if (isCompleting) {
      // Step 1: Checkbox collapses
      Animated.timing(checkboxCollapseAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Step 2: Checkmark appears with rotation
      Animated.parallel([
        Animated.spring(checkScaleAnim, {
          toValue: 1.2,
          friction: 4,
          tension: 300,
          useNativeDriver: true,
        }),
        Animated.timing(checkRotateAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.spring(checkScaleAnim, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }).start();
      });

      // Step 3: Green strikethrough line animates through text
      Animated.sequence([
        Animated.delay(150), // Wait for checkbox to start collapsing
        Animated.timing(strikethroughWidthAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
          easing: (t) => t * (2 - t), // ease-out
        }),
      ]).start();

      // Step 4: Strikethrough opacity
      Animated.timing(strikethroughAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();

      // Step 5: Glow pulse
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Step 6: Slide right slightly
      Animated.timing(translateXAnim, {
        toValue: 8,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Step 7: Fade to completed state
      Animated.timing(opacityAnim, {
        toValue: 0.6,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (!isCompleted) {
      // Reset animations
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateXAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(checkScaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(checkRotateAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(strikethroughAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(strikethroughWidthAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(checkboxCollapseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isCompleting, isCompleted, scaleAnim, opacityAnim, translateXAnim, checkScaleAnim, checkRotateAnim, strikethroughAnim, strikethroughWidthAnim, checkboxCollapseAnim, glowAnim]);

  // Celebrate animation for recently completed
  useEffect(() => {
    if (wasRecentlyCompleted) {
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.05,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: 1,
          friction: 3,
          tension: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [wasRecentlyCompleted, bounceAnim]);

  // Check if overdue (accounting for time)
  const isOverdue = (() => {
    if (!todo.due_date || isCompleted) return false;
    try {
      let dueDateTime: Date;
      if (todo.due_time) {
        const datePart = new Date(todo.due_date);
        const [hours, minutes, seconds] = todo.due_time.split(':').map(Number);
        dueDateTime = new Date(
          datePart.getFullYear(),
          datePart.getMonth(),
          datePart.getDate(),
          hours || 0,
          minutes || 0,
          seconds || 0
        );
      } else {
        const datePart = new Date(todo.due_date);
        dueDateTime = new Date(
          datePart.getFullYear(),
          datePart.getMonth(),
          datePart.getDate(),
          23,
          59,
          59
        );
      }
      return isPast(dueDateTime);
    } catch {
      return false;
    }
  })();

  // Format time remaining
  const getTimeRemaining = () => {
    if (!todo.due_date || isCompleted) return null;
    try {
      // Combine due_date and due_time if both exist
      let dueDateTime: Date;
      if (todo.due_time) {
        // Parse the date and time separately, then combine
        const datePart = new Date(todo.due_date);
        const [hours, minutes, seconds] = todo.due_time.split(':').map(Number);
        dueDateTime = new Date(
          datePart.getFullYear(),
          datePart.getMonth(),
          datePart.getDate(),
          hours || 0,
          minutes || 0,
          seconds || 0
        );
      } else {
        // If no time specified, use end of day
        const datePart = new Date(todo.due_date);
        dueDateTime = new Date(
          datePart.getFullYear(),
          datePart.getMonth(),
          datePart.getDate(),
          23,
          59,
          59
        );
      }
      
      if (isPast(dueDateTime)) {
        return 'Overdue';
      }
      return formatDistanceToNow(dueDateTime, {addSuffix: false});
    } catch {
      return null;
    }
  };

  const timeRemaining = getTimeRemaining();

  // Get initials from assigned name
  const getInitials = (name?: string) => {
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const assignedInitials = todo.assigned_name ? getInitials(todo.assigned_name) : '';
  const isAssigned = !!todo.assigned_to;
  const [titleWidth, setTitleWidth] = useState(0);

  // Animated rotation for checkmark
  const checkRotation = checkRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-45deg', '0deg'],
  });

  // Glow opacity
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });


  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {scale: Animated.multiply(scaleAnim, bounceAnim)},
            {translateX: translateXAnim},
          ],
          opacity: opacityAnim,
        },
      ]}>
      {/* Glow effect on completion */}
      <Animated.View
        style={[styles.glowOverlay, {opacity: glowOpacity}]}
        pointerEvents="none"
      />

      <View style={[styles.pill, isAssigned && styles.pillAssigned]}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={onToggleStatus}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            disabled={isCompleting}
            activeOpacity={0.7}>
            <Animated.View
              style={[
                styles.checkbox,
                (isCompleted || isCompleting) && styles.checkboxCompleted,
                isOverdue && !isCompleted && styles.checkboxOverdue,
                {
                  transform: [{scale: checkboxCollapseAnim}],
                },
              ]}>
              <Animated.View
                style={{
                  transform: [{scale: checkScaleAnim}, {rotate: checkRotation}],
                }}>
                <Check
                  size={11}
                  color={isCompleted || isCompleting ? '#4ade80' : 'transparent'}
                  strokeWidth={2.2}
                />
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>

          <Pressable
            style={styles.content}
            onPress={onPress}
            android_ripple={{color: 'rgba(255,255,255,0.06)'}}>
            <View style={styles.mainContent}>
              {/* Title and time row */}
              <View style={styles.titleRow}>
                <View style={styles.titleContainer}>
                  <Text
                    style={[
                      styles.title,
                      isAssigned && !isCompleted && styles.titleAssigned,
                      (isCompleted || isCompleting) && styles.titleCompleted,
                      isOverdue && !isCompleted && styles.titleOverdue,
                    ]}
                    numberOfLines={1}
                    onLayout={(e) => {
                      if (!titleWidth) {
                        setTitleWidth(e.nativeEvent.layout.width);
                      }
                    }}>
                    {capitalizeFirst(todo.title)}
                  </Text>
                  {(isCompleting || isCompleted) && titleWidth > 0 && (
                    <Animated.View
                      style={[
                        styles.strikethroughLine,
                        {
                          width: strikethroughWidthAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, titleWidth],
                          }),
                          opacity: strikethroughAnim,
                        },
                      ]}
                    />
                  )}
                </View>
                {timeRemaining && (
                  <Text
                    style={[
                      styles.timeText,
                      isOverdue && !isCompleted && styles.timeTextOverdue,
                    ]}>
                    {timeRemaining}
                  </Text>
                )}
                {assignedInitials && (
                  <View
                    style={styles.assigneeBadge}
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={`Assigned to ${todo.assigned_name ?? assignedInitials}`}>
                    <Text style={styles.assigneeBadgeText}>{assignedInitials}</Text>
                  </View>
                )}
              </View>

              {todo.project_name && (
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Folder size={11} color={theme.colors.textMuted} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {todo.project_name}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
    position: 'relative',
    borderRadius: 999,
    overflow: 'hidden',
  },
  pill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 16,
  },
  pillAssigned: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(147, 197, 253, 0.22)',
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#4ade80',
    borderRadius: 999,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkboxContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxCompleted: {
    borderColor: '#4ade80',
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
  },
  checkboxOverdue: {
    borderColor: 'rgba(248, 113, 113, 0.55)',
  },
  content: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  mainContent: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  titleContainer: {
    position: 'relative',
    flexShrink: 1,
  },
  title: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: 18,
    fontWeight: '400',
  },
  strikethroughLine: {
    position: 'absolute',
    left: 0,
    top: 8,
    height: 2,
    backgroundColor: '#4ade80',
    borderRadius: 1,
  },
  titleAssigned: {
    fontFamily: theme.typography.fontFamily.medium,
    fontWeight: '500',
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    flexShrink: 0,
  },
  timeTextOverdue: {
    color: '#f87171',
  },
  // Circular avatar-style assignee badge (replaces the old plain-text initials that read as
  // a stray suffix after "Overdue" / the truncated title in the dashboard task list).
  assigneeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(147, 197, 253, 0.45)',
    marginLeft: 4,
    flexShrink: 0,
  },
  assigneeBadgeText: {
    color: '#dbeafe',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 0.4,
    lineHeight: 12,
  },
  titleCompleted: {
    color: '#52525b',
  },
  titleOverdue: {
    color: '#fca5a5',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
  },
  metaTextOverdue: {
    color: '#f87171',
  },
});

