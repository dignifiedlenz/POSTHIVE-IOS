import React, {useRef, useEffect} from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native';
import {theme} from '../../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Loading animation - pulse effect
  useEffect(() => {
    if (loading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      opacityAnim.setValue(1);
    }
  }, [loading, opacityAnim]);

  const handlePressIn = () => {
    if (!isDisabled) {
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (!isDisabled) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }).start();
    }
  };

  const getVariantStyles = (): ViewStyle => {
    if (isDisabled) {
      return {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.border,
        opacity: 0.5,
      };
    }
    switch (variant) {
      case 'primary':
        // White background, black text - main action
        return {
          backgroundColor: theme.colors.accentBackground,
        };
      case 'secondary':
        // Transparent with border - standard action
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.colors.borderHover,
        };
      case 'tertiary':
        // Semi-transparent with border
        return {
          backgroundColor: theme.colors.secondaryBackground,
          borderWidth: 1,
          borderColor: theme.colors.secondaryBorder,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
      case 'danger':
        return {
          backgroundColor: theme.colors.errorBackground,
          borderWidth: 1,
          borderColor: theme.colors.errorBorder,
        };
      default:
        return {
          backgroundColor: theme.colors.accentBackground,
        };
    }
  };

  const getTextColor = () => {
    if (isDisabled) {
      return theme.colors.textMuted;
    }
    switch (variant) {
      case 'primary':
        return theme.colors.accentText; // Black text on white
      case 'danger':
        return theme.colors.error;
      case 'secondary':
      case 'tertiary':
      case 'ghost':
        return theme.colors.textPrimary; // White text
      default:
        return theme.colors.accentText;
    }
  };

  return (
    <Animated.View
      style={[
        {
          transform: [{scale: scaleAnim}],
          opacity: loading ? opacityAnim : 1,
        },
      ]}>
      <TouchableOpacity
        style={[
          styles.button,
          getVariantStyles(),
          size === 'sm' && styles.buttonSm,
          size === 'lg' && styles.buttonLg,
          fullWidth && styles.fullWidth,
          style,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={getTextColor()} size="small" />
            <Text
              style={[
                styles.text,
                {color: getTextColor()},
                styles.loadingText,
              ]}>
              {title.toUpperCase()}
            </Text>
          </View>
        ) : (
          <>
            {icon && <>{icon}</>}
            <Text
              style={[
                styles.text,
                {color: getTextColor()},
                size === 'sm' && styles.textSm,
                size === 'lg' && styles.textLg,
                icon && styles.textWithIcon,
                textStyle,
              ]}>
              {title.toUpperCase()}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: theme.sizes.buttonHeight, // h-11 = 44px
    paddingHorizontal: 16,
    borderRadius: 0, // Sharp edges - NO rounded corners
  },
  buttonSm: {
    height: 36,
    paddingHorizontal: 12,
  },
  buttonLg: {
    height: 52,
    paddingHorizontal: 24,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontSize: theme.typography.fontSize.xs, // text-xs
    fontFamily: theme.typography.fontFamily.semibold,
    fontWeight: '600',
    letterSpacing: 2, // tracking-[0.35em] approximation
  },
  textSm: {
    fontSize: 10,
  },
  textLg: {
    fontSize: theme.typography.fontSize.sm,
  },
  textWithIcon: {
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    marginLeft: 0,
  },
});

