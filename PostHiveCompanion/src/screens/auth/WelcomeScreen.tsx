import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import {Check} from 'lucide-react-native';
import {theme} from '../../theme';

const {width} = Dimensions.get('window');

interface WelcomeScreenProps {
  userName: string;
  onComplete: () => void;
}

export function WelcomeScreen({userName, onComplete}: WelcomeScreenProps) {
  // Animation values
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslate = useRef(new Animated.Value(20)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Sequence of animations
    Animated.sequence([
      // 1. Check icon appears with scale bounce
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      // Small delay
      Animated.delay(200),
      // 2. Welcome text fades in and slides up
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(textTranslate, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
      // Small delay
      Animated.delay(100),
      // 3. Subtitle fades in
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(subtitleTranslate, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
      // Hold for a moment
      Animated.delay(1200),
      // 4. Fade out everything
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete();
    });
  }, [
    checkScale,
    checkOpacity,
    textOpacity,
    textTranslate,
    subtitleOpacity,
    subtitleTranslate,
    containerOpacity,
    onComplete,
  ]);

  // Get first name only
  const firstName = userName.split(' ')[0] || 'there';

  return (
    <Animated.View style={[styles.container, {opacity: containerOpacity}]}>
      {/* Animated check circle */}
      <Animated.View
        style={[
          styles.checkCircle,
          {
            transform: [{scale: checkScale}],
            opacity: checkOpacity,
          },
        ]}>
        <Check size={40} color={theme.colors.accentText} strokeWidth={3} />
      </Animated.View>

      {/* Welcome text */}
      <Animated.Text
        style={[
          styles.welcomeText,
          {
            opacity: textOpacity,
            transform: [{translateY: textTranslate}],
          },
        ]}>
        Welcome back
      </Animated.Text>

      {/* User name */}
      <Animated.Text
        style={[
          styles.userName,
          {
            opacity: textOpacity,
            transform: [{translateY: textTranslate}],
          },
        ]}>
        {firstName}
      </Animated.Text>

      {/* Subtitle */}
      <Animated.Text
        style={[
          styles.subtitle,
          {
            opacity: subtitleOpacity,
            transform: [{translateY: subtitleTranslate}],
          },
        ]}>
        LET'S GET TO WORK
      </Animated.Text>

      {/* Decorative lines */}
      <View style={styles.decorativeLines}>
        <View style={styles.line} />
        <View style={[styles.line, styles.lineShort]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 0, // Sharp edges
    backgroundColor: theme.colors.accentBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
    borderWidth: 2,
    borderColor: theme.colors.accentBackground,
  },
  welcomeText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  userName: {
    color: theme.colors.textPrimary,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: theme.spacing.lg,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 3,
  },
  decorativeLines: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  line: {
    width: 40,
    height: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 8,
  },
  lineShort: {
    width: 20,
  },
});












