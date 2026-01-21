import React from 'react';
import {View, Text, StyleSheet, ViewStyle} from 'react-native';
import {theme} from '../../theme';

interface BadgeProps {
  label: string;
  color?: string;
  backgroundColor?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function Badge({
  label,
  color = theme.colors.textPrimary,
  backgroundColor = theme.colors.surfaceElevated,
  size = 'md',
  style,
}: BadgeProps) {
  const getPadding = () => {
    switch (size) {
      case 'sm':
        return {paddingVertical: 2, paddingHorizontal: 6};
      case 'md':
        return {paddingVertical: 4, paddingHorizontal: 8};
      default:
        return {paddingVertical: 4, paddingHorizontal: 8};
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return theme.typography.fontSize.xs;
      case 'md':
        return theme.typography.fontSize.sm;
      default:
        return theme.typography.fontSize.sm;
    }
  };

  return (
    <View style={[styles.badge, {backgroundColor}, getPadding(), style]}>
      <Text style={[styles.text, {color, fontSize: getFontSize()}]}>
        {label}
      </Text>
    </View>
  );
}

interface StatusBadgeProps {
  status: 'pending' | 'in_progress' | 'completed' | 'draft' | 'review' | 'approved' | 'final';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function StatusBadge({status, size = 'md', style}: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pending',
          backgroundColor: theme.colors.statusPending + '20',
          color: theme.colors.statusPending,
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          backgroundColor: theme.colors.statusInProgress + '20',
          color: theme.colors.statusInProgress,
        };
      case 'completed':
        return {
          label: 'Completed',
          backgroundColor: theme.colors.statusCompleted + '20',
          color: theme.colors.statusCompleted,
        };
      case 'draft':
        return {
          label: 'Draft',
          backgroundColor: theme.colors.statusDraft + '20',
          color: theme.colors.statusDraft,
        };
      case 'review':
        return {
          label: 'Review',
          backgroundColor: theme.colors.statusReview + '20',
          color: theme.colors.statusReview,
        };
      case 'approved':
        return {
          label: 'Approved',
          backgroundColor: theme.colors.statusApproved + '20',
          color: theme.colors.statusApproved,
        };
      case 'final':
        return {
          label: 'Final',
          backgroundColor: theme.colors.statusFinal + '20',
          color: theme.colors.statusFinal,
        };
      default:
        return {
          label: status,
          backgroundColor: theme.colors.surfaceElevated,
          color: theme.colors.textMuted,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge
      label={config.label}
      backgroundColor={config.backgroundColor}
      color={config.color}
      size={size}
      style={style}
    />
  );
}

interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function PriorityBadge({priority, size = 'sm', style}: PriorityBadgeProps) {
  const getPriorityConfig = () => {
    switch (priority) {
      case 'urgent':
        return {
          label: 'Urgent',
          backgroundColor: theme.colors.priorityUrgent + '20',
          color: theme.colors.priorityUrgent,
        };
      case 'high':
        return {
          label: 'High',
          backgroundColor: theme.colors.priorityHigh + '20',
          color: theme.colors.priorityHigh,
        };
      case 'medium':
        return {
          label: 'Medium',
          backgroundColor: theme.colors.priorityMedium + '20',
          color: theme.colors.priorityMedium,
        };
      case 'low':
        return {
          label: 'Low',
          backgroundColor: theme.colors.priorityLow + '20',
          color: theme.colors.priorityLow,
        };
      default:
        return {
          label: priority,
          backgroundColor: theme.colors.surfaceElevated,
          color: theme.colors.textMuted,
        };
    }
  };

  const config = getPriorityConfig();

  return (
    <Badge
      label={config.label}
      backgroundColor={config.backgroundColor}
      color={config.color}
      size={size}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 0, // Sharp edges
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  text: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 10,
  },
});

