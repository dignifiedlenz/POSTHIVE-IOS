import React, {useRef, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Animated} from 'react-native';
import {Swipeable} from 'react-native-gesture-handler';
import {Check, MessageCircle, Trash2} from 'lucide-react-native';
import {theme} from '../theme';
import {Comment} from '../lib/types';
import {formatTimeAgo, formatVideoTimestamp} from '../lib/utils';

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onTimestampPress?: (timestamp: number) => void;
  onToggleComplete?: () => void;
  onReply?: () => void;
  onDelete?: () => void;
  canComplete?: boolean;
  canDelete?: boolean;
  isLast?: boolean;
  isHighlighted?: boolean;
}

export function CommentItem({
  comment,
  currentUserId,
  onTimestampPress,
  onToggleComplete,
  onReply,
  onDelete,
  canComplete = true,
  canDelete,
  isLast = false,
  isHighlighted = false,
}: CommentItemProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const highlightAnim = useRef(new Animated.Value(isHighlighted ? 1 : 0)).current;
  
  // Animate highlight when comment is highlighted
  useEffect(() => {
    if (isHighlighted) {
      // Pulse animation then fade out
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.delay(1500),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [isHighlighted, highlightAnim]);

  const highlightBackgroundColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.background, theme.colors.accent + '25'],
  });
  
  const hasTimestamp =
    comment.start_time !== undefined && comment.start_time !== null;

  const authorName = comment.author?.name || 'Unknown';
  
  // User can delete if they're the author or if explicitly allowed
  const isAuthor = currentUserId && comment.author?.id === currentUserId;
  const showDeleteAction = canDelete !== undefined ? canDelete : isAuthor;

  const handlePress = () => {
    if (hasTimestamp) {
      onTimestampPress?.(comment.start_time!);
    }
  };

  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete?.();
  };

  const handleReply = () => {
    swipeableRef.current?.close();
    onReply?.();
  };

  const handleToggleComplete = () => {
    swipeableRef.current?.close();
    onToggleComplete?.();
  };

  // Calculate total width of visible actions
  const actionWidth = 64;
  const visibleActionsCount = 
    (canComplete ? 1 : 0) + 
    (onReply ? 1 : 0) + 
    (showDeleteAction && onDelete ? 1 : 0);
  const actionsWidth = visibleActionsCount * actionWidth;

  // Render right swipe actions
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-actionsWidth, 0],
      outputRange: [0, actionsWidth],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.actionsContainer,
          {transform: [{translateX}]},
        ]}>
        {/* Reply - show first for easier access */}
        {onReply && (
          <TouchableOpacity
            style={[styles.actionItem, styles.actionReply]}
            onPress={handleReply}>
            <MessageCircle size={20} color="#000" />
            <Text style={styles.actionItemTextDark}>Reply</Text>
          </TouchableOpacity>
        )}

        {/* Mark as Done / Resolved */}
        {canComplete && (
          <TouchableOpacity
            style={[
              styles.actionItem,
              styles.actionComplete,
              comment.completed && styles.actionCompleteActive,
            ]}
            onPress={handleToggleComplete}>
            <Check
              size={20}
              color={comment.completed ? theme.colors.success : 'rgba(255,255,255,0.8)'}
            />
            <Text style={styles.actionItemText}>
              {comment.completed ? 'Undo' : 'Done'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Delete */}
        {showDeleteAction && onDelete && (
          <TouchableOpacity
            style={[styles.actionItem, styles.actionDelete]}
            onPress={handleDelete}>
            <Trash2 size={20} color="#fff" />
            <Text style={styles.actionItemText}>Delete</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      friction={2}
      overshootRight={false}>
      <Animated.View style={{backgroundColor: highlightBackgroundColor}}>
        <TouchableOpacity
          style={[
            styles.container,
            comment.completed && styles.completedContainer,
          ]}
          onPress={handlePress}
          activeOpacity={hasTimestamp ? 0.7 : 1}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.authorName}>{authorName}</Text>
            {hasTimestamp && (
              <View style={styles.timestampBadge}>
                <Text style={styles.timestampText}>
                  {formatVideoTimestamp(comment.start_time!)}
                  {comment.end_time != null &&
                    comment.end_time > 0 &&
                    comment.end_time !== comment.start_time &&
                    ` - ${formatVideoTimestamp(comment.end_time)}`}
                </Text>
              </View>
            )}
            <Text style={styles.time}>{formatTimeAgo(comment.created_at)}</Text>
          </View>

          <Text
            style={[
              styles.commentText,
              comment.completed && styles.completedText,
            ]}>
            {comment.content}
          </Text>

          {/* Status indicator */}
          {comment.completed && (
            <View style={styles.statusRow}>
              <Check size={12} color={theme.colors.success} />
              <Text style={styles.statusText}>Resolved</Text>
            </View>
          )}
        </View>
        </TouchableOpacity>
      </Animated.View>
      {!isLast && <View style={styles.divider} />}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  completedContainer: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    gap: 6,
  },
  authorName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  timestampBadge: {
    backgroundColor: theme.colors.accent + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  timestampText: {
    color: theme.colors.accent,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  time: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    marginLeft: 'auto',
  },
  commentText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: 18,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: theme.colors.textMuted,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  statusText: {
    color: theme.colors.success,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.medium,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginTop: 6,
  },
  // Swipe actions
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  actionItem: {
    width: 64,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionComplete: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionCompleteActive: {
    backgroundColor: theme.colors.success + '30',
  },
  actionReply: {
    backgroundColor: '#FFFFFF',
  },
  actionDelete: {
    backgroundColor: theme.colors.error,
  },
  actionItemText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    marginTop: 4,
  },
  actionItemTextDark: {
    color: '#000',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    marginTop: 4,
  },
});
