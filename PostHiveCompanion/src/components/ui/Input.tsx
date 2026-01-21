import React, {useState} from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import {theme} from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  label,
  error,
  containerStyle,
  leftIcon,
  rightIcon,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  
  // Extract height from containerStyle to apply to inputContainer
  const inputHeight = containerStyle?.height;
  const containerStyleWithoutHeight = containerStyle 
    ? Object.fromEntries(
        Object.entries(containerStyle).filter(([key]) => key !== 'height')
      )
    : undefined;

  return (
    <View style={[styles.container, containerStyleWithoutHeight]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
          inputHeight && {height: inputHeight},
        ]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
          ]}
          placeholderTextColor={theme.colors.textMuted}
          onFocus={e => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={e => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.xs,
    marginBottom: theme.spacing.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 0, // Sharp edges
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 44, // h-11
  },
  inputContainerFocused: {
    borderColor: theme.colors.borderActive,
  },
  inputContainerError: {
    borderColor: theme.colors.errorBorder,
  },
  input: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.sm,
    paddingHorizontal: theme.spacing.md,
    height: '100%',
  },
  inputWithLeftIcon: {
    paddingLeft: theme.spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: theme.spacing.xs,
  },
  leftIcon: {
    paddingLeft: theme.spacing.md,
  },
  rightIcon: {
    paddingRight: theme.spacing.md,
  },
  error: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs,
  },
});

